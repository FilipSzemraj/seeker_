/**
 * Query DTOs mirroring the planned Seeker query API
 * (seeker/models/query.py + docs/serverless-frontend-plan.md).
 *
 * Two retrieval modes share one backend:
 *   • form mode   — structured hard filters  → GET  /api/listings
 *   • prompt mode — natural-language / RAG    → POST /api/chat
 */

import type { Listing } from './listing.model';

/** Structured filter request. Mirrors QueryRequest's form-mode fields, plus
 *  the inference_output facets that are planned as hard filters. */
export interface ListingFilters {
  city?: string | null;
  district?: string | null;
  lat?: number | null;
  lon?: number | null;
  radius_km?: number | null;
  max_cost?: number | null;
  /** "strict" drops listings with an incomplete cost breakdown. */
  cost_mode: 'strict' | 'inclusive';
  min_rooms?: number | null;
  furnished?: boolean | null;

  // Candidate enrichment facets (planned hard filters).
  design_style?: string | null;
  condition?: string | null;
  brightness?: string | null;
  /** Amenity facet keys (e.g. "has_balcony") the user requires as "yes". */
  amenities?: string[];

  limit: number;
}

/** Per-source availability, mirrors SourceStatus. */
export interface SourceStatus {
  available: boolean;
  last_successful_reach_at?: string | null;
  message?: string | null;
}

/** Mirrors QueryResponse. */
export interface QueryResponse {
  listings: Listing[];
  total_matched: number;
  source_availability: Record<string, SourceStatus>;
  excluded_geocode_failed: number;
}

export function emptyFilters(): ListingFilters {
  return {
    cost_mode: 'inclusive',
    amenities: [],
    limit: 20,
  };
}
