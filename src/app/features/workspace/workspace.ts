import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { SearchService } from '../../core/search/search.service';
import { toListingView } from '../../core/search/listing-mapper';
import { buildQueryRequest, buildRetrieveRequest } from '../../core/search/request-builder';
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
import { FilterPanel } from './components/filter-panel/filter-panel';
import { ListingList } from './components/listing-list/listing-list';
import { MapPanel } from './components/map-panel/map-panel';
import { MapPreview } from './components/map-preview/map-preview';

/**
 * The post-login search workspace. Owns all retrieval state and wires the two
 * modes into ONE results grid:
 *   • the filter panel runs a structured `/query`;
 *   • the search box runs a semantic `/retrieve` (listings only — no prose).
 * The filter schema is fetched once from `/filters` and drives the panel; the
 * currently-applied filters also pre-filter the semantic search. Cold starts
 * are surfaced via the service's `serverWaking` signal and skeleton loaders.
 */
@Component({
  selector: 'app-workspace',
  imports: [RouterLink, SearchBar, FilterPanel, ListingList, MapPanel, MapPreview],
  templateUrl: './workspace.html',
  styleUrl: './workspace.scss',
})
export class Workspace {
  private readonly search = inject(SearchService);
  protected readonly auth = inject(AuthService);

  protected readonly results = signal<ScoredListingView[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly hasSearched = signal(false);
  protected readonly sources = signal<Record<string, SourceStatus>>({});
  protected readonly contextNote = signal<string | undefined>(undefined);
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
  protected readonly selectedUrl = signal<string | null>(null);
  protected readonly geoFilter = signal<GeoArea | null>(null);

  /** Plain listings for the map (results stripped of their score). */
  protected readonly listings = computed<Listing[]>(() => this.results().map((r) => r.listing));

  protected readonly selectedListing = computed(
    () => this.listings().find((l) => l.source_url === this.selectedUrl()) ?? null,
  );

  protected readonly activeFilterCount = computed(
    () => countActive(this.appliedFilters()) + (this.geoFilter() ? 1 : 0),
  );

  constructor() {
    void this.bootstrap();
  }

  protected toggleFilters(): void {
    this.filtersOpen.update((v) => !v);
  }
  protected toggleMap(): void {
    this.mapOpen.update((v) => !v);
  }
  protected selectListing(url: string | null): void {
    this.selectedUrl.set(url);
  }
  protected dismissError(): void {
    this.errorBanner.set(null);
  }
  protected signOut(): void {
    void this.auth.signOut();
  }

  /** Map area picker — re-runs the structured search with the new geo radius. */
  protected onGeoChange(area: GeoArea | null): void {
    this.geoFilter.set(area);
    void this.runQuery();
  }

  /** Semantic path — the free-text search box (`POST /retrieve`). */
  protected async onAsk(prompt: string): Promise<void> {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    this.beginSearch();
    this.contextNote.set(`from "${truncate(trimmed, 48)}"`);
    try {
      const req = buildRetrieveRequest(this.schema(), trimmed, this.appliedFilters());
      const res = await this.search.retrieve(req);
      this.results.set(res.results.map((r) => ({ listing: toListingView(r.listing), score: r.score })));
      this.total.set(res.total);
      this.applyQuota(res.quota);
      this.dropStaleSelection();
    } catch (err) {
      this.handleError(err);
    } finally {
      this.loading.set(false);
    }
  }

  /** Structured path — the filter panel (`POST /query`). */
  protected async onApplyFilters(values: FilterValues): Promise<void> {
    this.appliedFilters.set(values);
    this.filtersOpen.set(false);
    await this.runQuery();
  }

  private async runQuery(): Promise<void> {
    this.beginSearch();
    this.contextNote.set(describeFilters(this.appliedFilters(), this.geoFilter()));
    try {
      const req = buildQueryRequest(this.schema(), this.appliedFilters(), {
        geo: this.geoFilter(),
      });
      const res = await this.search.query(req);
      // Structured results are not scored.
      this.results.set(res.listings.map((l) => ({ listing: toListingView(l), score: null })));
      this.total.set(res.total_matched);
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
    this.hasSearched.set(true);
  }

  /** Drop the map selection if it fell out of the new result set. */
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
    } catch {
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
