import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { SearchService } from '../../core/search/search.service';
import type { Listing } from '../../core/models/listing.model';
import type { ListingFilters, SourceStatus } from '../../core/models/query.model';
import { emptyFilters } from '../../core/models/query.model';
import type { ChatMessage } from '../../core/models/chat.model';
import { SearchBar } from './components/search-bar/search-bar';
import { FilterPanel } from './components/filter-panel/filter-panel';
import { ListingList } from './components/listing-list/listing-list';
import { ChatPanel } from './components/chat-panel/chat-panel';

/**
 * The post-login search workspace. Owns all retrieval state and wires the two
 * modes together: free-text questions go to the conversational agent, the
 * filter panel runs a structured search, and both render into one results grid.
 */
@Component({
  selector: 'app-workspace',
  imports: [RouterLink, SearchBar, FilterPanel, ListingList, ChatPanel],
  templateUrl: './workspace.html',
  styleUrl: './workspace.scss',
})
export class Workspace {
  private readonly search = inject(SearchService);
  protected readonly auth = inject(AuthService);

  protected readonly listings = signal<Listing[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly hasSearched = signal(false);
  protected readonly sources = signal<Record<string, SourceStatus>>({});
  protected readonly contextNote = signal<string | undefined>(undefined);

  protected readonly filtersOpen = signal(false);
  protected readonly appliedFilters = signal<ListingFilters>(emptyFilters());

  protected readonly chatOpen = signal(false);
  protected readonly chatBusy = signal(false);
  protected readonly messages = signal<ChatMessage[]>([]);

  protected readonly activeFilterCount = computed(() => countActive(this.appliedFilters()));

  constructor() {
    void this.loadInitial();
  }

  protected toggleFilters(): void {
    this.filtersOpen.update((v) => !v);
  }
  protected toggleChat(): void {
    this.chatOpen.update((v) => !v);
  }
  protected clearChat(): void {
    this.messages.set([]);
  }
  protected signOut(): void {
    void this.auth.signOut();
  }

  /** Conversational path — used by both the top bar and the chat composer. */
  protected async onAsk(prompt: string): Promise<void> {
    this.chatOpen.set(true);
    const pendingId = uid();
    this.messages.update((m) => [
      ...m,
      { id: uid(), role: 'user', text: prompt },
      { id: pendingId, role: 'assistant', text: '', pending: true },
    ]);
    this.chatBusy.set(true);
    this.loading.set(true);

    try {
      const res = await this.search.chat(prompt);
      this.messages.update((m) =>
        m.map((msg) => (msg.id === pendingId ? { ...msg, text: res.answer, matches: res.sources, pending: false } : msg)),
      );
      this.listings.set(res.sources.map((s) => s.listing));
      this.total.set(res.sources.length);
      this.contextNote.set(`from “${truncate(prompt, 48)}”`);
      this.hasSearched.set(true);
    } catch {
      this.messages.update((m) =>
        m.map((msg) =>
          msg.id === pendingId ? { ...msg, text: 'Something went wrong reaching the agent. Try again.', pending: false } : msg,
        ),
      );
    } finally {
      this.chatBusy.set(false);
      this.loading.set(false);
    }
  }

  /** Structured path — the filter panel. */
  protected async onApplyFilters(filters: ListingFilters): Promise<void> {
    this.appliedFilters.set(filters);
    this.loading.set(true);
    this.hasSearched.set(true);
    const note = describeFilters(filters);
    this.contextNote.set(note);
    try {
      const res = await this.search.searchListings(filters);
      this.listings.set(res.listings);
      this.total.set(res.total_matched);
      this.sources.set(res.source_availability);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadInitial(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.search.searchListings(emptyFilters());
      this.listings.set(res.listings);
      this.total.set(res.total_matched);
      this.sources.set(res.source_availability);
    } finally {
      this.loading.set(false);
    }
  }
}

function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `m-${Math.random().toString(36).slice(2)}`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function countActive(f: ListingFilters): number {
  let n = 0;
  if (f.city) n++;
  if (f.district) n++;
  if (f.max_cost != null) n++;
  if (f.min_rooms != null) n++;
  if (f.furnished != null) n++;
  if (f.design_style) n++;
  if (f.condition) n++;
  if (f.brightness) n++;
  if (f.cost_mode === 'strict') n++;
  n += f.amenities?.length ?? 0;
  return n;
}

function describeFilters(f: ListingFilters): string | undefined {
  const bits: string[] = [];
  if (f.district) bits.push(f.district);
  else if (f.city) bits.push(f.city);
  if (f.max_cost != null) bits.push(`≤ ${f.max_cost} zł`);
  if (f.min_rooms != null) bits.push(`${f.min_rooms}+ rooms`);
  return bits.length ? `filtered: ${bits.join(', ')}` : undefined;
}
