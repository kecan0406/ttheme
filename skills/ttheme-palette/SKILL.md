---
name: ttheme-palette
description: Make a ttheme terminal palette for an anime, game or other character from its official art — research the character, measure colors from an official picture, and let the installed ttheme CLI harmonize, check and install it. Use when the user asks for a ttheme palette or terminal theme of a character, or of a whole work's cast.
---

# Character palettes with ttheme

A palette is made from colors measured on the character's own design, never from remembered ones. You research the character, find a clean official picture, measure the parts that carry the identity, write them into an anchors file, and `ttheme palette make` turns them into a palette that passes ttheme's contrast checks, writes it into the user's local marketplace and installs it. You decide every step yourself and tell the user afterwards what you chose and why. The one thing you ask is which picture to measure.

## 0. Check the CLI

Run the CLI the install put there, `node ~/.config/ttheme/ttheme.js` (with `$XDG_CONFIG_HOME` in place of `~/.config` where that is set) — this file writes it as `ttheme`. Never the `ttheme` your shell may already know: that is a function of the user's interactive shell, and outside it its help prints nothing and its commands fail. Run `ttheme help palette`; if the file is missing or the help names no `--work` flag, ttheme is not installed or is older than 1.2.67: tell the user to run `npx @kecan0406/ttheme@latest init` and stop. That help is the reference for the flags, the anchors format and the exit codes; the fields of each JSON result are named in the steps below. Always pass `--json` and read the result from stdout; stderr is for people.

Exit codes: 0 done, 1 failed, 2 nothing changed, 3 your input is invalid (the JSON says which field and what it accepts — fix it and run again), 4 a network request failed (retry once, then tell the user).

## 1. Scope

One character, or a work's cast (5–7: the protagonists and the characters the work is known by). A palette is the user's take on a character: one that ttheme ships, or another marketplace has, does not stop you — every list shows the takes on one character side by side. `ttheme check <name>` describes a palette by that name, built-in or the user's, and says so when there is none; a palette of the user's own by that name would be written over, so pick another name or ask. Use one production's design for the whole cast.

Every character belongs to a work — a series, a game, a franchise — in the commons, ttheme's one list of works and their characters, which every marketplace's palettes name. `make` finds the character there by its danbooru tag and makes it the palette's `subject`. When the commons does not hold the character, pass `--work <id>`: the work's id is its English title as fans write it, short form where one is common, in lowercase letters, digits and single hyphens (`frieren`, `bocchi-the-rock`) — `~/.config/ttheme/commons.json` lists the works the commons holds (`works`, each an `id` and a `name`), so use the id there when the work is one of them. For a work the commons lacks, add `--work-name "<English title>"` and `--work-native "<official title>"`. `make` then writes the character, or the whole work, into the user's marketplace's `works/` folder, where it shows as any other until the commons takes it in.

A palette is named the way the work and its fans name the character (`gojo`, `nanami`), or by codename or avatar where that is how the character is known (`joker`, `kirito`).

## 2. Research

Search the web for the character's appearance — hair, eyes, signature item, costume — so you know what to look for in the picture. Find the character's danbooru tag (`https://danbooru.donmai.us/wiki_pages/<tag>`); it is who the character is to ttheme: it finds the character in the commons by it, and searches it for the palette's background pictures. Check it with `ttheme palette consensus <tag> --json` now: `posts` 0 means danbooru has no such tag, and `current`, when present, is the name it goes by today — use that. Keep the rest of the result for step 5.

## 3. Find a picture and ask the user

Work down this list and stop at the first clean, evenly lit render of the anime's own design:

1. The anime's official site, character pages — often transparent PNGs of the design itself. When the site answers a challenge page instead, its copy on the Wayback Machine (`https://web.archive.org/web/2024/<page>`) names the picture files, which usually still download.
2. The series' Fandom wiki settei (character design sheets): files named like `<Name>_(Anime).png`, `<Name>-design.jpg`, `<Name>_Anime_HQ.png`.
3. Other wikis that host settei scans.
4. Official key visuals or stills only when the skin is the settei's skin (scene lighting did not move the colors).

Reject episode stills with graded lighting, manga and light-novel covers (duotone-graded), fan art and AI pictures. An official picture beats a larger copy someone scaled up; small parts such as eyes are measured with `--quant` and the `median`. Show the user the one or two best candidates (links; the second may come from further down this list) and ask which to measure. The picture is only measured — never saved into the palette, shared or uploaded.

## 4. Measure

```
ttheme palette measure <file|url> --preview --json
```

