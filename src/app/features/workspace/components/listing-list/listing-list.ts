import { Component, computed, input, output } from '@angular/core';

import type { SourceStatus } from '../../../../core/models/query.model';
import type { ScoredListingView } from '../../../../core/models/query.model';
import { ListingCard } from '../listing-card/listing-card';

interface SourceLine {
  name: string;
  available: boolean;
  message?: string | null;
}

const SOURCE_LABEL: Record<string, string> = {
  otodom: 'Otodom',
  olx: 'OLX',
  facebook: 'Facebook',
};

/**
 * The results grid shown under the search bar — the shared output of BOTH the
 * structured filter search (`/query`) and the semantic prompt search
 * (`/retrieve`). Purely presentational. Cards show a per-result score when one
 * is present (semantic mode); structured results carry `score: null`.
 */
@Component({
  selector: 'app-listing-list',
  imports: [ListingCard],
  templateUrl: './listing-list.html',
  styleUrl: './listing-list.scss',
})
export class ListingList {
  readonly results = input<ScoredListingView[]>([]);
  readonly loading = input(false);
  readonly hasSearched = input(false);
  readonly total = input(0);
  /** Short note on where these results came from (e.g. a prompt). */
  readonly contextNote = input<string | undefined>(undefined);
  readonly sources = input<Record<string, SourceStatus>>({});
  /** `source_url` of the listing currently selected on the map, if any. */
  readonly selectedUrl = input<string | null>(null);
  /** Whether selecting a card is meaningful (map is open). */
  readonly selectable = input(false);
  /** Emits a listing's `source_url` when a card is picked from the list. */
  readonly select = output<string>();

  protected readonly sourceLines = computed<SourceLine[]>(() =>
    Object.entries(this.sources()).map(([key, status]) => ({
      name: SOURCE_LABEL[key] ?? key,
      available: status.available,
      message: status.message,
    })),
  );

  protected readonly skeletons = [0, 1, 2, 3, 4, 5];
}
