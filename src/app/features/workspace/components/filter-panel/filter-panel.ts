import { Component, computed, output, signal } from '@angular/core';

import { emptyFilters, type ListingFilters } from '../../../../core/models/query.model';

interface Option {
  value: string;
  label: string;
}

const DESIGN_STYLES: Option[] = [
  { value: 'modern', label: 'Modern' },
  { value: 'scandinavian', label: 'Scandinavian' },
  { value: 'industrial(loft)', label: 'Industrial / loft' },
  { value: 'minimalist', label: 'Minimalist' },
  { value: 'classic', label: 'Classic' },
  { value: 'boho', label: 'Boho' },
  { value: 'vintage', label: 'Vintage' },
  { value: 'art-deco', label: 'Art deco' },
];

const CONDITIONS: Option[] = [
  { value: 'new', label: 'New' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
];

const BRIGHTNESS: Option[] = [
  { value: 'bright', label: 'Bright' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'dim', label: 'Dim' },
];

const AMENITIES: Option[] = [
  { value: 'has_balcony', label: 'Balcony' },
  { value: 'has_terrace', label: 'Terrace' },
  { value: 'has_garden', label: 'Garden' },
  { value: 'has_elevator', label: 'Lift' },
  { value: 'has_parking', label: 'Parking' },
  { value: 'has_furniture', label: 'Furnished' },
  { value: 'has_separate_kitchen', label: 'Separate kitchen' },
  { value: 'has_dishwasher', label: 'Dishwasher' },
  { value: 'has_washer_dryer', label: 'Washer' },
  { value: 'has_air_conditioning', label: 'Air conditioning' },
  { value: 'has_walkin_shower', label: 'Walk-in shower' },
  { value: 'has_high_ceiling', label: 'High ceilings' },
];

/**
 * Structured hard-filter form. Each control maps to a field the backend can
 * filter on exactly (QueryRequest fields + planned inference_output facets).
 * State is signal-driven; "Search" emits the assembled filters to the parent.
 */
@Component({
  selector: 'app-filter-panel',
  templateUrl: './filter-panel.html',
  styleUrl: './filter-panel.scss',
})
export class FilterPanel {
  readonly apply = output<ListingFilters>();

  protected readonly designStyles = DESIGN_STYLES;
  protected readonly conditions = CONDITIONS;
  protected readonly brightness = BRIGHTNESS;
  protected readonly amenityOptions = AMENITIES;
  protected readonly roomOptions = [1, 2, 3, 4];

  protected readonly draft = signal<ListingFilters>(emptyFilters());

  protected readonly activeAmenities = computed(() => new Set(this.draft().amenities ?? []));

  protected patch(patch: Partial<ListingFilters>): void {
    this.draft.update((d) => ({ ...d, ...patch }));
  }

  protected setMaxCost(raw: string): void {
    const n = raw.trim() === '' ? null : Number(raw);
    this.patch({ max_cost: typeof n === 'number' && Number.isFinite(n) ? n : null });
  }

  protected setText(key: 'city' | 'district', raw: string): void {
    const value = raw.trim() === '' ? null : raw;
    if (key === 'city') this.patch({ city: value });
    else this.patch({ district: value });
  }

  protected toggleRooms(n: number): void {
    this.patch({ min_rooms: this.draft().min_rooms === n ? null : n });
  }

  protected setFurnished(value: boolean | null): void {
    this.patch({ furnished: this.draft().furnished === value ? null : value });
  }

  protected setCostMode(mode: 'strict' | 'inclusive'): void {
    this.patch({ cost_mode: mode });
  }

  protected selectOne(key: 'design_style' | 'condition' | 'brightness', value: string): void {
    const next = this.draft()[key] === value ? null : value;
    if (key === 'design_style') this.patch({ design_style: next });
    else if (key === 'condition') this.patch({ condition: next });
    else this.patch({ brightness: next });
  }

  protected toggleAmenity(value: string): void {
    this.draft.update((d) => {
      const set = new Set(d.amenities ?? []);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...d, amenities: [...set] };
    });
  }

  protected clear(): void {
    this.draft.set(emptyFilters());
    this.apply.emit(this.draft());
  }

  protected submit(): void {
    this.apply.emit(this.draft());
  }
}
