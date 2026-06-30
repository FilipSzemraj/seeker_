/**
 * Client-side geographic narrowing.
 *
 * The map area is a *view-level* filter: picking or resizing it must NOT hit the
 * backend — it just hides result cards/pins whose coordinates fall outside the
 * circle. This is the in-memory companion to the server-side `lat/lon/radius_km`
 * that `POST /query` accepts (see `request-builder.ts`); a dedicated "Search this
 * area" action is what actually re-runs the search server-side with the radius.
 */
import type { GeoArea, ScoredListingView } from '../models/query.model';

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two lat/lon points, in kilometres. */
export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Keep only the results inside `area`. With no area, the list is returned
 * unchanged. Listings without coordinates are dropped while an area is active —
 * the same exclusion the server applies for a geo filter (geocode failures).
 */
export function narrowByArea(
  results: ScoredListingView[],
  area: GeoArea | null,
): ScoredListingView[] {
  if (!area) return results;
  return results.filter(({ listing }) => {
    const { lat, lon } = listing.geo;
    return (
      lat != null && lon != null && haversineKm(lat, lon, area.lat, area.lon) <= area.radius_km
    );
  });
}
