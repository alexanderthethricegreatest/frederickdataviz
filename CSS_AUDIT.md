# CSS Audit — Frederick County Growth Atlas (`web/`)

Audit of the Next.js app's styling. Scope: `web/app/globals.css` and the inline styling that
accompanies it. No files were changed. Severities: **Critical / High / Medium / Low**.

---

## Phase 1 — Setup Summary

**Stack (judge against this, not Tailwind conventions):**

- **Framework:** Next.js `15.1.6`, React `19.0.0` (App Router — `app/`).
- **UI kit:** `@radix-ui/themes ^3.3.0`. Its stylesheet is imported first in
  `app/layout.tsx:1` (`@radix-ui/themes/styles.css`), then `app/globals.css` at `layout.tsx:2`.
- **Tailwind:** **Not present.** No `tailwind.config.*`, no `postcss.config.*`, no `@tailwind`/
  `@import "tailwindcss"` directives. So a fat `globals.css` is legitimate here — the rules below
  are about consistency and dead weight, not about "move it to Tailwind."
- **CSS Modules:** **None** (`find` for `*.module.css` → 0 results). All styling lives in one global
  sheet plus inline `style={{}}`.
- **CSS-in-JS / styled-components:** None. Styling is (a) `globals.css`, (b) ~75 inline
  `style={{}}` props across 12 files, (c) Radix Theme components.
- **Fonts:** **No `next/font`, no `@font-face`, no `@import`, no `<link>` to a font.** The app uses a
  pure system stack — `--f-ui: system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif`
  (`globals.css:31`), wired into Radix via `--default-font-family` (`globals.css:79`). **This is a
  strength:** zero web-font download means no FOUT/FOIT/CLS and nothing render-blocking. `font-display`
  is not applicable.
- **`globals.css` size:** **429 lines, ~28 KB** — a single monolith holding the design tokens plus
  every route/component's styles (nav, hero, cards, tables, charts, map, votes, detail page, footer).

**Inline `style={{}}` distribution:**

| File | count |
|---|---|
| `app/applications/[id]/page.tsx` | 23 |
| `components/Charts.tsx` | 13 |
| `components/CountyMap.tsx` | 11 |
| `components/LibraryBrowser.tsx` | 8 |
| `app/votes/[member]/page.tsx` | 8 |
| `app/votes/page.tsx` | 4 |
| `components/Kit.tsx`, `app/applications/page.tsx` | 2 each |
| `ThemeProvider.tsx`, `app/page.tsx`, `app/layout.tsx`, `app/fiscal/page.tsx` | 1 each |

---

## Phase 2 — Design tokens & system consistency

### 2.1 Custom properties / tokens — **Good foundation, underused downstream**
A well-structured `:root` block (`globals.css:6–43`) defines surfaces, ink, borders, brand/status
colors, an 8-color categorical ramp (`--s1..--s8`), a 4-step sequential ramp (`--seq1..--seq4`), a
type scale, a spacing scale, radii, blur, and three shadow tiers. This is a real design system, not
scattered values. **However, the scales are defined and then largely bypassed** by hardcoded values in
the component rules (see 2.3, 2.5). Roughly:
- **Hardcoded hex outside token blocks:** `#fff` ×8 (on-accent text: `globals.css:122,137,225,234,290,306,337,413`) and one hardcoded `rgba(42,111,240,.16)` (`globals.css:298`) that duplicates `--accent` literally instead of `color-mix(in srgb, var(--accent) …)`.
- **Hardcoded `px` in rules (not tokens):** dozens — paddings, gaps, radii, heights throughout `globals.css:99–429`.

**Severity: Medium** (system exists; discipline in applying it is the gap).

### 2.2 Color system — **Semantic, with a real bug**
Naming is semantic and readable: `--surface`, `--ink`, `--ink-2`, `--muted`, `--border`, `--accent`,
`--good/--crit/--warn/--pending`. Categorical/sequential ramps are appropriately scale-named.

