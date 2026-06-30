import { Component, computed, input, output } from '@angular/core';

import type { FilterField } from '../../../../../core/api/models';

/** NUMBER widget (bit 1) — a single numeric input (max_cost, rooms, area…). */
@Component({
  selector: 'app-filter-number',
  template: `
    <label class="fld">
      <span class="fld__label eyebrow">{{ field().label }}</span>
      <span class="fld__input" [class.fld__input--money]="isMoney()">
        <input
          type="number"
          inputmode="numeric"
          min="0"
          [value]="value() ?? ''"
          [disabled]="disabled()"
          [attr.placeholder]="field().label"
          (input)="emit($any($event.target).value)"
        />
        @if (isMoney()) {
          <span class="fld__suffix data" aria-hidden="true">zł</span>
        }
      </span>
    </label>
  `,
})
export class FilterNumber {
  readonly field = input.required<FilterField>();
  readonly value = input<string | number | boolean | null>(null);
  readonly disabled = input(false);
  readonly valueChange = output<number | null>();

  protected readonly isMoney = computed(() => this.field().target.name === 'max_cost');

  protected emit(raw: string): void {
    if (raw.trim() === '') {
      this.valueChange.emit(null);
      return;
    }
    const n = Number(raw);
    this.valueChange.emit(Number.isFinite(n) ? n : null);
  }
}
