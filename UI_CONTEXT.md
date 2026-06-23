# Seeker — UI / Frontend Context

> **Point an agent here** before any task that touches the UI, adds a page, or builds a
> component. It is the distilled, authoritative description of how this frontend is built and
> what "fits" looks like, so you don't have to re-explain the conventions each time.
>
> This file is intentionally **not** loaded into every session (it lives outside `CLAUDE.md`).
> Reference it explicitly when the work is UI-shaped.

---

## 1. What this app is

**Seeker** is a rental-listing search frontend for Poland. It aggregates listings from major
portals (Otodom, OLX; Facebook planned), normalises them into one `Listing` shape, and lets a
user find a flat **two ways from one screen**:

1. **Conversational search** — free-text questions answered by a RAG agent that returns grounded
   prose plus the cited listings.
2. **Structured filter search** — exact hard filters over the clean catalogue.

Both paths render into **one shared results grid**. There is **no in-app detail page** — each
listing card *is* the preview, and links out to the original portal offer via `source_url`.

Backend architecture (Cognito + API Gateway + Lambda + Qdrant/Mongo/Anthropic, hosted on GitHub
Pages) lives in `../serverless-frontend-plan.md`. The canonical data models live in the Python
repo at `../../002-dev-stage-cli/seeker/models/` and the enrichment facets in
`../../002-dev-stage-cli/config/inference_output.yml`. For anything about backend behaviour,
**delegate to a subagent** rather than guessing — except the models themselves, which are
mirrored in `src/app/core/models/` and are direct input to UI work.

---

## 2. Stack & engineering conventions

- **Angular 22**, standalone components, **signals-first**, Vite build, SCSS.
- Full engineering rules are in **`AGENTS.md`** / **`.claude/CLAUDE.md`** (identical). Read them.
  The load-bearing ones, in practice:
  - Standalone components; **do not** set `standalone: true` or `changeDetection: OnPush`
    (both are defaults in v22).
  - State via **signals**; derived via **`computed()`**; never `.mutate()` — use `set`/`update`.
  - `input()` / `output()` functions, **not** decorators. `input.required<T>()` when mandatory.
  - **`inject()`**, not constructor injection. Singleton services use `providedIn: 'root'`.
  - Native control flow **`@if` / `@for` (with `track`) / `@switch`** — never the `*ng` forms.
  - **No `ngClass` / `ngStyle`** — use `[class.x]` and `[style.x]` bindings.
  - Host bindings go in the `host: {}` object — **no `@HostBinding` / `@HostListener`**.
  - Lazy-load feature routes (`loadComponent`). Guard protected routes (see §7).
  - Avoid `any`; use `unknown`. Prefer type inference when obvious.
  - Don't assume globals (`new Date()`, `crypto`) — reach them via `globalThis.` and guard.

- **File/folder shape** (mirror it exactly for new work):
  - `src/app/core/` — cross-cutting: `auth/`, `models/`, `search/` (services, guards,
    interceptors, model interfaces, mock data).
  - `src/app/features/<feature>/` — a routed screen as `<feature>.ts|html|scss`, with its
    private pieces under `components/<name>/<name>.ts|html|scss`.
  - **Three-file components** (external `.html` + `.scss`), templates/styles referenced by
    path relative to the `.ts`. Small leaf components may inline the template.
  - The owning feature component holds **all retrieval/state**; child components are
    presentational, talking up via `output()` and down via `input()`. `Workspace` is the
    reference example — read `features/workspace/workspace.ts`.

---

## 3. Design language

The whole product runs on **one design system**, defined as CSS custom properties in
`src/styles.scss`. **Always build from these tokens — never hard-code a hex, font, or raw px
spacing.** New UI must look like it shipped with the rest.

**Voice of the design:** *"Plaster & ink, one botanical accent."* Minimal, architectural, calm,
editorial. Warm off-white paper backgrounds, near-black warm ink, a single deep-moss green as the
only interactive accent. Small radii with pill-shaped chips/buttons for tension. Low, soft
shadows. A faint architectural plan-grid as the ambient motif. Generous whitespace, big confident
display type, mono for all structured data and labels. The reference north star is
yazdanistudio.com — restrained, typographic, intentional.

### Palette (CSS vars — use the var, not the hex)

| Token | Value | Role |
|---|---|---|
| `--paper` | `#f4f3ef` | page base (warm plaster) |
| `--paper-2` | `#eceae3` | recessed panels, inputs |
| `--paper-3` | `#e4e2d9` | hover wells, in-panel dividers |
| `--ink` | `#17150f` | primary text (warm near-black) |
| `--ink-2` | `#4a463c` | secondary body |
| `--stone` | `#6e685b` | captions / labels (AA on paper) |
| `--line` / `--line-strong` | `#d8d5cc` / `#c5c1b5` | hairlines / stronger dividers |
| `--accent` | `#3f5740` | deep moss — **interactive accent only** |
| `--accent-ink` | `#2c3d2d` | moss for text-on-paper (links) |
| `--accent-soft` | `#e4e8df` | moss wash — active chips, agent bubble |
| `--danger` | `#8a3b2f` | errors |
| `--white` | `#ffffff` | raised surfaces (search field, cards) |

Moss green is **reserved for interaction** (primary buttons, active state, links, accents).
Don't paint large areas with it.

### Type — three families, fixed roles

Loaded in `src/index.html` (Google Fonts), exposed as vars:

- `--font-display` **Bricolage Grotesque** — headings `h1–h4` (set globally: 700, tight
  `-0.02em`, line-height ~1.0). Hero uses weight 800 and very tight tracking.
