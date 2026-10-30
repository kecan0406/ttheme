---
paths:
  - "site/**"
---

# site/

The design system is the Design System artifact https://claude.ai/artifact/D3TtwiZtWyM175ydwyWCyv: read its README before styling anything. `app/globals.css` is its code form.

## Server and pages

- `elysia` stays pinned to `2.0.0-rc.0`; a bump is a deliberate step.
- Never use `@elysia/html`.
- `onError('global', …)` goes before every route in the chain.
- A group's `derive` answers a miss with `status(404, …)`, never a thrown error class.
- Every response goes through `page()` (`app/document.tsx`).
- A canonical link, `og:url` and a card's URL are on the production origin (`SHARE_URL`), never a preview URL.
- Structured data is `WebSite` and `SoftwareSourceCode`, never `SoftwareApplication`.
- A share link's page is `noindex`, and `robots.txt` never disallows `/builder/`.
- Every page's title and description come from `lib/titles.ts`.
- The server bundle reads no file at run time: wasm and fonts go in through the macros in `lib/embed.ts`.
- The name lookup (`NAMES_PATH`, `lib/lookup.ts`) is the one route that asks outside at run time.

## CSS and markup

- The site works in every browser Baseline calls widely available; anything newer is an enhancement with a fallback.
- A relative color sits behind `@supports` over a `color-mix()` fallback, and a newer DOM API behind a check.
- Read a CSS feature's floor from `web-features`, never from Playwright's WebKit.
- There is no second theme: every token maps onto the slots `--bg`, `--fg`, `--cu`, `--se` and `--a0`–`--a15`.
- Text, radius and spacing come only from the design system's scale; arbitrary values are for layout tracks, breakpoints and blur.
- A new `--text-*` size is also added to `cn`'s tailwind-merge config (`lib/utils.ts`).
- A UI part in `components/ui/*` keeps its looks as `cva` variants, renders `data-slot` and carries no `dark:` variants; a feature component never passes it a long `class`.
- Spell out a Tailwind class whole for each value; never build a class name from parts.
- A link off the site opens in a new tab with `rel="noopener"`, without `noreferrer`, and ends in `NewTab`.
- A stylesheet that turns on an OpenType feature adds it to `FEATURES` in `build.ts`.
- `translate="no"` goes on the element that holds a name or a command, never on one that also holds prose.
- In forced colors a swatch takes `forced-color-adjust: none`, and nothing that holds text does.
- A page wrapper that is a `grid` takes `grid-cols-[minmax(0,1fr)]`.
- A swatch that stands for a palette is one element, never one element per color.
- Never put `content-visibility: auto` on rows, tiles or any list a visitor jumps through.

## Client code

- Interactivity is vanilla TypeScript in `client/`: a custom element per widget, reading its data from a `<script type="application/json">` the server wrote with `json()`.
- A list of palettes is fetched, never inlined, and no widget waits on it to show what the page drew.
- A widget re-renders a fragment with the same KitaJS component the server used.
- Every command a page offers to copy is a `CommandRow`.
- A tip shows only after a copy (`flash()`), never on hover or focus.
- A keyboard shortcut goes through `client/keys.ts`, and a single key never fires with a modifier held, in a field or during an IME composition.
- A search field is `autocapitalize="none"` and `autocorrect="off"`.
- `Dialog`, `Popover`, `Tabs`, `Collapsible`, `Combobox`, `Toggle` and `ToggleGroup` are Base UI's parts on native elements, with Base UI's event and attribute names; a feature only composes them.
- Client code never imports `lib/builtin.ts`, `lib/lookup.ts`, `lib/marketplaces.ts` or `lib/share.ts`, not even for a type, and of the root's `src/` only `src/core` modules that do no I/O.
- `components/` and `lib/` touch neither `document` nor `Bun`, and `components/` never imports `lib/builtin.ts`.

## The worn palette and motion

- A palette's address shows that palette in the workspace's preview pane only.
- A window that shows another palette sets the slots on its own `TerminalFrame` only.
- Another palette's color is written as `light-dark(<light>,<dark>)`, and a text that depends on the mode goes inside `ByMode`.
- A text that names the worn palette is drawn from the page's vars, never written into the markup.
- The mark `>ω` has one source, `src/core/mark.ts`, and `--mark0`–`--mark2` are derived, never stored.
- `WEAR_SCRIPT` keeps its own copy of the lift (`LIFT`): change both together.
- Regenerate the Nunito advances (`headlineEm`) whenever the Nunito package changes.
- Never fade the slots with a CSS transition or animation.
- `fadeThrough` clips through a stylesheet of its own, never through a custom property on `<html>`.
- During a palette change read layout first, write after, and scroll in the next frame.
- A selector that an attribute set on `<html>` during a change reaches ends in a compound with an attribute, class, id or tag of its own.
- The facet ground's colors all come from `shade`; never move per-facet work into DOM elements or CSS.
- The route progress bar moves only `opacity` and `translate`; never drive it through a custom property animation.
- The route record is written at `navigate`, never at `pagehide`.
- A terminal's cursor blinks a cover by `opacity`, never the cell's `background-color`.
- The head's inline scripts share one global scope: keep each script's variables inside its functions.
- A value the server writes into an inline script goes through `json()`, never a bare `JSON.stringify`.
- `respeculate()` never runs in the task that picked the palette.

## Layout

- The header's breakpoints are its row's own, written only in the custom variants in `globals.css`; a part added to the row, or a label that grows, means measuring the row again at every width.
- No header part that cannot shrink gets `min-w-0`.
- Tailwind's `max-[Npx]` is exclusive and `min-[Npx]` inclusive, so a pair takes the same N.
- The header's fold never moves the page, and its hand-off between pages is CSS animations, not script.
- Every terminal window the site draws goes through `TerminalFrame` (the builder's `MockWindow`), and nested corners share a center.
- One stylesheet colors every terminal screen: never color a run with a class or an inline style.
- The landing is the one page allowed a louder layer; every other page stays soft.
- A kaomoji shows only in a passing state, one per view, never in a heading, doc or error, and always `aria-hidden`.
- The landing's hero never moves under its visitor.
- The CLI's scenes are computed inside the render, so the browser bundle holds none of them.
- A button that looks pressable always goes somewhere.
- The builder's text is labels, values, commands, warnings and problems, with no sentence that repeats what a control's label says.
- The builder bar's squeeze stays media queries.

## Traps

- Lightning CSS writes an `animation` shorthand that names no keyframes as `animation: none`: a rule that leaves the name to another rule takes longhands, and CSS is checked on a built site.
- KitaJS escapes attributes but not children: a string child takes `safe`, or `escapeHtml()` as a component's child.
- Both KitaJS packages are prereleases that need TypeScript 6, so `site/` stays on TypeScript 6.
- An `aria-*` that must read `false` is written `String(value)`.
- `xss-scan` takes `.map()` over an array from a JSON import for unescaped content: give the array a typed constant first.
- `Bun.build` lowers no built-in.
- The dev reload stream is held only while the page is visible or prerendering, and pings every 5s.
