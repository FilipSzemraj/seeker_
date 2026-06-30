/**
 * Wire → view mapping for listings.
 *
 * The backend `Listing` (OpenAPI `ApiListing`) nests the advertised-flat content
 * under `details`, with geo under `details.geo` and the enrichment facet blob
 * under `details.categorization`. The card / map components consume the flatter
 * `Listing` view model (see `listing.model.ts`). This is the single
 * anti-corruption boundary that flattens one into the other.
 */
import type { Listing, ListingEnrichment, SourceAdapter } from '../models/listing.model';
import type { ApiListing } from '../api/models';

/** Flatten a wire listing into the view model the components render. */
export function toListingView(w: ApiListing): Listing {
  const d = w.details;
  return {
    source_url: w.source_url,
    // Wire `source_adapter` is an open string; the known adapters are
    // olx / otodom / facebook. Unknown values fall through as-is.
    source_adapter: w.source_adapter as SourceAdapter,
    title: d.title ?? null,
    description: d.description ?? null,
    area_m2: d.area_m2 ?? null,
    rooms: d.rooms ?? null,
    floor: d.floor ?? null,
    building_type: d.building_type ?? null,
    furnished: d.furnished ?? null,
    images: d.images ?? [],
    cost_components: {
      rent: d.cost_components?.rent ?? null,
      admin_fee: d.cost_components?.admin_fee ?? null,
      utilities_estimated: d.cost_components?.utilities_estimated ?? null,
    },
    total_monthly_cost: d.total_monthly_cost ?? null,
    cost_incomplete: d.cost_incomplete ?? true,
    base_location_text: d.base_location_text ?? null,
    geo: {
      city: d.geo?.city ?? null,
      district: d.geo?.district ?? null,
      street: d.geo?.street ?? null,
      lat: d.geo?.lat ?? null,
      lon: d.geo?.lon ?? null,
    },
    enrichment: mapEnrichment(d.categorization),
  };
}

/**
 * The categorization blob is a dynamic, YAML-driven dict (`extra=allow` on the
 * backend) whose keys already line up with `ListingEnrichment`
 * (design_style, condition, brightness, flooring, tags, has_* tri-states). We
 * pass it through as the enrichment view; unknown extra keys are harmless.
 */
function mapEnrichment(categorization: Record<string, unknown> | undefined): ListingEnrichment {
  return (categorization ?? {}) as ListingEnrichment;
}