- `--font-body` **Inter** — all body copy (base 1rem / 1.6).
- `--font-mono` **JetBrains Mono** — **all structured data and labels**: prices, specs, counts
  (`.data`, with `tabular-nums`) and the uppercase tracked eyebrow/kicker (`.eyebrow`).

### Tokens for spacing, radius, shadow

- Spacing scale `--s-1`(.25rem) … `--s-9`(7rem). Use these, not arbitrary px.
- Radius: `--r-sm` 4px, `--r-md` 8px, `--r-pill` 999px (chips & buttons).
- Elevation: `--shadow-1/2/3` (soft, low, warm-tinted). `--maxw` 1240px content width.
- `--ease` `cubic-bezier(.22,1,.36,1)` — the standard easing for every transition/animation.

### Shared utility primitives (in `styles.scss` — reuse, don't reinvent)

- `.btn` + `.btn--primary` (moss) / `.btn--ghost` (outline) — pill buttons.
- `.eyebrow` — mono, uppercase, tracked structural kicker/label.
- `.data` — mono + tabular numerals for any number/spec.
- `.plan-grid` — the faint architectural grid backdrop (apply to a positioned, `aria-hidden`
  layer; mask it for falloff — see the hero).
- `.sr-only` — visually-hidden, screen-reader text.
- Global `:focus-visible` ring (2px moss) is already defined — keep it; don't remove outlines.
- `prefers-reduced-motion` is globally honoured — gate any new JS-driven animation on it too
  (see `Welcome`'s typing demo).

---

## 4. Layout patterns already established

- **Pre-auth (`Welcome`)** — full-screen sections at `100svh`: a hero stating the thesis (giant
  display title, ambient masked plan-grid, a signature auto-typing demo field), then a
  scroll-down `Join` section with a 3-up numbered `features` grid and the sign-in CTA, then a
  thin footer. This is the "loading/welcome screen → scroll → sign in" pattern. Reuse its
  structure for other marketing/standalone full-page screens.
- **Post-auth (`Workspace`)** — a sticky translucent (`backdrop-filter: blur`) top bar with
  brand + account/sign-out; a `--maxw`-centred main column; a **sticky search zone** (search bar
  + collapsible filter panel) above the results grid.
- **Foldable chat dock (`ChatPanel`)** — collapses to a launcher pill so it never competes with
  results; expands to a windowed conversation. Assistant turns render grounded prose **plus the
  cited listings inline**, using the *same* `ListingCard` (in `variant="compact"`) as the results
  grid. A11y: `role="log"`, `aria-live="polite"`, `aria-expanded`/`aria-controls` on the toggle.
- **One card, two contexts** — `ListingCard` has `variant: 'full' | 'compact'`. The results list
  and the inline chat citations share it. Card title/footer link out to `source_url` (no detail
  route). Build new listing surfaces on this component, don't fork it.
- Responsive: mobile breakpoints at ~640/760px collapse grids to one column, drop the sticky
  search, and hide secondary chrome.

---

## 5. Accessibility (hard requirement)

- Must pass **AXE** and meet **WCAG AA** (contrast, focus management, ARIA). The palette's
  text tokens are chosen for AA on paper — keep that when combining colours.
- Provide skip links on full pages (`Welcome` has one), label every control (`.sr-only` labels on
  inputs), keep the focus ring, mark decorative layers `aria-hidden`, and give live regions to
  async content (chat thread). Mirror the patterns already in the codebase.

---

## 6. Data domain notes (for any listing/filter/chat UI)

- The frontend `Listing` (`core/models/listing.model.ts`) mirrors the backend canonical model
  (`seeker/models/listing.py`) — only user-facing fields. Cost can be a confirmed
  `total_monthly_cost` ("all in") or, when `cost_incomplete`, a "from rent" estimate, or unknown
  — render all three states (see `ListingCard.cost`).
- **`enrichment`** holds the facets from `config/inference_output.yml` (`design_style`,
  `condition`, `brightness`, `flooring`, `tags`, and `has_*` tri-state amenities `yes|no|unknown`).
  These are **not yet persisted on the backend Listing but are planned**, so they're typed
  optional and treated as **candidate hard filters / display chips** ahead of time. Any field on
  `Listing` itself or listed in `inference_output.yml` is fair game as a structured filter.
- The RAG chat response is expected to carry listing metadata (chunk sources = `Listing` models)
  and, in future, a `url` in the answer metadata. The UI is built to show full listing data inline
  — surfacing more of it is a UI-development matter, not a data-availability one.
- Chat models in `core/models/chat.model.ts`; filter/query shapes in `core/models/query.model.ts`
  (`emptyFilters()`, `ListingFilters`, `SourceStatus`). Mock data + the `SearchService` seam live
  in `core/search/`.

---

## 7. Adding a new page or feature (the common task)

1. Create `src/app/features/<name>/<name>.ts|html|scss` (standalone component, signals, the
   conventions in §2). Co-locate private child components under its `components/`.
2. Register a **lazy** route in `src/app/app.routes.ts` via `loadComponent`. Protect it with
   `authGuard` (`core/auth/auth.guard.ts`) if it requires a signed-in user. The `**` route
   redirects to `''`.
3. Auth state is a signal-based `AuthService` (`core/auth/`); read `isAuthenticated()`,
   `email()`, etc. — don't re-implement auth. Token claims, if you need finer gating than
   "logged in" (e.g. a missing claim → an "unauthorized / no access" screen), come from there;
   extend the service/guard rather than checking tokens in components.
4. Build the screen from the tokens and primitives in §3 and the layout patterns in §4 so it is
   visually continuous with `Welcome` / `Workspace`. Reuse `.btn`, `.eyebrow`, `.data`,
   `.plan-grid`, `ListingCard` — don't introduce parallel styles.
5. Meet the §5 accessibility bar.
