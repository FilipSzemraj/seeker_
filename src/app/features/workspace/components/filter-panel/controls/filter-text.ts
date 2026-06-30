import { Component, input, output } from '@angular/core';

import type { FilterField } from '../../../../../core/api/models';

/** TEXT widget (bit 2) — a single free-text input (city, district, floor…). */
@Component({
  selector: 'app-filter-text',
  template: `
    <label class="fld">
      <span class="fld__label eyebrow">{{ field().label }}</span>
      <span class="fld__input">
        <input
          type="text"
          [value]="(value() ?? '') + ''"
          [disabled]="disabled()"
          [attr.placeholder]="field().label"
          (input)="emit($any($event.target).value)"
        />
      </span>
    </label>
  `,
})
export class FilterText {
  readonly field = input.required<FilterField>();
  readonly value = input<string | number | boolean | null>(null);
  readonly disabled = input(false);
  readonly valueChange = output<string | null>();

  protected emit(raw: string): void {
    const trimmed = raw.trim();
    this.valueChange.emit(trimmed === '' ? null : raw);
  }
}