- **BUG — undefined token `var(--ink2)`** (missing hyphen) at `globals.css:376` (`.bv-tally`) and
  `globals.css:396` (`.bv-member`). The token is `--ink-2`; `--ink2` is never defined, so these
  silently fall back to the inherited color instead of the intended muted ink. **Severity: Medium**
  (silent visual defect, both light and dark).
- **Dark mode:** implemented two ways — explicit `:root[data-theme="dark"]` (`globals.css:44–59`) and
  system `@media (prefers-color-scheme:dark) :root:not([data-theme="light"])` (`globals.css:60–76`).
  Values are consistent between them, and the `localStorage` bootstrap in `layout.tsx:19–23` sets
  `data-theme` before paint (no theme flash). Good coverage — but the two dark blocks are
  **~16 lines duplicated verbatim** (see 4.2). **Severity: Medium** (maintenance hazard: edits must be
  made in two places).
- *Optional note:* colors are sRGB hex; `oklch()` would give more perceptually even ramps and
  `--s*`/`--seq*` interpolation. Not required.

### 2.3 Spacing scale — **Defined but bypassed**
A clean 4px-based scale exists: `--sp-1:4px … --sp-16:64px` (`globals.css:35–36`). It is **almost
never used** in the component rules — spacing is written as raw px instead (e.g. `.card{padding:18px}`
`:195`, `.grid{gap:14px}` `:178`, `.filters{gap:10px}` `:281`, `.timectl{gap:12px}` `:410`). Values
like `18px`, `14px`, `9px`, `11px`, `13px`, `22px` are off-scale magic numbers. **Severity: Medium.**

### 2.4 Typography scale — **Defined; fixed `px`, tiny sizes, fluid only at the top**
- Scale `--fs-xs:12px … --fs-3xl:32px` (`globals.css:32–33`). **All sizes are `px`, not `rem`**, so
  they do not respond to the user's browser font-size preference — an accessibility limitation.
  **Severity: Medium.**
- Fluid `clamp()` is used only for headings/hero (`:155,156,162,163,169,214,351,417`). Body scale is
  fixed steps — acceptable, but the mix means some text scales with viewport and some doesn't.
- **Sub-scale tiny type:** `10.5px` (`.minitbl th` `:270`), `10px` (`.sortar` `:302`), `9px`
  (`.sortnum` `:305`), `11px` (svg tick/label `:247,248,418`). These live *below* `--fs-xs` and are
  legibility/contrast risks. **Severity: Low–Medium.**
- Fallback stack is a solid system stack (`:31`) — good.

### 2.5 Shadows, borders, radii — **Shadows tokenized; radii are a one-off zoo**
- **Shadows:** three tiers (`--shadow-sm/--shadow/--shadow-lg`, `:40–42`) are reused consistently.
  A few one-off accent "glow" shadows are inline (`:123,137,225,306,414`) — acceptable but not
  tokenized. **Severity: Low.**
- **Radii:** tokens `--r-sm:10px / --r:16px / --r-lg:22px / --r-pill:999px` (`:38`) exist, but rules
  scatter **at least six off-token radii**: `12px` (`.iconbtn:125`, `.navtoggle:131`, `.sel:238`,
  `.playbtn:413`), `13px` (`.btn:220`, `.searchbox input:284`, `.related-item:366`), `11px`
  (`.navlist a:135`, `.navmenu a:142`), `14px` (`.timectl:410`), `8px`/`9px` (`.logo .dot:122`,
  `.parcelchip:403`, `.summary:262`). Nothing between the 10px and 16px tokens is reused; each control
  picks its own. **Severity: Medium** (visual inconsistency + hard to retune globally).

---

## Phase 3 — Layout, responsiveness, modern CSS

### 3.1 Layout primitives — **Solid**
Flexbox/Grid used idiomatically. Container is `.wrap{max-width:1180px;margin:0 auto}` (`:105`).
Responsive grids via `.grid/.g-2/.g-3/.g-tiles` (`:178–188`). Good use of `grid-column:1/-1`
(`.card-lg:189`). No `float`, no absolute-position layout hacks.
- **Brittle coupling:** `.topbar{height:58px}` (`:114`) and `th{position:sticky;top:58px}` (`:318`)
  share the magic number `58` with no shared token. Change the header height and sticky table headers
  silently misalign. **Severity: Medium.** (Fix: `--topbar-h:58px`, reference in both.)
