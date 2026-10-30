---
name: ttheme-palette
description: Make a ttheme terminal palette for an anime, game or other character from its official art — research the character, measure colors from an official picture, and let the installed ttheme CLI harmonize, check and install it. Use when the user asks for a ttheme palette or terminal theme of a character, or of a whole work's cast.
---

# Character palettes with ttheme

A palette is made from colors measured on the character's own design, never from remembered ones. Decide every step yourself and tell the user afterwards what you chose and why. The one thing you ask is which picture to measure.

## 0. Check the CLI

Run the CLI the install put there, `node ~/.config/ttheme/ttheme.js` (with `$XDG_CONFIG_HOME` in place of `~/.config` where that is set) — this file writes it as `ttheme`. Never the `ttheme` your shell may already know. Run `ttheme help palette`; if the file is missing or the help names no `--work` flag, ttheme is not installed or is older than 1.2.67: tell the user to run `npx @kecan0406/ttheme@latest init` and stop. If the help names a skill format above 3, this file is older than that ttheme: tell the user to update the skill the way they added it (`init` again, `npx skills add kecan0406/ttheme`, or the ttheme-palette plugin) and stop. That help is the reference for the flags, the anchors format and the exit codes. Always pass `--json` and read the result from stdout.

Exit codes: 0 done, 1 failed, 2 nothing changed, 3 your input is invalid (the JSON says which field and what it accepts — fix it and run again), 4 a network request failed (retry once, then tell the user).

## 1. Scope

One character, or a work's cast (5–7: the protagonists and the characters the work is known by), all from one production's design. A palette of the same character that ttheme ships or another marketplace has does not stop you. `ttheme check <name>` says whether a palette by that name exists; one of the user's own by that name would be written over, so pick another name or ask.

When `make`'s dry run shows a palette with no `subject`, the commons does not hold the character: read `references/new-work.md`.

Name a palette the way the work and its fans name the character (`gojo`, `nanami`), or by codename or avatar where that is how the character is known (`joker`, `kirito`).

## 2. Research

Search the web for the character's appearance — hair, eyes, signature item, costume. Find the character's danbooru tag (`https://danbooru.donmai.us/wiki_pages/<tag>`) and check it with `ttheme palette consensus <tag> --json`: `posts` 0 means danbooru has no such tag, and `current`, when present, is the name to use. Keep the result for step 5.

## 3. Find a picture and ask the user

Stop at the first clean, evenly lit render of the anime's own design:

1. The anime's official site, character pages. When the site answers a challenge page, its copy on the Wayback Machine (`https://web.archive.org/web/2024/<page>`) names the picture files.
2. The series' Fandom wiki settei: files named like `<Name>_(Anime).png`, `<Name>-design.jpg`, `<Name>_Anime_HQ.png`.
3. Other wikis that host settei scans.
4. Official key visuals or stills, only when the skin is the settei's skin.

Reject episode stills with graded lighting, manga and light-novel covers, fan art and AI pictures. Prefer an official picture to a larger upscaled copy. Show the user the one or two best candidates as links and ask which to measure. Never save, share or upload the picture.

## 4. Measure

```
ttheme palette measure <file|url> --preview --json
```

gives a preview's path in `preview.path` and the picture's main flat colors. Look at the preview, then measure one part at a time with a box in the preview's pixels:

```
ttheme palette measure <file|url> --preview --crop x,y,w,h --json
```

- Take the surface's main flat: the largest share in a box that holds only that surface.
- When the main flat is marked `shadowOf`, take the lit flat it names only if that holds a fair share of the box too.
- For a JPEG, or a small or antialiased picture, add `--quant 32`, or `--quant 16` when the same color still shows in several close shades.
- For an iris, put the box inside the iris alone, measure both eyes and take the `median` of the clearer one; when a box a pixel over moves the median by more than a few tones, say in the report that the iris is too small to measure well.
- Outside macOS, ttheme reads PNG and JPEG only: pick another candidate or turn the picture into a PNG.
- If you cannot see pictures, pick parts from the whole-picture list and say so in the report.

Measure 3–4 parts per character: hair, eyes, a signature item, the costume.

## 5. Choose the identity

Measured values always come from the picture; this step only picks which parts. In order:

1. An official color the design visibly carries (a gem, the eyes, an item the series makes merch of).
2. Chromatic hair: hair whose lit flat measures `chroma` 10 or more. Paler hair counts as white.
3. Fan consensus, for black, white or grey hair: `consensus`'s `verdict` names the part — eyes (≥ .5), an item (≥ .3), achromatic, or too few posts (< 50).
4. An achromatic identity, when consensus says so: invent no hue.
5. Your best reading, when the sample is thin or there is no consensus — say so in the report.

Measure castmates each on their own design and do not push them apart.

## 6. Anchors

The anchors file's `slots` puts each part you measured into one of the palette's colors. Every character needs `cursor`:

- `cursor` holds the character's main color: the hair, or the eyes when consensus picked them.
- A dark identity color (anything darker than mid-grey) goes into `selection`.
- `ansi1`–`ansi6` keep their roles (red error, green ok, yellow warning, blue, magenta, cyan): put an anchor in the ANSI color whose role matches its hue, a pale one in its bright twin `ansi9`–`ansi14`. A hue no role holds goes in `cursor`, `selection` or `foreground` when it carries the identity; otherwise keep the moved color and say so in the report.
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

One file holds the whole cast. `ttheme help palette` lists every field.

## 7. Make

```
ttheme palette make --anchors anchors.json [--work <work> [--work-name "<English title>" --work-native "<official title>"]] --dry-run --json
```

shows the result without writing. Read each palette in it with `references/make-result.md`. Check that its `subject` names the character you meant, and pass `--work` when it is missing (`references/new-work.md`). A color that came out `far` or `turned` usually means the anchor or its slot is wrong: go back to step 6. Then run the same command without `--dry-run` to write the palettes into the user's local marketplace (`--in <marketplace>` when they have several) and install them. Exit 2 means they were already there unchanged.

If `make` says the user has no marketplace yet, run `ttheme marketplace init <name>`, with a name the user gave or `characters`. When ttheme cannot read the user's GitHub handle from `gh`, ask for it and pass `--owner <handle>`.

## 8. Report

Tell the user, per palette, in their language:

- its full name and `ttheme use <owner>@<marketplace>/<name>` to use it in a tab (you cannot change their tab from your shell);
- the work and character it is of, and whether you added them to the marketplace's `works/`;
- which picture you measured;
- each anchor: the part, the measured color, the final color and ΔE, and why that part (an official color, chromatic hair, or consensus with its share and post count);
- the base scheme, the colors the role fixer turned and why, and any contrast check it still fails;
- anything you were unsure of.

Then, once: `ttheme edit <full name>` tunes it by hand, `ttheme` opens Preview, whose palette panel finds background pictures (`f`), and `ttheme share` shares it as a link or a GitHub marketplace — run `share` only when the user asks.

## Inside the ttheme repository

The built-in palettes take these steps plus what `.agents/skills/palette/SKILL.md` lists: read it before you start.
