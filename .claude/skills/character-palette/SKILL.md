---
name: character-palette
description: Build or refine character-based themes in themes/*.toml from measured colors instead of remembered ones. Use when adding themes for a new series or improving existing character palettes. Covers anchor sampling from official art, real base-scheme sourcing, the harmonizer that gives every palette one readability envelope, the contrast-gate loop, and a swatch-board eyeball check.
---

# Character palette pipeline

Every color in a character theme must be traceable: anchors are measured from official art, the ANSI ramp's hues come from a real terminal scheme, and the harmonizer folds both into one shared tone/chroma envelope so all palettes read the same way. The contrast gate is the success criterion.

The envelope is modeled on illogical-impulse's Material You terminal theming: a dark near-neutral surface tinted by the seed color, text at a fixed light tone, and accents whose hues lean toward the seed while their lightness stays in a narrow band. Only the seed and the hues vary per character.

## 1. Identity research

- Web-search each character's appearance (hair, eyes, signature item, chuuni/persona colors) so you know what to look for before sampling.
- Theme names follow the project convention (given names); use the common alias instead when the given name collides with a character from another series already in `themes/`.
- `group` = series English name, `order` = next unused integers (`meta.order` must stay unique across all themes).
- A new series needs a `[[group]]` table in `themes/_groups.toml`: `native` = official native title, `lead` = the palette whose signature color stands for the whole series on the site's sidebar group headers. Pick the lead for color, not seniority — Undertale leads with `determination`, Evangelion with `eva01` — and check it against the other groups' lead colors so two series do not land on the same hue.

## 2. Measured anchors

- Fetch official character art. AniList GraphQL works unauthenticated and is the most reliable source:
  - `curl -s 'https://graphql.anilist.co' -H 'Content-Type: application/json' -d '{"query":"query{Media(search:\"<title>\",type:ANIME){id characters(role:MAIN,perPage:10){edges{node{name{full} image{large}}}}}}"}'`
  - Fallback: Jikan (`https://api.jikan.moe/v4/anime?q=<title>` then `/anime/<id>/characters`) — it proxies MAL and goes down with it.
  - Download portraits to the scratchpad, never into the repo.
- Sample dominant colors: `bun .claude/skills/character-palette/scripts/sample-colors.ts <image> [k]` (k defaults to 8; decodes via macOS sips, prints hex + share, largest cluster first).
- Record 3-4 anchors per character: hair, eyes, signature item. Portraits rarely surface tiny features like irises — center-crop first (`sips --cropToHeightWidth <h> <w>`) or keep that anchor from step 1 research and note that it is unmeasured.
- Portrait backgrounds (white/gray clusters) are noise; ignore them.
- An anchor is only worth keeping if it can carry a slot: the harmonizer keeps signature slots verbatim, so a dull or mid-tone anchor in a signature slot lands on the card unchanged. Prefer the character's most saturated identifying color as the first signature entry — it becomes the seed that tints every derived surface.

## 3. Real base scheme

- Pick one existing terminal scheme per theme whose hue family matches the character, and take its actual values from iTerm2-Color-Schemes: `https://raw.githubusercontent.com/mbadolato/iTerm2-Color-Schemes/master/ghostty/<Name>` (list `ghostty/` via the GitHub contents API for exact file names).
- Only the scheme's hues survive the harmonizer; its lightness and saturation are normalized away. Pick for hue family and mood (cool blues, warm ambers, purple-leaning magentas), not for how dark or vivid it ships.
- Re-validate the pick against the measured anchors — if the measurements contradict the scheme's hue family, switch schemes rather than fighting the base.
- `ansi_source = "<Scheme> + <group codename>"` — one codename per group, matching the existing `themes/*.toml` convention. This is also the record of what the harmonizer was fed, so it must stay accurate.

## 4. Substitution

- Start from the base scheme's 16 slots; substitute anchors into cursor and at most 1-2 accent slots.
- ANSI 1-6 keep their functions (red=error, green=ok, yellow=warn, blue/cyan legible). Character identity lives in cursor plus the substituted slots — do not spread it across all 16.
- Background, foreground, selection and ANSI 0/7/8/15 are surfaces: the harmonizer derives them from the seed, so a measured value there only survives if that slot is in `meta.signature` (a measured foreground is the usual case). Write the base scheme's values and let the harmonizer replace them.
- Record where the identity landed: `meta.signature` names the three slots the site renders as the card's identity block — usually `cursor` plus the two substituted slots. Order them the way the character reads (hair, then eyes or costume); the first one is the seed and also colors the group's band header when the theme is its lead. The build rejects three slots that resolve to fewer than three distinct colors.

## 5. Harmonize

- `bun .claude/skills/character-palette/scripts/harmonize.ts --write themes/<name>.toml [...]` rewrites the `[colors]` block in place (omit `--write` to only report). It reads `meta.signature[0]` as the seed and:
  - background / foreground: seed hue, chroma ≤ 8 / ≤ 12, tone 8 / 90 (light palettes: 98 / 12, detected from the input background).
  - ANSI 0/7/8/15: the same tinted neutral at tones 14 / 80 / 50 / 94.
  - selection: the input's hue, chroma ≤ 24, tone 26.
  - ANSI 1-6 and 9-14: the input hue rotated toward the seed by 40 % of the distance, capped at 60°; chroma clamped to 32-64; tone fixed per function (red 66, green 70, yellow 76, blue 66, magenta 68, cyan 72) with bright slots +12. Grey inputs (chroma < 10) fall back to canonical hues.
  - signature slots are written back verbatim.
- The transform is one-way: it consumes the base-scheme ramp and writes the result over it. Never run it on its own output — hues keep rotating toward the seed. To re-tune a shipped theme, re-fetch the base scheme named in `ansi_source`, redo step 4, and run it once.
- Changing the envelope means editing the constants at the top of the script and re-running it over every theme from the base schemes, so every palette moves together.

## 6. Gate loop

- `mise run build` until clean; src/contrast.ts is the success criterion (foreground 7:1, accents 3:1, ANSI 0 luminance <= 0.15, ANSI 7/15 7:1, ANSI 8 1.6:1). The harmonizer prints the same violations before writing.
- The envelope is tuned to pass the gate, so a violation points at a signature slot: a measured anchor that is too dark for its role. Fix it by choosing a different anchor or slot for the identity, never by waiving and never by hand-editing derived slots.
- Finish with `mise run ci`.
- When several palette agents run in parallel, skip `mise run build` (it gates every theme, including files another agent is mid-edit) and loop on `bun .claude/skills/character-palette/scripts/check-theme.ts themes/<name>.toml [...]` until it prints `gate clean`; whoever coordinates runs the global build + ci once at the end.

## 7. Eyeball check

- Generate a swatch board as scratchpad HTML: per theme, one row of measured anchors above a mock terminal (prompt, `ls`, `git status`, an error line) painted with bg / fg / cursor / selection and the 16 slots — a shell mock shows readability, a bare swatch strip does not.
- Screenshot it (chrome-devtools MCP on a `file://` URL) or publish it as an artifact and compare against the character art. Fix hue drift by changing the anchor or the base scheme — a gate-clean palette can still miss the character — then rerun steps 5 and 6.

## 8. Record

- The commit message lists, per theme, the anchors (hex + what each one is), which anchors were unmeasured, and the base scheme.
