import { Component, computed, input } from '@angular/core';

import type { Listing, SourceAdapter } from '../../../../core/models/listing.model';

type CardVariant = 'full' | 'compact';

const SOURCE_LABEL: Record<SourceAdapter, string> = {
  otodom: 'Otodom',
  olx: 'OLX',
  facebook: 'Facebook',
};

const AMENITY_LABEL: Record<string, string> = {
  has_balcony: 'Balcony',
  has_terrace: 'Terrace',
  has_garden: 'Garden',
  has_elevator: 'Lift',
  has_parking: 'Parking',
  has_furniture: 'Furnished',
  has_separate_kitchen: 'Separate kitchen',
  has_fireplace: 'Fireplace',
  has_air_conditioning: 'Air conditioning',
  has_dishwasher: 'Dishwasher',
  has_washer_dryer: 'Washer',
  has_bathtub: 'Bathtub',
  has_walkin_shower: 'Walk-in shower',
  has_walkin_closet: 'Walk-in closet',
  has_high_ceiling: 'High ceilings',
};

/**
 * One listing, rendered identically in the results list and inline in chat.
 * `variant="compact"` trims it to a single row for the chat thread. The title
 * and footer link open the original portal listing (`source_url`) — there is
 * no in-app detail page; the card is the preview.
 */
@Component({
  selector: 'app-listing-card',
  templateUrl: './listing-card.html',
  styleUrl: './listing-card.scss',
  host: { '[class.is-compact]': "variant() === 'compact'" },
})
export class ListingCard {
  readonly listing = input.required<Listing>();
  readonly variant = input<CardVariant>('full');
  /** Optional "why it matched" line shown on chat result cards. */
  readonly reason = input<string | undefined>(undefined);

  protected readonly cover = computed(() => this.listing().images[0] ?? null);

  protected readonly sourceLabel = computed(() => SOURCE_LABEL[this.listing().source_adapter]);

  protected readonly locationText = computed(() => {
    const g = this.listing().geo;
    return [g.district, g.city].filter(Boolean).join(', ') || 'Location pending';
  });

  protected readonly specs = computed(() => {
    const l = this.listing();
    const out: string[] = [];
    if (l.rooms != null) out.push(`${l.rooms} ${l.rooms === 1 ? 'room' : 'rooms'}`);
    if (l.area_m2 != null) out.push(`${formatNumber(l.area_m2)} m²`);
    if (l.floor) out.push(formatFloor(l.floor));
    return out;
  });

  /** Headline cost + whether it's a confirmed total or a "from" estimate. */
  protected readonly cost = computed(() => {
    const l = this.listing();
    if (l.total_monthly_cost != null && !l.cost_incomplete) {
      return { value: `${formatNumber(l.total_monthly_cost)} zł`, label: 'per month, all in' };
    }
    const rent = l.cost_components.rent;
    if (rent != null) {
      return { value: `from ${formatNumber(rent)} zł`, label: 'rent — extra costs unconfirmed' };
    }
    return { value: 'Ask the lister', label: 'cost not stated' };
  });

  protected readonly amenities = computed(() => {
    const e = this.listing().enrichment;
    if (!e) return [];
    return Object.entries(AMENITY_LABEL)
      .filter(([key]) => (e as Record<string, unknown>)[key] === 'yes')
      .map(([, label]) => label)
      .slice(0, this.variant() === 'compact' ? 3 : 6);
  });

  protected readonly tags = computed(() => (this.listing().enrichment?.tags ?? []).slice(0, 4));

  protected readonly alt = computed(() => {
    const l = this.listing();
    return l.title ? `Photo of ${l.title}` : 'Listing photo';
  });
}

function formatNumber(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatFloor(floor: string): string {
  if (floor === 'parter') return 'Ground floor';
  const m = floor.match(/floor_(\d+)/);
  return m ? `Floor ${m[1]}` : floor;
}
