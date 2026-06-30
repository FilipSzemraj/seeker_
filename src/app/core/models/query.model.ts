/**
 * Search DTOs. The wire request/response shapes are the OpenAPI-generated
 * Pydantic contract (re-exported from `../api/models`); this file adds the few
 * frontend-only view types the workspace and the server-driven filter panel
 * need on top of them.
 *
 * Two retrieval modes share one results grid:
 *   • structured / form mode   — hard filters          → POST /query
 *   • semantic / prompt mode    — free-text description  → POST /retrieve (listings only)
 */
import type { Listing } from './listing.model';

export type {
  SourceStatus,
  QueryRequest,
  QueryResponse,
  RetrieveRequest,
  RetrieveResponse,
  QuotaSnapshot,
} from '../api/models';

/** A point + radius geographic area, as picked on the map. */
export interface GeoArea {
  lat: number;
  lon: number;
  radius_km: number;
}

/**
 * Value of one server-driven filter field, keyed by `FilterField.key`.
 * BOOLEAN fields are tri-state — `true` / `false` / `null` (unset); the request
 * builder maps `facets` booleans to the `"yes"` / `"no"` strings the API wants.
 */
export type FilterValue = string | number | boolean | null;

/** The whole filter form's state: `fieldKey -> value`. */
export type FilterValues = Record<string, FilterValue>;

/**
 * A listing as rendered in the shared grid, plus its retrieval score. `score`
 * is a 0..1 similarity for semantic (`/retrieve`) results and `null` for
 * structured (`/query`) results, which the backend does not score.
 */
export interface ScoredListingView {
  listing: Listing;
  score: number | null;
}
