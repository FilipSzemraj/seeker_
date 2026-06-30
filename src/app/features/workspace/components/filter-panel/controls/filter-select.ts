import { Component, input, output } from '@angular/core';

import type { FilterField } from '../../../../../core/api/models';

/**
 * SELECT widget (bit 8) — single choice from `field.options`. Rendered as
 * toggle pills so cost_mode / design_style / condition all share one control.
 * Re-clicking the active option clears it (back to "Any").
 */
@Component({
  selector: 'app-filter-select',
  template: `
    <div class="fld">
      <span class="fld__label eyebrow">{{ field().label }}</span>
      <div class="pills" role="group" [attr.aria-label]="field().label">
        @for (opt of field().options ?? []; track opt.value) {
          <button
            type="button"
            class="pill-btn"
            [class.is-on]="value() === opt.value"
            [disabled]="disabled()"
            [attr.aria-pressed]="value() === opt.value"
            (click)="toggle(opt.value)"
          >
            {{ opt.label }}
          </button>
        }
      </div>
    </div>
  `,
})
export class FilterSelect {
  readonly field = input.required<FilterField>();
  readonly value = input<string | number | boolean | null>(null);
  readonly disabled = input(false);
  readonly valueChange = output<string | null>();

  protected toggle(value: string): void {
    this.valueChange.emit(this.value() === value ? null : value);
  }
}
