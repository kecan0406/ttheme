---
name: palette
description: Build or refine character-based themes in themes/*.toml from measured colors instead of remembered ones. Use when adding themes for a new series or improving existing character palettes. Covers sourcing and measuring official art, choosing which parts carry the identity (fan consensus), real base-scheme search, the harmonizer that gives every palette one readability envelope while keeping identity surfaces true, the contrast gate, and the automatic audit plus owner review board that decides whether a palette fits its character.
---

# Palette pipeline

Every color in a character theme must be traceable: anchors are measured from official art, fan consensus decides which parts carry the identity, the ANSI ramp's hues come from a real terminal scheme, and the harmonizer folds them into one tone/chroma envelope so all palettes read the same way. Text roles are normalized; identity surfaces (cursor, selection) keep the measured color as far as readability allows. Two criteria close a batch: the contrast gate (readability) and the owner's sign-off (fit). Automatic checks only decide what the owner looks at; they never approve.

The envelope is modeled on illogical-impulse's Material You terminal theming: a dark near-neutral surface tinted by the seed color, text at a fixed light tone, and accents whose hues lean toward the seed while their lightness stays in a narrow band. Where Material's Fidelity scheme keeps a source color at its own tone in `primaryContainer`, ttheme keeps a dark identity color in `selection`.

All scripts live in `.claude/skills/palette/scripts/` and run with `bun`. Scratch work (downloads, crops, drafts, anchors files, boards) goes in the scratchpad, never the repo.

## 0. Batches

- A batch is one or more series. Per series pick 5–7 characters: the protagonists and the characters the series is known by, including designed pairs (siblings, twins, partners) — they are what tests separation.
- Theme names are the names the series and its fans use (`gojo`, `nanami`); codenames or avatar names where that is how a character is known (Persona 5, SAO: `kirito`, `sinon`). When a name collides with an existing theme, or would sit next to one (`shiro`/`shirou`), use the surname or alias (`yuigahama`, `ashiya`).
- `meta.order` must stay unique: give each series a contiguous block after the current maximum.
- Parallel mode: one agent per series. An agent writes only its own theme files and its anchors file, and loops on `check-theme.ts`. The coordinator owns `themes/_groups.toml`, runs `tags.ts`, `leads.ts`, `audit.ts` and the review board across the whole batch, then `mise run build` and `mise run ci` once.
- Every measurement goes into the batch's anchors file (JSON, scratchpad). The board, the audit and the commit record read it:
  `{ "<theme>": { "slots": { "<signature slot>": ["<part>", "#hex"] }, "unused": [["<part>", "#hex"]], "source": "<where measured>", "note": "<why the owner must look, optional>" } }`
  `slots` holds the measured anchor behind each signature slot, in signature order; the theme file holds what the harmonizer made of it.

## 1. Identity research

- Web-search each character's appearance (hair, eyes, signature item, costume) so you know what to look for before sampling.
- `group` = the series' English name as fans write it; a new series needs a `[[group]]` table in `_groups.toml` with `native` (the official title, punctuation verified: `・` U+30FB, half-width `!`, a trailing `。` where the title has one) and `lead`.
- The lead represents the series in `ttheme browse` (its cursor dot and ANSI swatch on the series row, its selection chip on the group header). Pick it with `bun leads.ts`: it enumerates every assignment of candidate seeds for the new groups and maximizes the minimum ΔE2000 against every other lead. Hue gaps alone do not work — six existing red leads sit within ΔE76 0.4 of each other. Among near-equal assignments prefer the character the series is known by.
- `meta.booru` is danbooru's tag for the character, and `[meta.booru_sites]` renames it where konachan or yande.re call the character something else — one tag, a list find ORs (`~a ~b`, moebooru only; danbooru counts tags), or `[]` where the site has none, so find sends it nothing. Find the names with `TTHEME_FIND_HOSTS=danbooru=https://safebooru.donmai.us bun names.ts themes/<name>.toml` (the mirror, because danbooru.donmai.us is blocked on this network and its tag, alias and post endpoints answer the same): it gathers ~600 of the character's danbooru files, looks them up by md5 on each moebooru site and proposes the character tag those files carry there — taken only when danbooru's aliases lead it back to this character, or when danbooru does not know it and it shares a name token with at least 30 % of the matches; measured on 28 broken site names it named 23 with no wrong pick, and substring guesses on `tag.json` pick other characters (`sukuna` is an artist on konachan, `sailor_moon` the whole series). Then `bun tags.ts themes/<name>.toml [--try <tag>]` (same mirror) must pass: every named site searches to more than 0 posts, and every name is a character tag that is not deprecated (a moebooru name missing from `tag.json` but found by search is an alias and passes). Moebooru resolves its own aliases in search, so a name that already works there needs no entry.

## 2. Sources

Work down this ladder and stop at the first source that gives a clean, evenly lit render of the anime's own design:

1. The anime's official site character pages — often transparent PNGs of the design itself (Oregairu S2 at tbs.co.jp, Black Bullet at black-bullet.net).
2. The series' Fandom wiki settei: `<Name>_(Anime).png`, `<Name>-design.jpg`, `<Name>_Anime_HQ.png`. List files with `curl -s -G 'https://<wiki>.fandom.com/api.php' --data-urlencode 'action=query' --data-urlencode 'format=json' --data-urlencode 'list=allimages' --data-urlencode 'aiprefix=<Name>' --data-urlencode 'ailimit=60' --data-urlencode 'aiprop=url|dimensions'`. `static.wikia.nocookie.net` needs a browser `User-Agent`, `Referer: https://<wiki>.fandom.com/`, `Sec-Fetch-Dest: image`, `Sec-Fetch-Mode: no-cors`, `Sec-Fetch-Site: cross-site` and the path `images/<md5[0]>/<md5[0:2]>/<File>/revision/latest/scale-to-width-down/1000?format=original` (build it from the file name's md5; the API's URL already carries `/revision/latest?cb=`). Episode stills (1920×1080) are not settei.
3. Other wikis that host settei scans (Code Geass: geass.miraheze.org, files on `static.wikitide.net`).
4. Anime stills or key visuals only when the character's skin measures exactly the settei skin — then the scene lighting did not move the colors. Reject graded stills.
5. safebooru.donmai.us `posts.json?tags=<tag> official_art` (two tags anonymously), keeping posts whose `tag_string` has `solo`. Manga and light-novel covers are duotone-graded — reject them.

AniList and Jikan images are manga color-page crops: use them to confirm a cast list only. Check every download with `file` — a Cloudflare challenge arrives as HTML. Use one production's design for the whole cast and say which.

## 3. Measure

- `bun flats.ts <image> --crop x,y,w,h` counts exact colors over opaque pixels only (transparency is ignored, never composited onto black), lists them with share and HCT, and marks lit/shadow pairs. Crop one part at a time; a full-body settei puts the head in the top tenth.
- `--quant N` buckets channels for JPEGs and scans, whose flats arrive as thousands of near-duplicates. `--median` gives the median of a gradient iris.
- Measure the lit flat, not the shadow: cels hold two or three flats per surface. A castmate designed as a pair (Lucky Star's twins share a hair flat within 5° of hue) is separated by taking one twin's lit flat and the other's shadow flat, both measured.
- Record 3–4 anchors per character (hair, eyes, signature item, costume) and the ones you measured but did not use.

## 4. Choose the identity

Measured hex values always come from the design; this step only decides which parts they come from. Tiers, in order:

1. An official image color that is visible on the design (Homura's purple gem and eyes; Bocchi's band merch follows hair). An official color the character does not wear is at most a tiebreak — K-On!'s Yui is "red" in fan lore, and her 2,338 solo posts carry no red tag.
2. Chromatic hair that no castmate shares.
3. Fan consensus, for achromatic or colliding hair: `bun consensus.ts <danbooru_tag>` reads Danbooru's related tags over `<tag> solo` (without `solo` castmates leak in). An eye color at ≥ .5 or an item color at ≥ .3, with n ≥ 50, names the part (Yukino: blue eyes .74; Leafa: green eyes .90). These thresholds are proposals — record the owner's picks against them.
4. An achromatic identity, when consensus says the character is black/white/grey (Kirito: black hair .86, black eyes .58). Do not invent a hue for them: an achromatic seed makes near-neutral surfaces and turns off the hue rotation.
5. The owner, when the sample is thin (n < 50) or there is no consensus: show the candidate parts as swatches and let the owner pick before harmonizing. Write the reason into the anchors file's `note`.

Sample the whole cast in one pass and compare anchors across it before assigning any slot.

## 5. Slots

- `meta.signature` names three slots in the order the character reads; the first is the seed. The build rejects three slots that resolve to fewer than three distinct colors.
- `cursor` usually holds the seed anchor.
- A dark identity color — an anchor darker than T42.6, which cannot clear 3:1 on the tone-8 background as text — goes into `selection_background`, and `selection` goes into `meta.signature`. The harmonizer keeps its hue and chroma and clamps its tone to 16–30, so it stays the color it was measured as (Suzaku's cape stays `#252968`); the site draws it as a chip, not a dot. One per palette: the darkest. A second dark anchor stays out of the signature (only its hue survives in an ANSI slot) or, when the owner wants it on the card, in an ANSI signature slot as a pastel copy. The harmonizer refuses a dark anchor in an ANSI signature slot when `selection` is not in the signature.
- ANSI 1–6 keep their functions (red error, green ok, yellow warn, blue/cyan legible). A pale anchor needs a bright slot: tone is fixed per function, so a tone-90 butter yellow in `ansi3` (T76) comes back mustard; `ansi11` (T88) keeps it.
- White or pale hair can carry the identity as `foreground` (the harmonizer keeps its hue at T90).
- Background, foreground and ANSI 0/7/8/15 are derived from the seed; write the base scheme's values there and let the harmonizer replace them.

## 6. Base scheme

- Write the anchors into a draft toml (any scheme's values elsewhere) and run `bun pick-base.ts <draft>.toml [--include <name>]`. It harmonizes the draft against every dark scheme in mbadolato/iTerm2-Color-Schemes and ranks them by how far ANSI 1–6/9–14 drift from their function hues (the corpus medians: red 22, green 143, yellow 90, blue 253, magenta 332, cyan 200) and by the closest pair of function colors. Choose among the top for mood.
- A seed far from the function hues drifts with any scheme (the rotation cap is 60°); the ranking picks the least bad, it cannot remove it.
- `ansi_source = "<Scheme> + <group codename>"` — one codename per group. It records what the harmonizer was fed.

## 7. Harmonize

`bun harmonize.ts --write themes/<name>.toml [...]` rewrites `[colors]` (omit `--write` to report) and prints, per signature slot, the measured value → the written one with ΔE2000. It reads `meta.signature[0]` as the seed:

- background / foreground: seed hue, chroma ≤ 8 / ≤ 12, tone 8 / 90 (light palettes 98 / 12).
- ANSI 0/7/8/15: the same tinted neutral at tones 14 / 80 / 50 / 94.
- selection, not in the signature: its own hue, chroma ≤ 24, tone 26. In the signature: its own hue and chroma, tone 16–30 (light 70–90).
- ANSI 1–6 and 9–14: hue rotated toward the seed by 40 % of the distance, capped at 60° — no rotation when the seed's chroma is below 10 (an achromatic identity); chroma 32–64; tone fixed per function (red 66, green 70, yellow 76, blue 66, magenta 68, cyan 72), bright +12. Grey inputs (chroma < 10) fall back to canonical hues.
- signature ANSI slots keep their measured hue and take the envelope's chroma and tone, skipping the rotation.
- cursor: its own hue; chroma kept when below 16 (grey hair stays grey), otherwise 32–64; tone clamped to 43–84 (light 36–56) — 43 is the 3:1 floor on the tone-8 background.
- Signature slots are idempotent; everything else is one-way: re-running rotates non-signature hues further toward the seed. To re-tune a shipped theme, re-fetch the base scheme named in `ansi_source`, redo the substitution, and run it once. Changing the envelope means re-running every theme from its base scheme.

## 8. Gate

- `mise run build` until clean (or, in parallel mode, `bun check-theme.ts themes/<name>.toml [...]` until `gate clean`). src/contrast.ts is the readability criterion: foreground 7:1, accents 3:1, ANSI 0 luminance ≤ 0.15, ANSI 7/15 7:1, ANSI 8 1.6:1, foreground on selection 7:1. It is also the function criterion, in OKLCH: each accent's hue stays in its ANSI role's band (`ROLE_HUES`, red 19±25°, green 132±35°, yellow 88±35°, blue 250±60°, magenta 329±40°, cyan 197±60° — centred on ten well-known schemes, all of which pass), each bright stays within 25° of its normal, and no two accents in a row sit within 15° hue and 0.08 lightness. An ANSI slot in `meta.signature`, and its normal/bright twin, is exempt from the band, since the character's color lives there.
- A role violation is fixed by `bun ansi-roles.ts [--write] [--report <file.json>] themes/<a>.toml [...]`: it turns the hue only (lightness and chroma kept, chroma cut back when out of gamut) — to just inside the band, a bright to within 20° of its normal, a look-alike pair to the nearest clear hues — then re-runs the whole gate. Its report feeds the review board; a turn of ΔE2000 15 or more goes to the owner.
- The envelope is tuned to pass, so a violation points at an anchor or slot choice. Fix it there — never by waiving, never by hand-editing derived slots.

## 9. Review

- `bun audit.ts --anchors <file> themes/<a>.toml [...]` prints the owner review list: signature triplets closer than ΔE2000 13 to a castmate, cursors closer than 3 to any other series' cursor, cursor/selection departures above ΔE2000 10, hue shifts above 12°, and every anchors `note`.
- `bun board.ts --anchors <file> --out <board.html> [--variants <variants.json>] [--art <theme>=<image> ...] [--title "<Series> palettes"] themes/<a>.toml [...]` renders the series board — cast strip, per-character art and anchors beside the palette card and a terminal mock, measured → final table, a two-at-a-time chooser for the characters in `--variants` (`{ "<theme>": { "<key>": { "label", "colors", "signature" } } }`), and a sign-off per series. Publish it as a private Artifact with `capabilities: {db: {}}` (load the artifact-design and artifact-capabilities skills first). The owner signs off each series (`signoff/<series-slug>`) and, for each flagged character, picks between measured variants — other measured parts or slots, never invented colors — or "neither" (`picks/<theme>`). Read them back with ArtifactData, apply them, and re-run the audit.
- A vision model is not the judge: blind matching measures whether palettes can be told apart, not whether each is faithful (a wrong but unique palette passes), and VLMs score 57–60 % on fine color tasks (ColorBench, 2025).

## 10. Record

`bun record.ts --anchors <file> themes/<a>.toml [...]` prints the per-theme block the commit message carries: base scheme, signature, the anchors behind it and the ones measured but unused. Add the lead rationale and any owner picks.
