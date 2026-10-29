# Your own palette

`ttheme new` opens the palette editor on a blank palette. You tune twenty
colors while a mock terminal shows them in a shell, an editor and a process
monitor, and the contrast checks measure every color as you go.

```sh
ttheme new dusk                    # from blank
ttheme new rei --from ttheme/rei   # starting from another palette's colors
ttheme edit dusk                   # change it later
```

The editor needs a window of 80×24. From 96×28 it becomes the builder: the
colors on the left, the mock terminal on the right.

## Start from the seeds

A blank palette starts on the seeds: the background and foreground lightness, a
hue and tint for the neutrals and the cursor, and one lightness and chroma the
accents share. Whatever you pick, the twenty colors they grow pass every
contrast check. `enter` moves on to the colors, and the seeds stay behind.

`--from` and `edit` skip the seeds.

## Tune a color

The twenty colors are the background, foreground, cursor and selection, then
the eight ANSI colors with their bright pairs. Each shows as lightness, chroma
and hue (OKLCH).

- `↑` `↓` pick a color, and `enter` or a click opens its picker.
- In the picker, `↑` `↓` move lightness, `←` `→` chroma, and `⇧←` `⇧→` hue.
- `#` takes a color as `#rrggbb`, `rgb(…)` or `oklch(…)`, and so does a paste.
- `enter` keeps the color, `esc` puts it back, and `u` takes back one step.

A bright starts linked to its normal when their hues are close, so tuning the
normal moves the bright too. `l` links and unlinks a pair.

## Check it as you go

- `✗` marks a color that fails a check, and the Contrast box at the bottom lists
  every check that fails. `n` and `N` walk the colors that fail.
- `f` moves the failing colors until they pass.
- `i` inspects the mock terminal: it names the colors a spot is drawn with.
- `g` shows how all sixteen ANSI colors relate in lightness, chroma and hue.
- `?` lists every key of the mode you are in.

The checks only advise: a palette that fails one still saves, and `ttheme check`
prints the numbers. [Contrast checks](../reference/contrast-gate.md) explains
each rule.

## Save

`s` saves. `esc` leaves, asking first when something changed.

Your palettes live in a marketplace of your own on your machine. The first
`new` asks for its name and creates `~/.config/ttheme/marketplace/<name>`. Each
palette there is named `<you>@<marketplace>/<palette>` and kept in a set under
`sets/`: its work's, `<work>.toml`, or `original.toml` for a palette of no work.

A palette made `--from` another keeps the work or character that one is of, so
lists shelve it beside it, and names that palette as its upstream. One made from
blank is an original until its table names a `subject`
([a set](publish.md#a-set)).

## When its upstream changes

A palette copied from another follows it. When the upstream palette changes,
Browse marks yours `⇡` and `ttheme update` names it; `ctrl+r` there takes the
upstream's change into every color you left as it was, and keeps every color
you changed. A color you both changed stays yours, and `ttheme update` names
it: `ttheme edit` then opens on it, `r` takes the upstream's color and `s`
saves what you pick. A copy whose upstream is gone keeps working; it only
stops taking updates.

## A picture for it

`p` in the editor opens find on the colors being edited. Dropping or pasting a
picture on the window tries it on at once. The picture shows behind the editor,
tinted with your colors; `b` hides it.

## With a coding agent

`init` offers the `ttheme-palette` skill to coding agents such as Claude Code.
Ask one for a character's palette and it researches the character, measures
the colors on official art, and lets ttheme harmonize, check and install the
result as a palette of that character — adding the character, or its whole
work, to your marketplace's `works/` when the commons does not hold it yet. It
works through `ttheme palette`, whose `measure`, `consensus` and `make` steps
you can run yourself too, each printing JSON with `--json`.

```sh
npx skills add kecan0406/ttheme   # the same skill, for Claude Code, Codex, Cline and others
```

In Claude Code, `/plugin install ttheme-palette --marketplace kecan0406/ttheme`
adds it as a plugin.

`ttheme help palette` names the skill format each ttheme works with, and a
skill older than that asks you to update it before it starts: run `init` again,
`npx skills add kecan0406/ttheme`, or update the plugin, whichever way you
added it.

## On the web

[ttheme.dev/builder](https://ttheme.dev/builder) is the same builder in the
browser: start from any palette, a share link or blank seeds, and tune both
modes against the contrast checks. Every visit starts clean; a palette you
changed stays in that browser as a draft, up to thirty, which its **drafts** tab
lists and reopens. Export takes the palette open with every draft of the same
work, or every original draft when it is an original, as one set: a `.toml` that
`ttheme add <file>.toml` installs into your own marketplace, a share link, or a
marketplace ready to push.