- Fixed control sizes (`iconbtn 40×40`, `playbtn/btn min 44px`) are intentional touch targets — fine.

### 3.2 Responsiveness — **Mobile-first, but breakpoints are ad-hoc**
Base styles are mobile; enhancements are `min-width` queries — correct mobile-first direction.
**Breakpoints are inconsistent magic numbers**: `640` (`:106,158,175,197`), `680` (`:165`),
`720` (`:179`), `820` (`:147`), `900` (`:121`), `1040` (`:185`), `880` (`:354`). Seven distinct
values with no shared set. In plain CSS you can't tokenize `@media` widths, but consolidating to a
documented 3–4 stop set (e.g. 640/900/1180) would remove the drift. **Severity: Medium.**
- `.statstrip` (`:164–165`) and `.g-tiles` (`:183,187`) hand-roll column counts across breakpoints;
  `grid-template-columns:repeat(auto-fit,minmax(150px,1fr))` would collapse several of those queries.
  *Optional.*

### 3.3 Modern features — in use vs missed
**In use (good):** `clamp()` ×8, `color-mix()` ×11 (`:93–96,115,123,137,318,…`), `100dvh` (inline,
`app/…` min-height), `:focus-visible` (`:102`), `prefers-reduced-motion` (`:425`),
`prefers-color-scheme` (`:60`), `backdrop-filter` with `-webkit-` fallback everywhere.
**Absent (optional adoption, only where it removes complexity):**
- **Logical properties** — 0 uses. `margin-inline/padding-block` etc. would future-proof RTL and read
  cleaner, but the app is LTR-only; **low value.**
- **`aspect-ratio`** — 0 uses; charts are SVG with intrinsic sizing, so little need.
- **`:has()`** — 0 uses; a few JS-driven state classes (`.on`, `.sorted`) could theoretically become
  `:has()` selectors, but current approach is fine.
- **Native nesting** — 0 uses. Would improve readability of the many `.foo .bar` chains but is a pure
  refactor. **Optional.**
- **`@layer`** — 0 uses. Given Radix's stylesheet loads first and one `!important` is already needed
  to override it (`:79`), wrapping app styles in `@layer` would make the Radix-vs-app cascade explicit
  and could remove the `!important`. **Reasonable optional structural win.**
- **Container queries** — 0 uses; cards reflow by page width only. Not needed at current complexity.

### 3.4 Overflow & units
- **`100vw`:** none — good. Body uses `width:100%` + `overflow-x:hidden` (`:87`), which prevents the
  classic scrollbar-overflow bug. (Minor caveat: blanket `overflow-x:hidden` on `body` can mask real
  horizontal overflow and, in rare cases, interfere with `position:sticky`; keep an eye on it.)
- **`px` vs `rem`:** type scale and most spacing are `px` (see 2.3/2.4) — the main accessibility unit
  issue. **Severity: Medium.**

---

## Phase 4 — Maintainability, performance, accessibility

### 4.1 Specificity & cascade — **Healthy**
- **`!important`:** exactly **1** (`.radix-themes{…!important}` `:79`) — justified to punch the mesh
  background through Radix's opaque theme wrapper. **Low.**
- **No ID selectors.** Specificity is flat (single classes, short descendant chains). Global element
  selectors `table/th/td` (`:316–323`) and `h1..h4/a/p` (`:99–101`) are broad but appropriate for a
  small app; note `table/th/td` will style *any* future table, intended or not. **Low.**

### 4.2 Duplication & dead-code candidates *(listed, not removed)*
- **Duplicated dark-mode block:** `globals.css:44–59` vs `:60–76` are ~16 near-identical lines. A
  single source (e.g. define dark vars once and apply via a shared selector list) would halve it.
  **Severity: Medium.**
- **Likely-dead selectors (verify before removing):** `select.sel` and `select.fsel` (`:238–240`) —
  no `className="sel"`/`"fsel"` found in any `app/` or `components/` file. Candidate for deletion.
