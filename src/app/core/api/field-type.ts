/**
 * The `FilterField.type` bitmask (canonical reference:
 * `config/filter_schema.md` in the backend repo). A field's `type` is a single
 * integer ORing one widget bit with zero or more flag bits; the frontend
 * AND-checks each bit to decide which control to render and how to treat it.
 *
 *   const isSelect   = hasBit(field.type, FieldType.SELECT);
 *   const isAdvanced = hasBit(field.type, FieldType.ADVANCED);
 */
export const FieldType = {
  // Widget bits — which control to render.
  NUMBER: 1,
  TEXT: 2,
  BOOLEAN: 4, // tri-state yes / no / unset
  SELECT: 8, // single choice from options
  MULTISELECT: 16, // multi choice; options may be empty (open vocabulary)
  RANGE: 32, // min/max pair
  GEO: 64, // reserved — not emitted yet
  // Flag bits — how to treat the field.
  BLUR: 256, // mask value unless the user's tier entitles them
  ADVANCED: 512, // render under a collapsed "advanced filters" section
  READONLY: 1024, // display-only, not submittable
} as const;

export type FieldTypeBit = (typeof FieldType)[keyof typeof FieldType];

/** AND-check: true when `type` has `bit` set. */
export function hasBit(type: number, bit: FieldTypeBit): boolean {
  return (type & bit) === bit;
}

/** Widget kinds the dispatcher selects between (in priority order). */
export type WidgetKind = 'select' | 'multiselect' | 'boolean' | 'number' | 'text' | 'unsupported';

/**
 * Resolve a field's widget kind by AND-checking its bitmask. SELECT/MULTISELECT
 * win over the primitive bits because an enum facet may carry both. GEO/RANGE
 * are not rendered yet → 'unsupported'.
 */
export function widgetKind(type: number): WidgetKind {
  if (hasBit(type, FieldType.SELECT)) return 'select';
  if (hasBit(type, FieldType.MULTISELECT)) return 'multiselect';
  if (hasBit(type, FieldType.BOOLEAN)) return 'boolean';
  if (hasBit(type, FieldType.NUMBER)) return 'number';
  if (hasBit(type, FieldType.TEXT)) return 'text';
  return 'unsupported';
}
