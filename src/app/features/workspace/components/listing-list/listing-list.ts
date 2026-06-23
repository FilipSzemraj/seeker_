import { Component, computed, input } from '@angular/core';

import type { Listing } from '../../../../core/models/listing.model';
import type { SourceStatus } from '../../../../core/models/query.model';
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
 * The results grid shown under the search bar — shared output of both the
 * filter search and the conversational search. Purely presentational.
 */
@Component({
  selector: 'app-listing-list',
  imports: [ListingCard],
  templateUrl: './listing-list.html',
  styleUrl: './listing-list.scss',
})
export class ListingList {
  readonly listings = input<Listing[]>([]);
  readonly loading = input(false);
  readonly hasSearched = input(false);
  readonly total = input(0);
  /** Short note on where these results came from (e.g. a chat prompt). */
  readonly contextNote = input<string | undefined>(undefined);
  readonly sources = input<Record<string, SourceStatus>>({});

  protected readonly sourceLines = computed<SourceLine[]>(() =>
    Object.entries(this.sources()).map(([key, status]) => ({
      name: SOURCE_LABEL[key] ?? key,
      available: status.available,
      message: status.message,
    })),
  );

  protected readonly skeletons = [0, 1, 2, 3, 4, 5];
}
