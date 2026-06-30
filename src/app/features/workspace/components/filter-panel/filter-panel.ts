import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';

import type { FilterField } from '../../../../core/api/models';
import type { FilterValue, FilterValues, GeoArea } from '../../../../core/models/query.model';
import { FieldType, hasBit } from '../../../../core/api/field-type';
import { FieldControl } from './controls/field-control';

/** Display order + labels for the `section` grouping hint from /filters. */
const SECTION_ORDER: { key: string; label: string }[] = [
  { key: 'location', label: 'Location' },
  { key: 'budget', label: 'Budget' },
  { key: 'size', label: 'Size' },
  { key: 'building', label: 'Building' },
  { key: 'style', label: 'Style' },
  { key: 'amenities', label: 'Amenities' },
  { key: 'features', label: 'Features' },
];

interface SectionGroup {
  key: string;
  label: string;
  fields: FilterField[];
}

/**
 * Structured (form-mode) filter form, rendered ENTIRELY from the server-driven
 * `/filters` schema — no hardcoded option lists. Fields are grouped by their
 * `section`, each rendered by `app-field-control` (which picks a widget by
 * AND-checking the bitmask). ADVANCED-flagged fields move into a collapsible
 * section. "Search" emits the assembled `FilterValues` to the parent, which
 * turns them into a `/query` request via the schema-driven request builder.
 */
@Component({
  selector: 'app-filter-panel',
  imports: [FieldControl],
  templateUrl: './filter-panel.html',
  styleUrl: './filter-panel.scss',
})
export class FilterPanel {
  /** The filter fields from GET /filters. */
  readonly fields = input<FilterField[]>([]);
  /** Whether the caller's tier may see BLUR-flagged values. */
  readonly entitled = input(false);
  /** The map's currently-selected point + radius, when the map is open. */
  readonly geo = input<GeoArea | null>(null);
  /** Whether the map is open — gates the editable lat/lon point field. */
  readonly mapOpen = input(false);
  readonly apply = output<FilterValues>();
  /** Live geo edits from the lat/lon field — mirrors the map's own changes. */
  readonly geoChange = output<GeoArea | null>();

  protected readonly draft = signal<FilterValues>({});
  protected readonly advancedOpen = signal(false);

  // Editable mirrors of the selected map point; reset whenever the map's geo
  // changes (e.g. the user drops/drags a pin) and committed back on edit.
  protected readonly latDraft = linkedSignal(() => formatCoord(this.geo()?.lat));
  protected readonly lonDraft = linkedSignal(() => formatCoord(this.geo()?.lon));

  /** Query-mode fields only (the panel runs /query). */
  private readonly queryFields = computed(() =>
    this.fields().filter((f) => f.modes.includes('query') && !hasBit(f.type, FieldType.READONLY)),
  );

  protected readonly mainSections = computed(() =>
    this.group(this.queryFields().filter((f) => !hasBit(f.type, FieldType.ADVANCED))),
  );

  protected readonly advancedSections = computed(() =>
    this.group(this.queryFields().filter((f) => hasBit(f.type, FieldType.ADVANCED))),
  );

  protected readonly hasAdvanced = computed(() => this.advancedSections().length > 0);

  protected valueOf(key: string): FilterValue {
    return this.draft()[key] ?? null;
  }

  protected setValue(key: string, value: FilterValue): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }

  protected clear(): void {
    this.draft.set({});
    this.apply.emit({});
  }

  protected submit(): void {
    this.apply.emit(this.draft());
  }

  /**
   * Push a manually-typed point to the map. Clearing both fields removes the
   * area; a valid lat/lon pair drops/moves the pin (keeping the current radius).
   */
  protected commitPoint(): void {
    const latRaw = this.latDraft().trim();
    const lonRaw = this.lonDraft().trim();
    if (latRaw === '' && lonRaw === '') {
      this.geoChange.emit(null);
      return;
    }
    // An incomplete pair is neither a clear nor a valid point — wait for both.
    if (latRaw === '' || lonRaw === '') return;
    const lat = Number(latRaw);
    const lon = Number(lonRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return;
    this.geoChange.emit({ lat, lon, radius_km: this.geo()?.radius_km ?? 2 });
  }

  /** Group fields by `section` in the canonical display order. */
  private group(fields: FilterField[]): SectionGroup[] {
    const groups: SectionGroup[] = [];
    for (const { key, label } of SECTION_ORDER) {
      const inSection = fields.filter((f) => f.section === key);
      if (inSection.length) groups.push({ key, label, fields: inSection });
    }
    // Any field whose section isn't in the known order still gets shown.
    const known = new Set(SECTION_ORDER.map((s) => s.key));
    const rest = fields.filter((f) => !known.has(f.section));
    if (rest.length) groups.push({ key: 'other', label: 'Other', fields: rest });
    return groups;
  }
}

/** Coordinate → input string, trimmed to ~5 decimals (≈1 m precision). */
function formatCoord(n: number | undefined): string {
  return n == null ? '' : String(Math.round(n * 1e5) / 1e5);
}
