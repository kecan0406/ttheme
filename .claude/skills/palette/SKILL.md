---
name: palette
description: Build or refine character-based themes in themes/*.toml from measured colors instead of remembered ones. Use when adding themes for a new series or improving existing character palettes. Covers anchor sampling from official art, real base-scheme sourcing, the harmonizer that gives every palette one readability envelope, the contrast-gate loop, and a swatch-board eyeball check.
---

# Palette pipeline

Every color in a character theme must be traceable: anchors are measured from official art, the ANSI ramp's hues come from a real terminal scheme, and the harmonizer folds both into one shared tone/chroma envelope so all palettes read the same way. The contrast gate is the success criterion.

The envelope is modeled on illogical-impulse's Material You terminal theming: a dark near-neutral surface tinted by the seed color, text at a fixed light tone, and accents whose hues lean toward the seed while their lightness stays in a narrow band. Only the seed and the hues vary per character.

## 1. Identity research

- Web-search each character's appearance (hair, eyes, signature item, chuuni/persona colors) so you know what to look for before sampling.
- Theme names follow the project convention (given names); use the common alias instead when the given name collides with a character from another series already in `themes/`.
- `group` = series English name, `order` = next unused integers (`meta.order` must stay unique across all themes).
- A new series needs a `[[group]]` table in `themes/_groups.toml`: `native` = official native title, `lead` = the palette whose signature color stands for the whole series on the site's sidebar group headers. Pick the lead for color, not seniority — Undertale leads with `determination`, Evangelion with `eva01` — and check it against the other groups' lead colors so two series do not land on the same hue.

## 2. Measured anchors

- Fetch official character art. The anime's own full-body settei is the only source whose colors are the character's; everything else is a colorist's interpretation. Work down this order and stop at the first one that yields a clean, evenly lit render:
  - The series' Fandom wiki, which hosts the settei as transparent PNGs. List them, then resolve the URL:
    - `curl -s -G 'https://<wiki>.fandom.com/api.php' --data-urlencode 'action=query' --data-urlencode 'format=json' --data-urlencode 'list=allimages' --data-urlencode 'aiprefix=<Character Name>' --data-urlencode 'ailimit=60' --data-urlencode 'aiprop=url|dimensions'` — the settei are the `<Name>_(Anime).png` / `_(Anime_2).png` entries, not the 1920x1080 episode stills. `prop=pageimages&piprop=original&titles=<Name>` gives the page's own infobox pick.
    - `static.wikia.nocookie.net` serves a Cloudflare challenge on the original path. Fetch `<url>/revision/latest/scale-to-width-down/1000?format=original` with a browser `User-Agent` and `Referer: https://<wiki>.fandom.com/`.
  - safebooru.donmai.us for an official illustration when the settei hides the anchor (a blindfold over the eyes, a closed hand over a signature item): `posts.json?tags=<character_tag> official_art&limit=60`, then keep only posts whose `tag_string` has `solo`. Anonymous queries take two tags. Manga volume covers land here too and are duotone-graded — reject them.
  - AniList / Jikan character images are manga color-page crops, not anime color, and they are cropped too tight to carry a costume anchor. Use them only to confirm a cast list.
  - Download to the scratchpad, never into the repo.
- Flatten alpha before sampling. `sips` composites transparent PNGs onto black, which swamps every cluster: `ffmpeg -y -i <in>.png -filter_complex "color=white:s=<W>x<H>:d=1[bg];[bg][0]overlay=format=auto:shortest=1" -frames:v 1 <out>.png` (without `-frames:v 1` the color source never ends and the muxer errors out).
- Sample dominant colors: `bun .claude/skills/palette/scripts/sample-colors.ts <image> [k]` (k defaults to 8; decodes via macOS sips, prints hex + share, largest cluster first).
- k-means only works on art big enough that the flats outweigh their own edges. A settei under ~400px wide returns antialiasing averages — every cluster comes back desaturated mush. Cel art is drawn in exact RGB over wide areas, so count exact pixel values instead and read the flats straight off the histogram.
- Record 3-4 anchors per character: hair, eyes, signature item. A full-body settei puts the head in the top tenth, so crop before sampling — `ffmpeg -y -i <in>.png -vf "crop=<w>:<h>:<x>:<y>,scale=760:-1:flags=neighbor"` keeps the flat cel fills unblended and large enough to read coordinates off.
- Portrait backgrounds (white/gray clusters) are noise; ignore them.
- **The seed is the hair.** `meta.signature[0]` is the character's dominant surface — hair unless it is achromatic or shared with another palette in the cast, then eyes, then the signature item. Never pick by saturation: anime cels sit at chroma 20-40 and the harmonizer normalizes signature chroma anyway, so a low-chroma hair anchor is not a dull card. Picking the most saturated color instead is what puts a prop's color on a character who is not that color.
- Sample the base tone, not the shadow. Anime cels hold two or three flats per surface and a k-means centroid drifts toward the darker one, which is what pushes an anchor under the accent gate. For a dark costume, measure the lit flat directly.
- Sample the cast in one pass and compare anchors across it before assigning any slot. Characters designed as a pair share their dominant surface on purpose — Lucky Star's twins have the same hair flat to within 5° of hue — so the cast, not the character, decides what separates two palettes: take one twin's lit flat and the other's shadow flat, both measured, and let tone do the work. Their props (`#45282d` vs `#feed97`) carry the rest.

## 3. Real base scheme

- Pick one existing terminal scheme per theme whose hue family matches the character, and take its actual values from iTerm2-Color-Schemes: `https://raw.githubusercontent.com/mbadolato/iTerm2-Color-Schemes/master/ghostty/<Name>` (list `ghostty/` via the GitHub contents API for exact file names).
- Only the scheme's hues survive the harmonizer; its lightness and saturation are normalized away. Pick for hue family and mood (cool blues, warm ambers, purple-leaning magentas), not for how dark or vivid it ships.
- Re-validate the pick against the measured anchors — if the measurements contradict the scheme's hue family, switch schemes rather than fighting the base.
- `ansi_source = "<Scheme> + <group codename>"` — one codename per group, matching the existing `themes/*.toml` convention. This is also the record of what the harmonizer was fed, so it must stay accurate.

## 4. Substitution

- Start from the base scheme's 16 slots; substitute anchors into cursor and at most 1-2 accent slots.
- ANSI 1-6 keep their functions (red=error, green=ok, yellow=warn, blue/cyan legible). Character identity lives in cursor plus the substituted slots — do not spread it across all 16. Check the base scheme's slots against their functions before adopting it: Oxocarbon ships cyan in slot 1 and green in slot 4, Rose Pine's green is a teal, and the harmonizer preserves input hue, so the scheme's mistake becomes the theme's error color.
- A pale anchor needs a bright slot. Tone is fixed per function, so a tone-90 butter yellow dropped into `ansi3` (tone 76) comes back mustard; `ansi11` (tone 88) keeps it.
- Background, foreground, selection and ANSI 0/7/8/15 are surfaces: the harmonizer derives them from the seed, so a measured value there only survives if that slot is in `meta.signature` (a measured foreground is the usual case). Write the base scheme's values and let the harmonizer replace them.
- A dark identity color cannot be a signature slot. The site draws the three signature colors as dots on the theme's own background, so a near-black uniform or robe vanishes there, and the accent gate needs roughly relative luminance 0.12 to clear 3:1 against a tone-8 background. Put that color in a non-signature accent slot instead — only its hue survives, which is what you wanted from it — and let the seed carry it into the background, where a dark character belongs anyway.
- Record where the identity landed: `meta.signature` names the three slots the site renders as the card's identity block — usually `cursor` plus the two substituted slots. Order them the way the character reads (hair, then eyes or costume); the first one is the seed and also colors the group's band header when the theme is its lead. The build rejects three slots that resolve to fewer than three distinct colors.

## 5. Harmonize

- `bun .claude/skills/palette/scripts/harmonize.ts --write themes/<name>.toml [...]` rewrites the `[colors]` block in place (omit `--write` to only report). It reads `meta.signature[0]` as the seed and:
  - background / foreground: seed hue, chroma ≤ 8 / ≤ 12, tone 8 / 90 (light palettes: 98 / 12, detected from the input background).
  - ANSI 0/7/8/15: the same tinted neutral at tones 14 / 80 / 50 / 94.
  - selection: the input's hue, chroma ≤ 24, tone 26.
  - ANSI 1-6 and 9-14: the input hue rotated toward the seed by 40 % of the distance, capped at 60°; chroma clamped to 32-64; tone fixed per function (red 66, green 70, yellow 76, blue 66, magenta 68, cyan 72) with bright slots +12. Grey inputs (chroma < 10) fall back to canonical hues.
  - signature slots keep their measured hue and take the envelope's chroma and tone, skipping the rotation. `cursor` has no ANSI function, so instead of a fixed tone it keeps the anchor's own tone clamped to 60-84 (light palettes 36-56) — that band is what lets two characters who share a hue still read apart.
- The transform is one-way for the ramp but idempotent for the signature: re-running it rotates every non-signature hue further toward the seed, while the identity colors land on the same values. It still consumes the base-scheme ramp, so to re-tune a shipped theme, re-fetch the base scheme named in `ansi_source`, redo step 4, and run it once.
- Changing the envelope means editing the constants at the top of the script and re-running it over every theme from the base schemes, so every palette moves together.

## 6. Gate loop

- `mise run build` until clean; src/contrast.ts is the success criterion (foreground 7:1, accents 3:1, ANSI 0 luminance <= 0.15, ANSI 7/15 7:1, ANSI 8 1.6:1). The harmonizer prints the same violations before writing.
- The envelope is tuned to pass the gate, so a violation points at a signature slot: a measured anchor that is too dark for its role. Fix it by choosing a different anchor or slot for the identity, never by waiving and never by hand-editing derived slots.
- Finish with `mise run ci`.
- When several palette agents run in parallel, skip `mise run build` (it gates every theme, including files another agent is mid-edit) and loop on `bun .claude/skills/palette/scripts/check-theme.ts themes/<name>.toml [...]` until it prints `gate clean`; whoever coordinates runs the global build + ci once at the end.

## 7. Eyeball check

- Generate a swatch board as scratchpad HTML covering the whole series at once, never one theme at a time: per character, the source art beside its measured anchors and its three signature slots, above a mock terminal (prompt, `ls`, `git status`, an error line) painted with bg / fg / cursor / selection and the 16 slots. A shell mock shows readability, a bare swatch strip does not, and a per-theme board cannot show the error that matters most — two castmates who should be related and are not, or who collapsed into the same palette.
- Screenshot it (chrome-devtools MCP on a `file://` URL, or `Google Chrome --headless --screenshot` when the MCP profile is already in use) or publish it as an artifact, and compare against the character art. Fix hue drift by changing the anchor or the base scheme — a gate-clean palette can still miss the character — then rerun steps 5 and 6.

## 8. Record

- The commit message lists, per theme, the anchors (hex + what each one is), which anchors were unmeasured, and the base scheme.