- **Repeated inline magic numbers** that belong in classes: `marginTop:22` (~6×) and
  `verticalAlign:-2` (many, on inline icons) across `app/applications/[id]/page.tsx` and others — not
  dead, but duplicated logic that should be a utility class. **Low–Medium.**

### 4.3 Reset / normalize — **Minimal, slight redundancy**
`globals.css` provides a small reset: `*{box-sizing:border-box}` (`:81`), `body{margin:0}` (`:84`),
`h1..h4{margin:0}` (`:99`), `p{margin:0}` (`:101`). Radix's `styles.css` (imported first) already ships
its own normalize, so there is minor overlap, but nothing conflicting or harmful. **Low.**

### 4.4 Scope hygiene — **Everything is global (architectural choice)**
`globals.css` holds route-specific styles for votes (`:378–398`), the map (`:407–425`), the detail
page (`:347–405`), the library table (`:280–323`), and charts (`:242–257`) — none of which are used on
most pages, yet all ship in the global sheet. With no CSS-Modules setup this is expected, but a 429-line
global blob is the app's biggest maintainability drag. Introducing CSS Modules for the heavier,
route-local blocks (votes, map, detail, library) would scope them and shrink the global surface.
**Severity: Medium** (maintainability, not correctness).

### 4.5 Font performance — **Best case already**
No web font is loaded (see Phase 1), so there is **no CLS/render-blocking risk and nothing to fix**.
`next/font` and `font-display` are not applicable. If a brand font is ever added, use `next/font` with
`display:"swap"`.

### 4.6 Accessibility
- **Focus states:** global `:focus-visible{outline:2px solid var(--accent);outline-offset:2px}` (`:102`)
  plus a search-input focus (`:286`) — present and visible. **Good.**
- **`prefers-reduced-motion`:** handled (`:425`) but **narrowly** — it disables only `svg circle.pop`
  and `scroll-behavior`. Other motion is **not** covered: `@keyframes pop-menu` (`:145`), card/tile/btn
  hover `transform:translateY` (`:127,210,224,335,368`), and `fill .55s` chart transitions
  (`:420–422`). A reduced-motion user still gets these. **Severity: Medium.**
- **`prefers-color-scheme`:** dark mode honors it (`:60`). **Good.**
- **Contrast risks (light mode):** `--muted:#858a95` on `--surface:#fff` ≈ **3.6:1** — below WCAG AA
  4.5:1 for normal text. `--muted` is used widely for secondary labels/captions (e.g. `.sub`, `.card
  .cdesc`, `.tile .n`, table `th`). Combined with the sub-12px sizes in 2.4, small muted text is the
  main contrast exposure. (Dark-mode `--muted:#848996` on `#16181d` ≈ 5–6:1, fine.) **Severity: Medium.**
- **Tap targets:** buttons/inputs use `min-height:40–44px` — meets guidance. **Good.**

---

## Prioritized Task List

Each task is one checkable action with file(s), the change, and risk. **No task below has been
implemented** — awaiting your go-ahead.

### Quick wins — low effort, safe, high value
1. **Fix undefined token `--ink2` → `--ink-2`.** File: `web/app/globals.css:376,396`
   (`.bv-tally`, `.bv-member`). Change `var(--ink2)` to `var(--ink-2)`. **Risk: none** (restores
   intended color).
2. **Introduce `--topbar-h:58px` and reference it** in `.topbar` height (`:114`) and `th{top:…}`
   (`:318`). File: `globals.css`. Removes coupled magic number so header/table stay in sync.
   **Risk: very low.**
3. **Replace the hardcoded `rgba(42,111,240,.16)`** (`.fpill button:hover`, `:298`) with
   `color-mix(in srgb, var(--accent) 16%, transparent)` so the hover tint tracks the accent token and
   dark mode. File: `globals.css`. **Risk: none.**
4. **Remove dead `select.sel`/`select.fsel` rules** (`:238–240`) — *after* a final grep confirms no
   dynamic usage. File: `globals.css`. **Risk: low** (verify first).