downloads a URL (kept in ttheme's cache, so the next calls read it from there), writes a preview at most 800 px on its long side, gives its path in `preview.path`, and lists the picture's main flat colors. Look at the preview, then measure one part at a time with a box in the preview's pixels:

```
ttheme palette measure <file|url> --preview --crop x,y,w,h --json
```

ttheme maps the box back onto the full picture and counts its exact colors over opaque pixels (a transparent PNG's background never counts). Take the surface's main flat — the largest share in a box that holds only that surface. Cels hold two or three flats per surface, and a flat is marked `shadowOf` the brighter flat of the same hue it darkens and `lit` when it has such a shadow; when the main flat is marked `shadowOf`, the lit flat it names is the one to take only if it holds a fair share of the box too — a sliver of a few percent is a highlight. A JPEG, or a small or antialiased picture, spreads one flat over many near-duplicates: add `--quant 32`, or `--quant 16` when the list still shows the same color in several close shades. Every result also gives the box's `median`. An iris is a gradient: put the box inside the iris alone — no lashes, no pupil, no white —, measure both eyes, and take the median of the clearer one; when a box a pixel over moves the median by more than a few tones, the iris is too small to measure well, so say so in the report. ttheme reads PNG and JPEG everywhere and other formats only through macOS; elsewhere pick another candidate or turn the picture into a PNG. If you cannot see pictures, pick parts from the whole-picture list instead and say so in your report.

Measure 3–4 parts per character: hair, eyes, a signature item, the costume.

## 5. Choose the identity

Measured values always come from the picture; this step only picks which parts. In order:

1. An official color the design visibly carries (a gem, the eyes, an item the series makes merch of).
2. Chromatic hair — hair whose lit flat measures `chroma` 10 or more. Paler hair (silver, platinum, a white with a tint) counts as white.
3. Fan consensus, for black, white or grey hair: the `consensus` you ran in step 2 reads which colors danbooru's posts of the character tag. Its `verdict` names the part: eyes (≥ .5), an item (≥ .3), achromatic, or too few posts (< 50). `posts` counts the character's safe-rated solo posts, fewer than the tag's own count on danbooru.
4. An achromatic identity, when consensus says the character is black, white or grey: do not invent a hue — the palette then stays near-neutral.
5. Your best reading, when the sample is thin or there is no consensus — say so in the report.

Castmates may share colors — twins, siblings, a series where everyone has red hair. Measure each on their own design and do not push them apart.

## 6. Signature colors

The anchors file's `slots` names three of the palette's colors per character, in the order the character reads — the first is the seed every other color leans toward:

- `cursor` usually holds the seed: the hair, or the eyes when consensus picked them.
- A dark identity color (a cape, a uniform — anything darker than mid-grey) goes into `selection`; text colors cannot show it.
- `ansi1`–`ansi6` keep their meaning (red error, green ok, yellow warning, blue, magenta, cyan). Put an anchor in the ANSI color whose role matches its hue; a pale one (butter yellow, pastel pink) in its bright twin `ansi9`–`ansi14`.
- White or pale hair can be the `foreground`.

```json
{
  "bocchi": {
    "booru": "gotoh_hitori",
    "slots": {
      "cursor": ["hair", "#ffb7c8"],
      "ansi4": ["eyes", "#7b96c8"],
      "ansi9": ["track jacket", "#f39cbf"]
    },
    "source": "<the picture's URL>"
  }
}
```

One file holds the whole cast. `ttheme help palette` lists every field (`native_names`, the character's names in its original language, is recorded only for a character the commons does not hold yet, so give it for every such character).

## 7. Make

```
ttheme palette make --anchors anchors.json [--work <work> [--work-name "<English title>" --work-native "<official title>"]] --dry-run --json
```

ranks base schemes for the ANSI colors, harmonizes every color into ttheme's envelope, keeps the anchors' colors as far as readability allows, fixes the ANSI roles and runs the contrast checks — and shows the result without writing. Read each palette in it: `subject` (the work and character it is of — check it names the character you meant; a palette with none is an original, so pass `--work` when it is missing), `colors` (all twenty), `nativeNames` (the names ttheme filled in — set `native_names` in the anchors yourself when they hold a series title or a nickname), `signature` (each signature color's part, `measured` and `final` color and `delta`, the ΔE2000 between them, with `far` set when a cursor or selection moved more than 10 and `turned` when a hue moved more than 12°), `turned` (the ANSI colors the role fixer moved, and why), `lookalikes` (signature colors that read as one at text size) and `gate` (contrast checks it still fails, normally none); `shift` is a color's hue move in degrees, `changed` says the file would differ from what is there, `written` that it was written, and `notes` carries what ttheme noticed on the way (a base scheme list it could not fetch, a tag danbooru renamed, a character the commons holds under another work than `--work`). `works` lists what `make` adds to the marketplace's `works/`: each `work`, the `characters` it records there and the `file`, with `changed` and `written` as for a palette. A color that came out `far` or `turned` usually means the anchor or the color it went into is wrong — go back to step 6 rather than accept it. Then run the same command without `--dry-run`: the palettes are written into the user's local marketplace (`--in <marketplace>` when they have several) and installed. Exit 2 means they were already there unchanged.

If `make` says the user has no marketplace yet, make one: `ttheme marketplace init <name>`, with a name the user gave or `characters`. Their palettes are named `<GitHub handle>@<marketplace>/<palette>`; when ttheme cannot read the handle from `gh` it says so — ask the user for it then and pass `--owner <handle>`.

## 8. Report

Tell the user, per palette, in their language:

- its full name and `ttheme use <owner>@<marketplace>/<name>` to use it in a tab — the short name alone works only while no other installed palette has it (you cannot change their tab from your shell);
- the work and character it is of, and whether you added them to the marketplace's `works/` because the commons did not hold them;
- which picture you measured;
- each signature color: the part, the measured color, the final color and ΔE, and why that part (an official color, chromatic hair, or consensus with its share and post count);
- the base scheme, the colors the role fixer turned and why, and any contrast check it still fails;
- anything you were unsure of.

Then, once: `ttheme edit <full name>` tunes it by hand, `ttheme` opens Preview, where the palette's panel finds background pictures by its danbooru tag (`f`; other sites may name the character otherwise and find fewer), and `ttheme share` shares it as a link or a GitHub marketplace — run `share` only when the user asks.

## Inside the ttheme repository

The built-in palettes follow the same steps from a checkout, with `bun src/bin.ts palette make … --in builtin`: `make` then writes `builtin/palettes/<name>.toml` with its `subject` and its other mode as `[colors.light]` or `[colors.dark]`, which the build requires, and records a character or a work the commons lacks in `commons/works/<work>.toml` rather than in a `works/` proposal. A built-in palette always names a subject, so pass `--work` for a character the commons does not hold yet. Finish with `mise run build` and `mise run ci`; a palette change ships as a patch release.
