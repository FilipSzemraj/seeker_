import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { SearchService } from '../../core/search/search.service';
import { PromptHistoryService } from '../../core/search/prompt-history.service';
import { toListingView } from '../../core/search/listing-mapper';
import { buildQueryRequest, buildRetrieveRequest } from '../../core/search/request-builder';
import { narrowByArea } from '../../core/search/geo';
import { isQuota } from '../../core/api/models';
import type { FilterField, QuotaSnapshot } from '../../core/api/models';
import type { Listing } from '../../core/models/listing.model';
import type {
  FilterValues,
  GeoArea,
  ScoredListingView,
  SourceStatus,
} from '../../core/models/query.model';
import { SearchBar } from './components/search-bar/search-bar';
import type { AskEvent } from './components/search-bar/search-bar';
import { FilterPanel } from './components/filter-panel/filter-panel';
import { ListingList } from './components/listing-list/listing-list';
import { MapPanel } from './components/map-panel/map-panel';
import { MapPreview } from './components/map-preview/map-preview';

/** The two retrieval surfaces, each with its own input UI and result state. */
type Mode = 'query' | 'retrieve';

/**
 * The post-login search workspace. Hosts TWO independent retrieval modes behind
 * a switch, each keeping its own inputs and last results so flipping between
 * them never loses work:
 *   • "Filter"  — structured `POST /query` (Mongo exact/range match, geo-aware);
 *   • "Prompt"  — semantic `POST /retrieve` (vector search, scored, prompt history).
 *
 * The map area is a *view filter*: picking/resizing it narrows the visible
 * results client-side (no request). "Search this area" is the explicit action
 * that re-runs the active mode's last search with the radius in its parameters.
 */