5. **Extract repeated inline magic numbers into utility classes** (`verticalAlign:-2` icon nudge,
   `marginTop:22` section gap). Add e.g. `.ico-mid{vertical-align:-2px}` / `.mt-sec{margin-top:22px}`
   in `globals.css`; swap the inline props in `app/applications/[id]/page.tsx` and siblings.
   **Risk: low** (visual-equivalent, touches JSX class strings only).

### Structural improvements — tokenization / refactors
6. **De-duplicate the dark-mode variables.** File: `globals.css:44–76`. Collapse the identical
   `[data-theme="dark"]` and `prefers-color-scheme` blocks into one source (shared selector list or a
   single `--dark-*` definition applied twice). **Risk: medium** (must preserve the "system dark unless
   explicitly light" logic — test all three states).
7. **Apply the spacing scale.** File: `globals.css`. Replace off-scale paddings/gaps
   (`18px,14px,13px,11px,9px,22px`) with the nearest `--sp-*` token, adjusting the scale if a real
   16/18 distinction is needed. **Risk: medium** (small visual shifts; review each block).
8. **Consolidate the radius tokens.** File: `globals.css`. Map the `12/13/14/11/9/8px` one-offs onto
   `--r-sm`/`--r`/a new `--r-md` as needed, then reference tokens in `.iconbtn/.btn/.navtoggle/.sel/
   .related-item/.timectl/etc.` **Risk: medium** (button/control corners change slightly).
9. **Move type & control sizing from `px` to `rem`.** File: `globals.css:32–33` (type scale) and key
   control paddings. Converts fixed sizes to user-scalable units for accessibility. **Risk: medium**
   (global visual reflow — needs a full visual pass).
10. **Scope route-local CSS into CSS Modules.** Files: new `*.module.css` for votes (`:378–398`), map
    (`:407–425`), detail (`:347–405`), library (`:280–323`); import into the matching components.
    Shrinks `globals.css` toward tokens + shared primitives only. **Risk: medium–high** (larger
    refactor; do one route at a time, verify each).
11. **Broaden `prefers-reduced-motion` coverage.** File: `globals.css:425`. Extend the block to also
    neutralize `pop-menu`, hover `transform`s, and chart `fill`/`opacity` transitions. **Risk: low.**
12. **Raise muted-text contrast in light mode.** File: `globals.css:15`. Darken `--muted` (e.g. toward
    `#6b7280`) to clear 4.5:1 on white; re-check against `--glass` surfaces. **Risk: medium**
    (touches every muted label — visual review).

### Optional / nice-to-have — modern-CSS polish
13. **Wrap app styles in `@layer`** and drop the `!important` on `.radix-themes` (`:79`) by ordering
    the app layer after Radix. File: `globals.css` + import order in `layout.tsx`. **Risk: medium.**
14. **Collapse hand-rolled column breakpoints** in `.statstrip`/`.g-tiles` to
    `grid-template-columns:repeat(auto-fit,minmax(…,1fr))`, removing several media queries.
    File: `globals.css:164–188`. **Risk: low–medium.**
15. **Consolidate breakpoints** to a documented 3–4 stop set (e.g. 640/900/1180) and retire the
    680/720/820/880 one-offs. File: `globals.css`. **Risk: medium** (reflow review).
16. **Adopt native nesting** for the long `.foo .bar` chains (nav, card, tile, timeline, votes) for
    readability. File: `globals.css`. **Risk: low** (Next 15 / modern browsers support it; pure
    readability refactor).
17. *(Exploratory)* **Move the `--s*`/`--seq*` ramps to `oklch()`** for perceptually even categorical
    and sequential steps. File: `globals.css:27–29,53–55,69–71`. **Risk: medium** (color shift; needs
    dataviz sign-off).

---

## Implementation Progress

### Done — Quick wins (1–5)
- ✅ **#1** `var(--ink2)`→`var(--ink-2)` in `.bv-tally`/`.bv-member`.
- ✅ **#2** Added `--topbar-h:58px`, referenced in `.topbar` + sticky `th{top}`.
- ✅ **#3** `.fpill button:hover` hardcoded rgba → `color-mix(var(--accent) 16%)`.
- ✅ **#4** Removed dead `select.sel,select.fsel` (confirmed: app uses Radix `Select.*`, no native `<select>`).
- ✅ **#5** Extracted `.ico-mid` / `.mt-sec` utilities; swapped 15 inline props in `applications/[id]` + `votes/[member]`.

### Done — Structural
- ✅ **#6** Dark-mode dedup via `light-dark()`: `:root` now single-source, `color-scheme` pins the theme,
  only shadows keep a small dark override. (Chosen approach: `light-dark()`, ~2024 browser baseline.)
- ✅ **#11** `prefers-reduced-motion` broadened to neutralize all animations/transitions/scroll
  (`*,*::before,*::after`), not just the SVG pop.
- ✅ **#12** Light `--muted` `#858a95`→`#696e7a` (now 5.11:1 on surface, 4.51:1 on plane — clears AA).

### Done — from the rendered/visual audit (new tasks)
- ✅ **V-1 (High)** Dark-mode white-on-accent text failed AA (3.06:1) on primary buttons, active nav,
  `.seg.on`, `.chip.on`, `.sortnum`. Fixed by splitting the token: added `--accent-strong` +
  `--accent-2-strong` (filled backgrounds, darker in dark mode → ≥4.5:1) while `--accent`/`--accent-2`
  stay lighter for text use. Light values are identical to before, so **light mode is visually unchanged**.
  Verified with Playwright screenshots (light + dark, desktop/tablet/mobile, hover/focus).
- ✅ **V-3 (Low)** `.loadmore button` given `min-height:44px` to match other controls.

### Verification
Playwright (Chromium) installed locally; dev server on `:3123`. Captured light/dark × desktop/tablet/mobile,
plus primary-CTA hover/focus and dark-CTA close-ups. Confirmed: theming correct in both modes, dark button
contrast improved, light mode unchanged, mobile is genuinely mobile-designed, alignment is clean (no
raggedness), and the `.ico-mid`/`.mt-sec` swaps render correctly. Note: `next build` still fails prerendering
`/land` with a pre-existing JSON/runtime error unrelated to CSS (route renders fine in dev).

### Done — Structural (round 2)
- ✅ **#8** Radius consolidation. Added `--r-xs:8px` + `--r-md:12px` (and started using the previously
  dead `--r-sm:10px`). Snapped the control-corner zoo (8/9/11/12/13/14px) onto `--r-xs`/`--r-sm`/`--r-md`
  (max ±2px shift). Only intentional literals remain: focus ring 6px, swatches 2–3px, sort badge 4px.
