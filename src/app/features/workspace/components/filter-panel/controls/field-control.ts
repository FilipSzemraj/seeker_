import { Component, computed, input, output } from '@angular/core';

import type { FilterField } from '../../../../../core/api/models';
import type { FilterValue } from '../../../../../core/models/query.model';
import { FieldType, hasBit, widgetKind } from '../../../../../core/api/field-type';
import { FilterText } from './filter-text';
import { FilterNumber } from './filter-number';
import { FilterBoolean } from './filter-boolean';
import { FilterSelect } from './filter-select';
import { FilterMultiselect } from './filter-multiselect';

/**
 * Bitmask → component dispatcher. Given one server-driven `FilterField`, it
 * AND-checks the `type` bitmask (via `widgetKind`) and renders the matching
 * leaf control — the single place that maps a widget bit to a sub-component:
 *
 *   SELECT (8)      → app-filter-select
 *   MULTISELECT (16)→ app-filter-multiselect
 *   BOOLEAN (4)     → app-filter-boolean   (tri-state)
 *   NUMBER (1)      → app-filter-number
 *   TEXT (2)        → app-filter-text
 *   RANGE/GEO       → unsupported (not emitted yet)
 *
 * Flag bits are handled here too: `BLUR` (256) masks the value for non-entitled
 * tiers; `READONLY` (1024) renders the control disabled. `ADVANCED` (512) is a
 * layout concern handled one level up, by the filter panel.
 */
@Component({
  selector: 'app-field-control',
  imports: [FilterText, FilterNumber, FilterBoolean, FilterSelect, FilterMultiselect],
  template: `
    <div class="ctl" [class.ctl--blurred]="masked()">
      @switch (kind()) {
        @case ('select') {
          <app-filter-select [field]="field()" [value]="value()" [disabled]="readonly()" (valueChange)="valueChange.emit($event)" />
        }
        @case ('multiselect') {
          <app-filter-multiselect [field]="field()" [value]="value()" [disabled]="readonly()" (valueChange)="valueChange.emit($event)" />
        }
        @case ('boolean') {
          <app-filter-boolean [field]="field()" [value]="value()" [disabled]="readonly()" (valueChange)="valueChange.emit($event)" />
        }
        @case ('number') {
          <app-filter-number [field]="field()" [value]="value()" [disabled]="readonly()" (valueChange)="valueChange.emit($event)" />
        }
        @case ('text') {
          <app-filter-text [field]="field()" [value]="value()" [disabled]="readonly()" (valueChange)="valueChange.emit($event)" />
        }
      }

      @if (masked()) {
        <div class="ctl__lock" aria-hidden="true">
          <span class="ctl__lock-badge data">PRO</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .ctl {
        position: relative;
      }
      .ctl--blurred :is(input, button, select) {
        filter: blur(3px);
        pointer-events: none;
        user-select: none;
      }
      .ctl__lock {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: flex-start;
        justify-content: flex-end;
      }
      .ctl__lock-badge {
        font-size: 0.62rem;
        letter-spacing: 0.12em;
        padding: 0.1rem 0.4rem;
        border-radius: 999px;
        background: var(--accent);
        color: var(--paper);
      }
    `,
  ],
})
export class FieldControl {
  readonly field = input.required<FilterField>();
  readonly value = input<FilterValue>(null);
  /** Whether the user's tier is entitled to see BLUR-flagged values. */
  readonly entitled = input(false);
  readonly valueChange = output<FilterValue>();

  protected readonly kind = computed(() => widgetKind(this.field().type));

  /** READONLY (1024) — render the control disabled. */
  protected readonly readonly = computed(() => hasBit(this.field().type, FieldType.READONLY));

  /** BLUR (256) and the caller is not entitled → mask the value. */
  protected readonly masked = computed(
    () => hasBit(this.field().type, FieldType.BLUR) && !this.entitled(),
  );
}
