/**
 * Frontend mirror of the canonical `Listing` document served by the Seeker
 * query API (see seeker/models/listing.py). Only the user-facing fields a card
 * or filter needs are modelled here — pipeline/provenance metadata is omitted.
 *
 * The `enrichment` block holds the listing-enrichment facets defined in
 * config/inference_output.yml. They are not persisted on the backend `Listing`
 * yet, but are planned, so they are typed here as optional and treated as
 * candidate hard filters / display chips ahead of time.
 */

export type SourceAdapter = 'olx' | 'otodom' | 'facebook';

/** Tri-state amenity facet (yes | no | unknown) per inference_output.yml. */
export type TriState = 'yes' | 'no' | 'unknown';

export type DesignStyle =
  | 'modern'
  | 'scandinavian'
  | 'industrial(loft)'
  | 'minimalist'
  | 'classic'
  | 'boho'
  | 'vintage'
  | 'art-deco'
  | 'other';

export type Condition = 'new' | 'excellent' | 'good' | 'fair' | 'poor';
export type Brightness = 'bright' | 'moderate' | 'dim' | 'unknown';
export type Flooring =
  | 'wood-parquet'
  | 'laminate'
  | 'tile'
  | 'vinyl'
  | 'carpet'
  | 'concrete'
  | 'other'
  | 'unknown';

export interface ListingImage {
  url: string;
  description?: string | null;
}

export interface CostComponents {
  rent?: number | null;
  admin_fee?: number | null;
  utilities_estimated?: number | null;
}

export interface GeoFields {
  city?: string | null;
  district?: string | null;
  street?: string | null;
  lat?: number | null;
  lon?: number | null;
}

/** Listing-enrichment facets (config/inference_output.yml). */
export interface ListingEnrichment {
  design_style?: DesignStyle;
  condition?: Condition;
  brightness?: Brightness;
  flooring?: Flooring;
  tags?: string[];

  has_balcony?: TriState;
  has_terrace?: TriState;
  has_garden?: TriState;
  has_elevator?: TriState;
  has_parking?: TriState;
  has_furniture?: TriState;
  has_separate_kitchen?: TriState;
  has_fireplace?: TriState;
  has_air_conditioning?: TriState;
  has_dishwasher?: TriState;
  has_washer_dryer?: TriState;
  has_oven?: TriState;
  has_microwave?: TriState;
  has_gas_stove?: TriState;
  has_electric_stove?: TriState;
  has_bathtub?: TriState;
  has_walkin_shower?: TriState;
  has_walkin_closet?: TriState;
  has_high_ceiling?: TriState;
}

export interface Listing {
  /** Canonical link to the original portal listing — used to open the offer. */
  source_url: string;
  source_adapter: SourceAdapter;

  title?: string | null;
  description?: string | null;
  area_m2?: number | null;
  rooms?: number | null;
  floor?: string | null;
  building_type?: string | null;
  furnished?: boolean | null;
  images: ListingImage[];

  cost_components: CostComponents;
  total_monthly_cost?: number | null;
  /** True until the cost breakdown is confirmed complete (defaults true). */
  cost_incomplete: boolean;

  base_location_text?: string | null;
  geo: GeoFields;

  enrichment?: ListingEnrichment;
}