@Component({
  selector: 'app-workspace',
  imports: [RouterLink, SearchBar, FilterPanel, ListingList, MapPanel, MapPreview],
  templateUrl: './workspace.html',
  styleUrl: './workspace.scss',
})
export class Workspace {
  private readonly search = inject(SearchService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly promptHistory = inject(PromptHistoryService);

  /** Which mode's UI + results are showing. */
  protected readonly mode = signal<Mode>('query');

  // --- per-mode result state ------------------------------------------------
  // Structured (/query) — unscored listings + per-source availability.
  private readonly queryResults = signal<ScoredListingView[]>([]);
  private readonly queryTotal = signal(0);
  private readonly queryHasSearched = signal(false);
  private readonly queryNote = signal<string | undefined>(undefined);
  protected readonly sources = signal<Record<string, SourceStatus>>({});

  // Semantic (/retrieve) — scored listings; remembers its prompt for re-runs.
  private readonly retrieveResults = signal<ScoredListingView[]>([]);
  private readonly retrieveTotal = signal(0);
  private readonly retrieveHasSearched = signal(false);
  private readonly retrieveNote = signal<string | undefined>(undefined);
  private readonly lastPrompt = signal<string | null>(null);
  private readonly lastRerank = signal(false);

  protected readonly loading = signal(false);
  protected readonly errorBanner = signal<string | null>(null);

  /** "Waking the server…" hint, driven by the service's slow-request signal. */
  protected readonly serverWaking = this.search.serverWaking;

  // Server-driven filter schema + entitlement (for BLUR-flagged fields).
  protected readonly schema = signal<FilterField[]>([]);
  protected readonly entitled = signal(false);

  // Quota: a real snapshot when authenticated, null when auth is disabled.
  protected readonly quota = signal<QuotaSnapshot | null>(null);
  protected readonly quotaLabel = computed(() => {
    const q = this.quota();
    if (!q) return 'Unlimited';
    if (q.remaining_requests == null) return 'Unlimited';
    return `${q.remaining_requests} searches left`;
  });

  protected readonly filtersOpen = signal(false);
  protected readonly appliedFilters = signal<FilterValues>({});

  protected readonly mapOpen = signal(false);
  protected readonly helpOpen = signal(false);
  protected readonly selectedUrl = signal<string | null>(null);
  protected readonly geoFilter = signal<GeoArea | null>(null);

  /** When on, picking a listing from the list scrolls the map back into view. */
  protected readonly jumpToMap = signal(true);
  private readonly mapAnchor = viewChild<ElementRef<HTMLElement>>('mapAnchor');

  // --- active-mode views (what the shared grid + map render) ----------------

  /** The active mode's full (un-narrowed) result set. */
  private readonly rawResults = computed(() =>
    this.mode() === 'query' ? this.queryResults() : this.retrieveResults(),
  );

  /** Results after the client-side map-area narrowing. */
  protected readonly results = computed(() => narrowByArea(this.rawResults(), this.geoFilter()));

  protected readonly total = computed(() =>
    this.mode() === 'query' ? this.queryTotal() : this.retrieveTotal(),
  );
  protected readonly hasSearched = computed(() =>
    this.mode() === 'query' ? this.queryHasSearched() : this.retrieveHasSearched(),
  );
  protected readonly activeSources = computed(() =>
    this.mode() === 'query' ? this.sources() : {},
  );

  /** Base note from the last search, plus a live "N within R km" when narrowed. */
  protected readonly contextNote = computed(() => {
    const base = this.mode() === 'query' ? this.queryNote() : this.retrieveNote();
    const geo = this.geoFilter();
    if (!geo) return base;
    const suffix = `${this.results().length} within ${geo.radius_km} km`;
    return base ? `${base} · ${suffix}` : suffix;
  });

  /** Plain listings for the map (narrowed results stripped of their score). */
  protected readonly listings = computed<Listing[]>(() => this.results().map((r) => r.listing));

  protected readonly selectedListing = computed(
    () => this.listings().find((l) => l.source_url === this.selectedUrl()) ?? null,
  );

  protected readonly activeFilterCount = computed(
    () => countActive(this.appliedFilters()) + (this.geoFilter() ? 1 : 0),
  );

  /** "Search this area" is actionable when an area is set and there's a search to repeat. */
  protected readonly canSearchArea = computed(
    () => this.geoFilter() != null && (this.mode() === 'query' || this.lastPrompt() != null),
  );

  constructor() {
    void this.bootstrap();
  }

  protected setMode(mode: Mode): void {
    this.mode.set(mode);
    if (mode === 'query') this.filtersOpen.set(true);
  }

  protected toggleFilters(): void {
    this.filtersOpen.update((v) => !v);
  }
  protected toggleMap(): void {
    this.mapOpen.update((v) => !v);
  }
  protected toggleHelp(): void {
    this.helpOpen.update((v) => !v);
  }
  protected toggleJumpToMap(): void {
    this.jumpToMap.update((v) => !v);
  }
  protected selectListing(url: string | null): void {
    this.selectedUrl.set(url);
  }

  /**
   * Selection coming from the results list. When "Jump to map" is on, scroll the
   * map back into view so the picked listing is visible without manual scrolling.
   */
  protected selectFromList(url: string | null): void {
    this.selectListing(url);
    if (url && this.jumpToMap()) {
      this.mapAnchor()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  protected dismissError(): void {
    this.errorBanner.set(null);
  }
  protected signOut(): void {
    void this.auth.signOut();
  }

  /**
   * Map area picker. Selecting/resizing an area only narrows the already-listed
   * results client-side — no backend round-trip. Use "Search this area" to push
   * the radius into a fresh server-side search.
   */
  protected onGeoChange(area: GeoArea | null): void {
    this.geoFilter.set(area);
  }

  /** Re-run the active mode's last search with the current map area in its params. */
  protected searchThisArea(): void {
    if (this.mode() === 'query') {
      void this.runQuery();
      return;
    }
    const prompt = this.lastPrompt();
    if (prompt) void this.executeRetrieve(prompt, this.lastRerank());
  }

  /** Re-run a remembered prompt from the search-bar history chips. */
  protected onHistoryPick(prompt: string): void {
    void this.executeRetrieve(prompt, this.lastRerank());
  }

  /** Semantic path — the free-text search box (`POST /retrieve`). */
  protected async onAsk(event: AskEvent): Promise<void> {
    const trimmed = event.prompt.trim();
    if (!trimmed) return;
    await this.executeRetrieve(trimmed, event.rerank);
  }

  /**
   * Apply the filter panel. Filters refine whichever mode is active: in prompt
   * mode they re-run the last `/retrieve` as pre-filters; otherwise they run a
   * structured `/query`.
   */
  protected async onApplyFilters(values: FilterValues): Promise<void> {
    this.appliedFilters.set(values);
    this.filtersOpen.set(false);
    const prompt = this.lastPrompt();
    if (this.mode() === 'retrieve' && prompt) {
      await this.executeRetrieve(prompt, this.lastRerank());
      return;
    }
    this.mode.set('query');
    await this.runQuery();
  }

  private async executeRetrieve(prompt: string, rerank: boolean): Promise<void> {
    this.mode.set('retrieve');
    this.lastPrompt.set(prompt);
    this.lastRerank.set(rerank);
    this.beginSearch();
    this.retrieveNote.set(`from "${truncate(prompt, 48)}"`);
    try {
      const req = buildRetrieveRequest(this.schema(), prompt, this.appliedFilters(), {
        rerank,
        geo: this.geoFilter(),
      });
      const res = await this.search.retrieve(req);
      this.retrieveResults.set(
        res.results.map((r) => ({ listing: toListingView(r.listing), score: r.score })),
      );
      this.retrieveTotal.set(res.total);
      this.retrieveHasSearched.set(true);
      this.promptHistory.add(prompt);
      this.applyQuota(res.quota);
      this.dropStaleSelection();
    } catch (err) {
      this.handleError(err);
    } finally {
      this.loading.set(false);
    }
  }

  private async runQuery(): Promise<void> {
    this.beginSearch();
    this.queryNote.set(describeFilters(this.appliedFilters(), this.geoFilter()));
    try {
      const req = buildQueryRequest(this.schema(), this.appliedFilters(), {
        geo: this.geoFilter(),
      });
      const res = await this.search.query(req);
      // Structured results are not scored.
      this.queryResults.set(res.listings.map((l) => ({ listing: toListingView(l), score: null })));
      this.queryTotal.set(res.total_matched);
      this.queryHasSearched.set(true);
      this.sources.set(res.source_availability);
      this.applyQuota(res.quota);
      this.dropStaleSelection();
    } catch (err) {
      this.handleError(err);
    } finally {
      this.loading.set(false);
    }
  }

  private beginSearch(): void {
    this.errorBanner.set(null);
    this.loading.set(true);
  }

  /** Drop the map selection if it fell out of the new (narrowed) result set. */
  private dropStaleSelection(): void {
    const sel = this.selectedUrl();
    if (sel && !this.results().some((r) => r.listing.source_url === sel)) {
      this.selectedUrl.set(null);
    }
  }

  private applyQuota(quota: QuotaSnapshot | null | undefined): void {
    // null => auth disabled (unlimited); a snapshot => refresh the chip.
    this.quota.set(quota ?? null);
  }

  private handleError(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 429) {
        this.errorBanner.set(quotaMessage(err));
        return;
      }
      if (err.status === 0) {
        this.errorBanner.set('Could not reach the server. Check your connection and try again.');
        return;
      }
      this.errorBanner.set(`Search failed (${err.status}). Please try again in a moment.`);
      return;
    }
    this.errorBanner.set('Something went wrong. Please try again.');
  }

  /** Startup: warm the Lambda, load the filter schema + quota, then first page. */
  private async bootstrap(): Promise<void> {
    this.search.warmUp();
    this.loading.set(true);
    try {
      const schema = await this.search.getFilterSchema('en');
      this.schema.set(schema.fields);
    } catch {
      // A failed schema load leaves the panel empty ("Loading filters…"); the
      // search box still works with no pre-filters.
    }
    void this.loadUsage();
    await this.runQuery();
  }

  private async loadUsage(): Promise<void> {
    try {
      const usage = await this.search.getUsage();
      if (isQuota(usage)) {
        this.quota.set(usage);
        // Non-basic tiers are entitled to see BLUR-flagged values.
        this.entitled.set(usage.tier !== 'basic');
      } else {
        // Auth disabled locally → treat as unlimited + fully entitled.
        this.quota.set(null);
        this.entitled.set(true);
      }
    } catch (err) {
      // 403 = signed in but no access-tier group (the API's tier gate). The
      // accessGuard normally blocks this route, so a 403 here means the token's
      // groups desynced — bounce to the gateway, which explains the requirement.
      if (err instanceof HttpErrorResponse && err.status === 403) {
        void this.router.navigateByUrl('/gateway');
        return;
      }
      this.entitled.set(false);
    }
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function countActive(values: FilterValues): number {
  return Object.values(values).filter((v) => v !== null && v !== undefined && v !== '').length;
}

function describeFilters(values: FilterValues, geo: GeoArea | null): string | undefined {
  const bits: string[] = [];
  const district = values['district'];
  const city = values['city'];
  if (typeof district === 'string' && district) bits.push(district);
  else if (typeof city === 'string' && city) bits.push(city);
  const maxCost = values['max_cost'];
  if (typeof maxCost === 'number') bits.push(`≤ ${maxCost} zł`);
  const rooms = values['rooms'];
  if (typeof rooms === 'number') bits.push(`${rooms} rooms`);
  if (geo) bits.push(`within ${geo.radius_km} km`);
  return bits.length ? `filtered: ${bits.join(', ')}` : undefined;
}

function quotaMessage(err: HttpErrorResponse): string {
  const body = err.error as
    | { detail?: { error?: string; message?: string } | string; message?: string }
    | null
    | undefined;
  const detail = body?.detail;
  if (typeof detail === 'string') return `Quota reached — ${detail}`;
  if (detail?.message) return `Quota reached — ${detail.message}`;
  if (detail?.error) return `Quota reached — ${detail.error}`;
  return 'You have hit your search quota or rate limit. Please wait and try again.';
}