- ✅ **#9** Type scale `px`→`rem` (÷16). Converted the `--fs-*` tokens, all eight `clamp()` heading/stat
  sizes, and the three non-SVG sub-scale literals (`.minitbl th`, `.sortar`, `.sortnum`). SVG `<text>`
  sizes (axtick/vlabel/dlabel) stay px by convention. **Default zoom is pixel-identical**; verified with
  Playwright that text now scales with the browser font-size preference (captured at `root=24px`), which
  it did not before.

### Deliberately not done (with reasons)
- **#7 apply `--sp-*` scale** — *recommend skipping the wholesale version.* Most spacing values (18/13/11/9/
  14/22px) are off the 4/8px scale, so tokenizing them means either snapping (visual churn across the whole
  app) or inventing off-scale tokens (abstraction without removing magic). Net: high churn, low payoff —
  contrary to the "reduce magic, don't just add abstraction" rule. Better as a targeted future pass.
- **#10 route CSS → CSS Modules** — *blocked by the audit's own rules.* It requires editing component
  `.tsx` files (module imports + `className` refs), i.e. touching non-CSS files / component structure,
  which the task rules prohibit. Needs an explicit exception to proceed.

### Done — Optional / modern-CSS (round 3)
- ✅ **#13** Removed the file's only `!important` (`.radix-themes` background). Verified empirically that
  source order alone keeps it transparent (`getComputedStyle → rgba(0,0,0,0)`, mesh still shows). Note:
  the audit's `@layer` idea is **not applicable** — Radix ships **unlayered** CSS, so layering app styles
  would make them *lose* to Radix. Source-order fix is the correct one. The only remaining `!important`
  is the intentional `prefers-reduced-motion` override.
