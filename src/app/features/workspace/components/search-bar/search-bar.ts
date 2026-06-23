import { Component, input, output, signal } from '@angular/core';

/**
 * The single entry point to both retrieval modes. Free text is sent to the
 * conversational agent; the "Filters" control reveals the structured panel.
 */
@Component({
  selector: 'app-search-bar',
  templateUrl: './search-bar.html',
  styleUrl: './search-bar.scss',
})
export class SearchBar {
  readonly busy = input(false);
  readonly activeFilterCount = input(0);
  readonly filtersOpen = input(false);

  readonly ask = output<string>();
  readonly toggleFilters = output<void>();

  protected readonly draft = signal('');

  protected submit(): void {
    const value = this.draft().trim();
    if (!value || this.busy()) return;
    this.ask.emit(value);
    this.draft.set('');
  }
}
