/**
 * Builds `/query` and `/retrieve` request bodies from the server-driven filter
 * schema plus the user's filter values. This is what keeps the same screen
 * working for other verticals (cars, bikes) with no rewrite: nothing here knows
 * any field name — every value is routed purely off the field's `target` and
 * `modes` metadata.
 *
 * Routing rule (per field the user set, for the active mode only):
 *   target.in === "body"   → top-level request field `target.name`
 *   target.in === "facets" → `facets[target.name] = value`
 *
 * Mapping nuances honoured here:
 *   • BOOLEAN tri-state amenities (facets) → the string "yes" / "no"; the facet
 *     is omitted entirely when unset.
 *   • BOOLEAN body fields (e.g. elevator / furnished) stay real booleans.
 *   • cost_mode is a body SELECT (strict / inclusive) — routed as a plain body
 *     string like any other SELECT.
 *   • tags is MULTISELECT open-vocabulary; values are strings, so a single tag
 *     string is sent for now. TODO: multi-tag needs backend support (the facets
 *     map is `{string: string}`, one value per facet).
 */
import type { FilterField, QueryRequest, RetrieveRequest } from '../api/models';
import { FieldType, hasBit } from '../api/field-type';
import type { FilterValues } from '../models/query.model';

type SearchMode = 'query' | 'retrieve';

interface Collected {
  body: Record<string, string | number | boolean>;
  facets: Record<string, string>;
}

/** True when a value should be treated as "set" (sent to the backend). */
function isSet(v: unknown): boolean {
  return v !== null && v !== undefined && v !== '';
}

/** Route every set, mode-applicable field value into body / facets buckets. */
function collect(fields: FilterField[], values: FilterValues, mode: SearchMode): Collected {
  const body: Record<string, string | number | boolean> = {};
  const facets: Record<string, string> = {};

  for (const field of fields) {
    if (hasBit(field.type, FieldType.READONLY)) continue; // display-only
    if (!field.modes.includes(mode)) continue; // mode doesn't accept this field
    const value = values[field.key];
    if (!isSet(value)) continue;

    if (field.target.in === 'facets') {
      // Facets are a string→string map. Booleans become "yes"/"no".
      if (typeof value === 'boolean') {
        facets[field.target.name] = value ? 'yes' : 'no';
      } else {
        facets[field.target.name] = String(value);
      }
    } else {
      // Body fields keep their native type (number / boolean / string).
      body[field.target.name] = value as string | number | boolean;
    }
  }

  return { body, facets };
}

/** Assemble a structured-mode `POST /query` body. `/query` accepts everything. */
export function buildQueryRequest(
  fields: FilterField[],
  values: FilterValues,
  opts: { limit?: number; geo?: { lat: number; lon: number; radius_km: number } | null } = {},
): QueryRequest {
  const { body, facets } = collect(fields, values, 'query');
  const req = {
    ...body,
    facets,
    limit: opts.limit ?? 20,
  } as QueryRequest;

  // The map-picked area is a GEO filter (bit reserved, not schema-driven yet),
  // so it is merged straight onto the body here.
  if (opts.geo) {
    req.lat = opts.geo.lat;
    req.lon = opts.geo.lon;
    req.radius_km = opts.geo.radius_km;
  }
  return req;
}

/**
 * Assemble a semantic-mode `POST /retrieve` body. `/retrieve` only accepts
 * `query`, `city`, `district`, `max_cost` and the categorization facets — the
 * schema's `modes` already exclude rooms/area/floor/cost_mode/… from retrieve,
 * so `collect()` naturally yields only the allowed body fields.
 */
export function buildRetrieveRequest(
  fields: FilterField[],
  prompt: string,
  values: FilterValues,
  opts: {
    k?: number;
    rerank?: boolean;
    geo?: { lat: number; lon: number; radius_km: number } | null;
  } = {},
): RetrieveRequest {
  const { body, facets } = collect(fields, values, 'retrieve');
  const req: RetrieveRequest = {
    query: prompt,
    facets,
    rerank: opts.rerank ?? false,
  };
  if (typeof body['city'] === 'string') req.city = body['city'];
  if (typeof body['district'] === 'string') req.district = body['district'];
  if (typeof body['max_cost'] === 'number') req.max_cost = body['max_cost'];
  if (opts.k != null) req.k = opts.k;

  // Forward-compatible geo: the backend `RetrieveRequest` does not yet accept a
  // radius (Pydantic ignores the extra keys), so today a map area on the prompt
  // search only narrows results client-side. Sending it now means the server
  // can start honouring it with no frontend change — just regenerate types.ts.
  if (opts.geo) {
    const withGeo = req as RetrieveRequest & {
      lat: number;
      lon: number;
      radius_km: number;
    };
    withGeo.lat = opts.geo.lat;
    withGeo.lon = opts.geo.lon;
    withGeo.radius_km = opts.geo.radius_km;
  }
  return req;
}
