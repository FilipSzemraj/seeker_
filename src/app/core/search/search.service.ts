import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import {
  Observable,
  TimeoutError,
  catchError,
  defer,
  finalize,
  firstValueFrom,
  of,
  retry,
  throwError,
  timeout,
  timer,
} from 'rxjs';

import { API_BASE_URL } from '../../config/api.config';
import type {
  FilterSchemaResponse,
  ModesResponse,
  QueryRequest,
  QueryResponse,
  RetrieveRequest,
  RetrieveResponse,
  UsageResponse,
} from '../api/models';

/** Per-request HTTP timeout — generous, because the Lambda may be cold. */
const REQUEST_TIMEOUT_MS = 30_000;
/** Show the "waking the server…" hint once a request runs longer than this. */
const WAKING_HINT_MS = 2_500;
/** How long a cached `/filters` schema stays fresh in localStorage. */
const SCHEMA_TTL_MS = 60 * 60 * 1000; // 1 hour
const SCHEMA_CACHE_KEY = 'seeker.filterSchema.v1';

interface CachedSchema {
  at: number;
  lang: string;
  schema: FilterSchemaResponse;
}

/**
 * Single entry point for both retrieval modes, wired to the live serverless
 * backend. Methods map 1:1 onto endpoints:
 *   • query()           → POST /query     (structured / form mode)
 *   • retrieve()        → POST /retrieve  (semantic / prompt mode, listings only)
 *   • getFilterSchema() → GET  /filters   (server-driven filter UI; cached)
 *   • getModes()        → GET  /modes     (mode metadata + quota)
 *   • getUsage()        → GET  /usage     (initial quota)
 *   • warmUp()          → GET  /health    (kick a cold Lambda awake)
 *
 * Cold starts are handled centrally: every call gets a 30s timeout, one
 * automatic retry on network error / timeout / 5xx (reads are idempotent), and
 * flips `serverWaking` on while any request is taking unusually long.
 */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);
  private readonly base = API_BASE_URL;

  /** True while at least one slow (>2.5s) request is in flight. */
  readonly serverWaking = signal(false);
  private inFlight = 0;

  /** In-memory cache of the filter schema (survives within the session). */
  private schemaCache: FilterSchemaResponse | null = null;

  /**
   * Fire-and-forget liveness probe to warm a cold Lambda while the user sets
   * filters. Public + cheap; errors are swallowed (warming is best-effort).
   */
  warmUp(): void {
    this.http
      .get(`${this.base}/health`)
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        catchError(() => of(null)),
      )
      .subscribe();
  }

  /**
   * The server-driven filter schema. Fetched once and cached in memory (and in
   * localStorage with a short TTL) — never refetched per search.
   */
  async getFilterSchema(lang = 'en'): Promise<FilterSchemaResponse> {
    if (this.schemaCache && this.schemaCache.lang === lang) return this.schemaCache;

    const cached = this.readSchemaCache(lang);
    if (cached) {
      this.schemaCache = cached;
      return cached;
    }

    const schema = await firstValueFrom(
      this.resilient(
        this.http.get<FilterSchemaResponse>(`${this.base}/filters`, { params: { lang } }),
      ),
    );
    this.schemaCache = schema;
    this.writeSchemaCache(schema);
    return schema;
  }

  /** Mode metadata (labels, accepted fields, cost profile) + caller quota. */
  getModes(lang = 'en'): Promise<ModesResponse> {
    return firstValueFrom(
      this.resilient(this.http.get<ModesResponse>(`${this.base}/modes`, { params: { lang } })),
    );
  }

  /** Current-period usage / remaining limits (or the auth-disabled sentinel). */
  getUsage(): Promise<UsageResponse> {
    return firstValueFrom(
      this.resilient(this.http.get<UsageResponse>(`${this.base}/usage`)),
    );
  }

  /** Structured / form-mode search. */
  query(body: QueryRequest): Promise<QueryResponse> {
    return firstValueFrom(
      this.resilient(this.http.post<QueryResponse>(`${this.base}/query`, body)),
    );
  }

  /** Semantic / prompt-mode search — returns scored listings (no prose). */
  retrieve(body: RetrieveRequest): Promise<RetrieveResponse> {
    return firstValueFrom(
      this.resilient(this.http.post<RetrieveResponse>(`${this.base}/retrieve`, body)),
    );
  }

  // --- resilience -----------------------------------------------------------

  /**
   * Wraps a request observable with the cold-start policy: a 30s timeout, a
   * single retry on network error / timeout / 5xx (but NOT on 4xx such as 429),
   * and the "waking the server" hint while it runs slow. `defer` makes the
   * timing/counter bookkeeping per-subscription.
   */
  private resilient<T>(req$: Observable<T>): Observable<T> {
    return defer(() => {
      this.beginRequest();
      const wake = setTimeout(() => this.serverWaking.set(true), WAKING_HINT_MS);
      return req$.pipe(
        timeout(REQUEST_TIMEOUT_MS),
        retry({
          count: 1,
          delay: (error) => {
            if (error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500) {
              // Client errors (incl. 429 budget/rate) are not transient — bail.
              return throwError(() => error);
            }
            // Network failure (status 0), 5xx, or a TimeoutError → back off then retry once.
            void (error instanceof TimeoutError);
            return timer(800);
          },
        }),
        finalize(() => {
          clearTimeout(wake);
          this.endRequest();
        }),
      );
    });
  }

  private beginRequest(): void {
    this.inFlight += 1;
  }

  private endRequest(): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
    if (this.inFlight === 0) this.serverWaking.set(false);
  }

  // --- schema cache (localStorage) -----------------------------------------

  private readSchemaCache(lang: string): FilterSchemaResponse | null {
    try {
      const raw = globalThis.localStorage?.getItem(SCHEMA_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedSchema;
      if (parsed.lang !== lang) return null;
      if (Date.now() - parsed.at > SCHEMA_TTL_MS) return null;
      return parsed.schema;
    } catch {
      return null;
    }
  }

  private writeSchemaCache(schema: FilterSchemaResponse): void {
    try {
      const payload: CachedSchema = { at: Date.now(), lang: schema.lang, schema };
      globalThis.localStorage?.setItem(SCHEMA_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // localStorage may be unavailable (private mode / quota) — memory cache still holds.
    }
  }
}
