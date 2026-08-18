---
name: character-palette
description: Build or refine character-based themes in themes/*.toml from measured colors instead of remembered ones. Use when adding themes for a new series or improving existing character palettes. Covers anchor sampling from official art, real base-scheme sourcing, the contrast-gate loop, and a swatch-board eyeball check.
---

# Character palette pipeline

Every color in a character theme must be traceable: anchors are measured from official art, the ANSI ramp comes from a real terminal scheme, and the contrast gate is the success criterion.

## 1. Identity research

- Web-search each character's appearance (hair, eyes, signature item, chuuni/persona colors) so you know what to look for before sampling.
- Theme names follow the project convention (given names); use the common alias instead when the given name collides with a character from another series already in `themes/`.
- `group` = series English name, `order` = next unused integers (`meta.order` must stay unique across all themes).
- A new series needs a `[[group]]` table in `themes/_groups.toml`: `native` = official native title, `lead` = the palette whose signature color stands for the whole series on the site's band headers and filter pills. Pick the lead for color, not seniority — Undertale leads with `determination`, Evangelion with `eva01` — and check it against the other groups' lead colors so two series do not land on the same hue.

## 2. Measured anchors

- Fetch official character art. AniList GraphQL works unauthenticated and is the most reliable source:
  - `curl -s 'https://graphql.anilist.co' -H 'Content-Type: application/json' -d '{"query":"query{Media(search:\"<title>\",type:ANIME){id characters(role:MAIN,perPage:10){edges{node{name{full} image{large}}}}}}"}'`
  - Fallback: Jikan (`https://api.jikan.moe/v4/anime?q=<title>` then `/anime/<id>/characters`) — it proxies MAL and goes down with it.
  - Download portraits to the scratchpad, never into the repo.
- Sample dominant colors: `bun .claude/skills/character-palette/scripts/sample-colors.ts <image> [k]` (k defaults to 8; decodes via macOS sips, prints hex + share, largest cluster first).
- Record 3-4 anchors per character: hair, eyes, signature item. Portraits rarely surface tiny features like irises — center-crop first (`sips --cropToHeightWidth <h> <w>`) or keep that anchor from step 1 research and note that it is unmeasured.
- Portrait backgrounds (white/gray clusters) are noise; ignore them.

## 3. Real base scheme

- Pick one existing terminal scheme per theme whose mood matches the character, and take its actual values from iTerm2-Color-Schemes: `https://raw.githubusercontent.com/mbadolato/iTerm2-Color-Schemes/master/ghostty/<Name>` (list `ghostty/` via the GitHub contents API for exact file names).
- Re-validate the pick against the measured anchors — if the measurements contradict the scheme's mood (wrong hue family, mid-tone background), switch schemes rather than fighting the base.
- Some ports fail this repo's gate as shipped (a non-dark palette 0, a low-contrast blue). Substitute a darker value from the same scheme family or nudge lightness minimally; keep everything else verbatim.
- `ansi_source = "<Scheme> + <group codename>"` — one codename per group, matching the existing `themes/*.toml` convention.

## 4. Substitution

- Start from the base scheme's 16 slots; substitute anchors into background / cursor / selection and at most 1-2 accent slots.
- ANSI 1-6 keep their functions (red=error, green=ok, yellow=warn, blue/cyan legible). Character identity lives in bg / cursor / selection plus the substituted slots — do not spread it across all 16.
- Record where the identity landed: `meta.signature` names the three slots the site renders as the card's identity block — usually `cursor` plus the two substituted slots. Order them the way the character reads (hair, then eyes or costume); the first one also colors the group's band header when the theme is its lead. The build rejects three slots that resolve to fewer than three distinct colors.

## 5. Gate loop

- `mise run build` until clean; src/contrast.ts is the success criterion (foreground 7:1, accents 3:1, ANSI 0 luminance <= 0.15, ANSI 7/15 7:1, ANSI 8 1.6:1).
- Fix violations by nudging lightness toward the gate, never by waiving.
- Finish with `mise run ci`.
- When several palette agents run in parallel, skip `mise run build` (it gates every theme, including files another agent is mid-edit) and loop on `bun .claude/skills/character-palette/scripts/check-theme.ts themes/<name>.toml [...]` until it prints `gate clean`; whoever coordinates runs the global build + ci once at the end.

## 6. Eyeball check

- Generate a swatch board as scratchpad HTML: per theme, one row of measured anchors above bg / fg / cursor and the 16 slots.
- Screenshot it (chrome-devtools MCP on a `file://` URL) and compare against the character art. Fix hue drift — a gate-clean palette can still miss the character — then rerun step 5.

## 7. Record

- The commit message lists, per theme, the anchors (hex + what each one is), which anchors were unmeasured, and the base scheme.
