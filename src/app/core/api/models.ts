/**
 * Thin, friendly aliases over the OpenAPI-generated `types.ts` so the rest of
 * the app imports stable names instead of `components['schemas'][...]`. These
 * shapes are NOT hand-maintained — they are re-exports of the generated
 * Pydantic contract. Regenerate `types.ts` with:
 *
 *   npx openapi-typescript http://localhost:8000/openapi.json \
 *     -o src/app/core/api/types.ts
 */
import type { components } from './types';

type Schemas = components['schemas'];

/** Canonical wire listing (content nested under `details` / `details.geo` …). */
export type ApiListing = Schemas['Listing'];
export type ApiListingDetails = Schemas['ListingDetails'];
export type ApiGeoFields = Schemas['GeoFields'];
export type ApiCostComponents = Schemas['CostComponents'];
export type ApiListingImage = Schemas['ListingImage'];

export type QueryRequest = Schemas['QueryRequest'];
export type QueryResponse = Schemas['QueryResponse'];
export type RetrieveRequest = Schemas['RetrieveRequest'];
export type RetrieveResponse = Schemas['RetrieveResponse'];
export type ScoredListing = Schemas['ScoredListing'];

export type FilterSchemaResponse = Schemas['FilterSchemaResponse'];
export type FilterField = Schemas['FilterField'];
export type FilterOption = Schemas['FilterOption'];
export type FieldTarget = Schemas['FieldTarget'];

export type ModesResponse = Schemas['ModesResponse'];
export type ModeInfo = Schemas['ModeInfo'];

export type QuotaSnapshot = Schemas['QuotaSnapshot'];
export type SourceStatus = Schemas['SourceStatus'];

/**
 * `GET /usage` returns a `QuotaSnapshot` when authenticated, but the literal
 * `{ tier: "unlimited", auth: "disabled" }` when auth is switched off locally.
 * Narrow with `isQuota()` below.
 */
export type AuthDisabledUsage = { tier: string; auth: string };
export type UsageResponse = QuotaSnapshot | AuthDisabledUsage;

/** True when a `/usage` payload is a real metered quota (auth enabled). */
export function isQuota(usage: UsageResponse | null): usage is QuotaSnapshot {
  return usage != null && 'period' in usage;
}