- ✅ **#14** Auto-fit grids. `.statstrip` and `.g-tiles` now use
  `repeat(auto-fit,minmax(150px,1fr))`, removing the `680px` breakpoint entirely and dropping the
  hardcoded 3-/6-column rules from `720px`/`1040px`. Verified mobile (2-col), tablet (4-col), desktop
  (6-col). Mobile stat tiles went 1-col→2-col — a deliberate improvement (more scannable, less scroll).

### Chart visual integrity — checked, one finding
Rendered all chart types (stacked/grouped bars, area, horizontal bars, heat) in **both themes** via
Playwright. Charts are legible and correct in light *and* dark. **Finding (not fixed — needs non-CSS
changes):** charts read colors from a hardcoded JS array (`SERIES` in `lib/data.ts`), **not** the CSS
`--s*` tokens, so (a) dark mode uses the *light*-tuned hex (works, but the CSS has better dark-tuned
`--s*` values that go unused), and (b) the validated palette is duplicated JS-vs-CSS and can drift.
Consequence for this audit: **#17 (oklch on `--s*`) cannot affect the charts** — they don't use the tokens.

### Recommended against (evidence-based) — awaiting your call
- **#15 breakpoint consolidation** — after #14 the remaining stops (640/720/820/880/900/1040) are each
  component-specific (nav fit at 820, detail-grid at 880, logo suffix at 900). No consolidation reduces
  the count without changing *where* a component reflows, i.e. real regression risk for cosmetic tidiness.
  Recommend leaving as an intentional, documented set.
- **#16 native nesting** — pure source restructuring across ~60 selector chains with **zero visual change**;
  high churn + regression risk, and partial adoption would be inconsistent (all-or-nothing). Low value vs
  risk. Happy to do it as its own focused, separately-verified pass if you want it.
- **#17 oklch ramps** — the categorical/sequential palette is dataviz-validated *and* duplicated in JS
  (which is what the charts actually use). Converting the CSS `--s*` losslessly = no visual/functional
  gain; redesigning for perceptual evenness = risk to a validated palette. Recommend skipping unless you
  want to re-validate the ramp end-to-end (JS + CSS together).

### Done — User-reported visual bugs (from real use)
- ✅ **Chart tooltip flung far-right** (`components/Charts.tsx`). Root cause: `.tip{position:fixed}`
  lived inside `.card`, whose `backdrop-filter` makes it the containing block for fixed descendants, so
  `left:clientX` resolved against the card, not the viewport. Fix: `createPortal` the tooltip to
  `document.body`. Fixes every chart + the votes heatmap.
- ✅ **Overlapping x-axis year labels** (`Bars`, `Line`). Every category label was drawn; ~38 years
  collided (broken at all sizes since the viewBox is fixed). Fix: thin to ≤14 labels (≤8 on mobile).
- ✅ **Sticky table header ghost** (`globals.css` `th`). Header was 82% translucent, so scrolled rows
  bled through. Fix: solid `var(--surface)` background + a 1px bottom hairline.
- ✅ **Charts too short on mobile** (`Charts.tsx`). Fixed 2.4:1 viewBox squashed to a thin strip on
  phones. Fix: `useNarrow()` swaps to a 440-wide (~1.5:1) viewBox ≤640px — mobile plot height went
  ~130px→~230px. Desktop unchanged. Verified light/dark, mobile/desktop, tooltip hover, `tsc` clean.

### Still open
- **V-2 (Medium)** Consolidate the **12 font-weights** (500/560/…/760) to ~4 tokens — most collapse to the
  same rendered weight on the system-ui stack.
- **Chart theming (needs non-CSS):** make `SERIES` theme-aware (or drive SVG fills from `--s*`) so dark
  mode uses the dark-tuned palette and the JS/CSS duplication is removed.
- **Table header pinning:** the sticky `th` sits inside `.tablewrap{overflow-x:auto}`, which can trap
  sticky pinning in some engines. Works in-browser (per your screenshots); flagged for awareness.
- Minor: light `--warn/--pending` (#b47600, 3.80:1) still under AA for normal text.
