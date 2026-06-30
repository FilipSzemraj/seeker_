import { Component, input, output } from '@angular/core';

import type { FilterField } from '../../../../../core/api/models';

/**
 * BOOLEAN widget (bit 4) — a tri-state toggle (Any / Yes / No). Emits `true` /
 * `false` / `null`. For facet amenities ("Must have X"), Yes ⇒ `"yes"` is set
 * by the request builder; Any ⇒ the facet is omitted entirely.
 */
@Component({
  selector: 'app-filter-boolean',
  template: `
    <div class="fld">
      <span class="fld__label eyebrow">{{ field().label }}</span>
      <div class="seg" role="group" [attr.aria-label]="field().label">
        <button
          type="button"
          class="seg__btn"
          [class.is-on]="value() === null || value() === undefined"
          [disabled]="disabled()"
          (click)="valueChange.emit(null)"
        >
          Any
        </button>
        <button
          type="button"
          class="seg__btn"
          [class.is-on]="value() === true"
          [disabled]="disabled()"
          (click)="valueChange.emit(true)"
        >
          Yes
        </button>
        <button
          type="button"
          class="seg__btn"
          [class.is-on]="value() === false"
          [disabled]="disabled()"
          (click)="valueChange.emit(false)"
        >
          No
        </button>
      </div>
    </div>
  `,
})
export class FilterBoolean {
  readonly field = input.required<FilterField>();
  readonly value = input<string | number | boolean | null>(null);
  readonly disabled = input(false);
  readonly valueChange = output<boolean | null>();
}
