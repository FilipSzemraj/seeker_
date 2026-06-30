import { Component, input, output } from '@angular/core';

import type { FilterField } from '../../../../../core/api/models';

/**
 * MULTISELECT widget (bit 16). When `options` are present it behaves like a
 * multi-pill picker; when they are empty it is an open-vocabulary input (e.g.
 * `tags`).
 *
 * NOTE: the backend `facets` map is `{ string: string }` — one value per facet
 * — so for now we only carry a SINGLE tag string. The UI accepts free text and
 * emits that one value.
 * TODO: multi-tag needs backend support (an array-valued facet) before we can
 * send more than one tag.
 */
@Component({
  selector: 'app-filter-multiselect',
  template: `
    <label class="fld">
      <span class="fld__label eyebrow">{{ field().label }}</span>
      <span class="fld__input">
        <input
          type="text"
          [value]="(value() ?? '') + ''"
          [disabled]="disabled()"
          placeholder="e.g. mezzanine"
          (input)="emit($any($event.target).value)"
        />
      </span>
      <span class="fld__hint">One tag for now</span>
    </label>
  `,
})
export class FilterMultiselect {
  readonly field = input.required<FilterField>();
  readonly value = input<string | number | boolean | null>(null);
  readonly disabled = input(false);
  readonly valueChange = output<string | null>();

  protected emit(raw: string): void {
    const trimmed = raw.trim();
    // TODO: multi-tag needs backend support — only a single tag string is sent.
    this.valueChange.emit(trimmed === '' ? null : trimmed);
  }
}
