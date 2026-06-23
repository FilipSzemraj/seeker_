import { Injectable } from '@angular/core';

import type { Listing } from '../models/listing.model';
import type { ListingFilters, QueryResponse, SourceStatus } from '../models/query.model';
import type { ChatResponse, ListingMatch } from '../models/chat.model';
import { MOCK_LISTINGS } from './mock-listings';

/**
 * Single entry point for both retrieval modes.
 *
 * Today it resolves against an in-memory catalogue with simulated latency so
 * the workspace is fully demonstrable before the backend exists. Each method
 * maps 1:1 onto a planned endpoint — replace the body with an HttpClient call
 * (`GET /api/listings`, `POST /api/chat`) and the components stay untouched.
 */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly catalogue = MOCK_LISTINGS;

  /** Structured filter search — the form-mode path (`GET /api/listings`). */
  async searchListings(filters: ListingFilters): Promise<QueryResponse> {
    await delay(420);
    const listings = this.catalogue.filter((l) => this.matchesFilters(l, filters)).slice(0, filters.limit);
    return {
      listings,
      total_matched: listings.length,
      source_availability: this.sourceAvailability(),
      excluded_geocode_failed: 0,
    };
  }

  /** Conversational RAG search — the prompt-mode path (`POST /api/chat`). */
  async chat(prompt: string): Promise<ChatResponse> {
    await delay(720);
    const matches = this.retrieve(prompt);
    return { answer: this.composeAnswer(prompt, matches), sources: matches };
  }

  // --- form-mode filtering ------------------------------------------------

  private matchesFilters(l: Listing, f: ListingFilters): boolean {
    if (f.cost_mode === 'strict' && l.cost_incomplete) return false;
    if (f.max_cost != null && (l.total_monthly_cost ?? Infinity) > f.max_cost) return false;
    if (f.city && !ieq(l.geo.city, f.city)) return false;
    if (f.district && !ieq(l.geo.district, f.district)) return false;
    if (f.min_rooms != null && (l.rooms ?? 0) < f.min_rooms) return false;
    if (f.furnished != null && (l.furnished ?? false) !== f.furnished) return false;
    if (f.design_style && l.enrichment?.design_style !== f.design_style) return false;
    if (f.condition && l.enrichment?.condition !== f.condition) return false;
    if (f.brightness && l.enrichment?.brightness !== f.brightness) return false;
    for (const key of f.amenities ?? []) {
      if ((l.enrichment as Record<string, unknown> | undefined)?.[key] !== 'yes') return false;
    }
    return true;
  }

  // --- prompt-mode retrieval (stand-in for vector search) -----------------

  private retrieve(prompt: string): ListingMatch[] {
    const terms = tokenize(prompt);
    const scored = this.catalogue
      .map((listing) => ({ listing, ...this.score(listing, terms, prompt) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const top = scored.length > 0 ? scored : this.catalogue.slice(0, 2).map((listing) => ({ listing, score: 0.4, reason: '' }));
    return top.map((s) => ({
      listing: s.listing,
      score: round2(Math.min(0.99, 0.55 + s.score / 12)),
      reason: s.reason || this.fallbackReason(s.listing),
    }));
  }

  private score(listing: Listing, terms: string[], prompt: string): { score: number; reason: string } {
    const hay = haystack(listing);
    let score = 0;
    const hits: string[] = [];
    for (const t of terms) {
      if (hay.includes(t)) {
        score += 1;
        hits.push(t);
      }
    }
    const budget = parsePln(prompt);
    if (budget != null && listing.total_monthly_cost != null && listing.total_monthly_cost <= budget) {
      score += 2;
    }
    const rooms = parseRooms(prompt);
    if (rooms != null && listing.rooms === rooms) score += 2;

    return { score, reason: hits.length ? this.reasonFromHits(listing, hits) : '' };
  }

  private reasonFromHits(listing: Listing, hits: string[]): string {
    const tags = listing.enrichment?.tags ?? [];
    const matchedTag = tags.find((t) => hits.some((h) => t.toLowerCase().includes(h)));
    const where = listing.geo.district ? `in ${listing.geo.district}` : '';
    if (matchedTag) return `Matches "${matchedTag}" ${where}`.trim();
    return `Fits ${hits.slice(0, 2).join(', ')} ${where}`.trim();
  }

  private fallbackReason(listing: Listing): string {
    const bits = [
      listing.enrichment?.brightness === 'bright' ? 'bright' : null,
      listing.rooms ? `${listing.rooms}-room` : null,
      listing.geo.district,
    ].filter(Boolean);
    return `A close ${bits.join(' ')} option`;
  }

  private composeAnswer(prompt: string, matches: ListingMatch[]): string {
    if (matches.length === 0) {
      return `I couldn't find a strong match for "${prompt.trim()}" yet — try loosening the budget or naming a district.`;
    }
    const places = unique(matches.map((m) => m.listing.geo.district).filter(Boolean) as string[]);
    const lead = places.length ? `Mostly around ${joinNicely(places)}.` : '';
    return `Here are ${matches.length} that fit. ${lead} Each card below links straight to the original listing.`.trim();
  }

  private sourceAvailability(): Record<string, SourceStatus> {
    return {
      otodom: { available: true, message: null },
      olx: { available: true, message: null },
      facebook: { available: false, message: 'Facebook source is not connected yet.' },
    };
  }
}

// --- helpers --------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ieq(a: string | null | undefined, b: string): boolean {
  return (a ?? '').trim().toLowerCase() === b.trim().toLowerCase();
}

function haystack(l: Listing): string {
  return [
    l.title,
    l.description,
    l.base_location_text,
    l.geo.city,
    l.geo.district,
    l.enrichment?.design_style,
    l.enrichment?.condition,
    l.enrichment?.brightness,
    ...(l.enrichment?.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

const STOP = new Set(['with', 'and', 'the', 'for', 'near', 'flat', 'apartment', 'room', 'rooms', 'under', 'in', 'a', 'an', 'to', 'of']);

function tokenize(prompt: string): string[] {
  return unique(
    prompt
      .toLowerCase()
      .replace(/[^a-ząćęłńóśźż0-9\s-]/gi, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP.has(t)),
  );
}

function parsePln(prompt: string): number | null {
  const m = prompt.replace(/\s/g, '').match(/(\d{3,5})(zł|pln|zl)?/i);
  return m ? Number(m[1]) : null;
}

function parseRooms(prompt: string): number | null {
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, studio: 1 };
  const w = prompt.toLowerCase().match(/\b(one|two|three|four|studio)\b/);
  if (w) return words[w[1]];
  const n = prompt.match(/(\d)\s*-?\s*room/i);
  return n ? Number(n[1]) : null;
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function joinNicely(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
