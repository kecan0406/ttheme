# Contrast checks

The contrast checks make sure a palette stays readable in a terminal: text
against its background, and the colors programs use to mean something. This page
lists each rule and the reasoning and sources behind it.

## Check a palette

```sh
ttheme check miku         # every check's numbers, and colors that would pass
ttheme check --fix miku   # write those colors in
```

The palette editor measures every color as you tune it, Browse shows a
palette's score in its panel, and the [builder](https://ttheme.dev/builder)
shows the checks under its mock terminal.

## Principles

**Every rule is a recommendation.** The checks tell a palette's author what it
fails; they never refuse a palette. The built-in marketplace holds its own
palettes to every rule, and even there a palette can be let off one with a
written reason.

**Measure what programs draw.** A terminal palette is not read as a swatch on a
background. Programs draw text on colored grounds, dim their secondary text,
brighten bold, and lean on red and green to mean failure and success. A rule
earns its place by matching something programs actually draw by default.

**Standards first, models where standards stop.** Where a contrast ratio
answers the question, the checks use the standard ratio. Where it cannot, such as
whether two colors at text size read as one or what a color-blind reader sees,
it uses a published perception model rather than a guessed number.

**One set of rules for dark and light.** A light palette mirrors a dark one, so
the same rules hold in both modes.

**Say what cannot be fixed.** Some pairs programs draw cannot be readable in any
palette. The checks leave them out and say why.

## The rules

| Rule | Asks | Rests on |
|---|---|---|
| `foreground` | foreground on background ≥ 7:1 | WCAG AAA, enhanced contrast |
| `accents` | every accent on background ≥ 4.5:1 | WCAG AA, contrast minimum |
| `ansi0-dark` | ANSI 0 luminance ≤ 0.15, in a dark palette | ANSI 0 as black |
| `light-ansi` | ANSI 7 and 15 on background ≥ 7:1 | WCAG AAA, body text |
| `ansi8-visible` | ANSI 8 on background ≥ 3:1 | WCAG's floor for normal vision |
| `selection` | foreground on the selection ≥ 7:1 | WCAG AAA, body text |
| `ansi-role` | each accent's hue inside its role's band | the meaning of each ANSI color |
| `bright-follows` | a bright within 25° of its normal | terminals that brighten bold |
| `distinct` | no two accents in a row that read as one color | a size model of color difference |
| `ansi0-on-accents` | ANSI 0 as text on ANSI 1–6 ≥ 4.5:1 | WCAG AA, programs' colored grounds |
| `ansi7-on-ansi8` | ANSI 7 as text on ANSI 8 ≥ 3:1 | fish's selection |
| `cvd-red-green` | red and green apart for a deuteranope | a dichromat simulation |

ANSI colors that a palette names in its signature, the colors that identify its
character, are exempt from `ansi-role`, and a pair of them from the comparisons.

### Body text: 7:1

The foreground, ANSI 7 and 15 and text on the selection are what a terminal is
read in. WCAG's enhanced level (AAA, success criterion 1.4.6) asks 7:1, which
its Understanding document ties to the contrast loss of 20/80 vision.

### Accents: 4.5:1

WCAG asks 3:1 only of large text, 18 point or 14 point bold, and terminal text is
not large. For normal text WCAG asks 4.5:1 (AA, success criterion 1.4.3), derived
from the contrast loss of 20/40 vision. Accents carry real text: errors,
warnings, paths, diffs.

### Secondary text: 3:1

ANSI 8 is the ecosystem's secondary text: zsh-autosuggestions and fish draw
their suggestions in it, and Python, Node and GitHub CLI draw grey output in it
(SGR 90). It is meant to be quieter than the text around it, so it takes WCAG's
3:1, which the Understanding document gives as the minimum for standard text and
normal vision, and goes no lower, since WCAG 2 is known to be lenient on dark
grounds.

### Black on accents: 4.5:1

The most common colored ground in a terminal carries black text: tmux's status
line (before 3.8), htop's function-key bar and column header, `ls`'s colored
directories, yazi. So the checks measure ANSI 0 as text on each of ANSI 1–6 at
the same AA level as any other text. In a dark palette ANSI 0 also stays dark
(luminance 0.15 at most), as black should; in a light palette this rule is what
makes ANSI 0 light.

### White on bright black: 3:1

fish's default theme draws its selection and search matches as bold white on
bright black (ANSI 7 on 8). Darkening ANSI 8 would quiet the autosuggestions
people read all day, so the rule is met by keeping ANSI 7 light, at the same 3:1
as secondary text.

### Roles and brights

Each ANSI color has a meaning programs rely on, such as red for errors, green for
success and yellow for warnings, so each accent's hue stays inside its role's
band. A color-naming model was not used for the bands: at the lightness that
reads on a dark ground, such a model calls most reds pink, while a terminal's
red only has to read as red beside the rest of its palette.

Several terminals draw bold text in the bright color (WezTerm, iTerm2, Windows
Terminal and xterm do by default; Ghostty, Alacritty, foot and GNOME Terminal do
not), so the same bold prompt shows a normal color in one terminal and a bright
in another. A bright therefore has to read as the same color as its normal.

### Colors that read as one

Whether two colors can be told apart depends on how large they are, and a glyph
is small. The checks use Stone, Szafir and Setlur's model of noticeable color
difference as a function of size: along each CIELAB axis the noticeable
difference is `p · (A + B / s)`, with `A = (10.16, 10.68, 10.70)` and
`B = (1.50, 3.08, 5.74)` for L\*, a\* and b\*, *s* the size in degrees and *p* the
share of observers who notice. The checks take `s = 1/3°`, the smallest size the
model was fitted to, and `p = 0.5`: two accents in a row read as one color when
they differ by less than 7.33 in L\*, 9.96 in a\* and 13.96 in b\* all at once. A
terminal glyph is smaller still, so if anything the rule is lenient.

### Red and green for a color-blind reader

About 8% of men and 0.4% of women of European descent, and 4–6.5% of Chinese and
Japanese men, have a red-green color vision deficiency (Birch, 2012). `git diff`,
test runners and `ls` lean on exactly those two colors. The checks simulate a
deuteranope, the most common form, with the dichromat projection of Viénot,
Brettel and Mollon, and holds the simulated red and green, normal and bright, to
the size model above. Separating them takes a difference in lightness, since
that is what a deuteranope still sees.

## The contrast formula

The checks use WCAG 2's relative luminance and contrast ratio, with the sRGB
linearization constant WCAG 2.2 gives (0.04045).

APCA was considered and is not used. Its license allows it for WCAG guidelines
on web-delivered and web-based content only, puts every other use under the AGPL
v3, forbids changing its constants, and notes a pending patent; ttheme is MIT and
draws terminals. WCAG 3, the standard APCA is proposed for, has not chosen a
contrast algorithm in its current working draft.

WCAG 2 is the measure terminals themselves reach for: VS Code's integrated
terminal raises text to a minimum contrast ratio of 4.5 by default, and Ghostty
and kitty take a WCAG ratio for the same adjustment.

## Light palettes

A palette is light when its background is lighter than its foreground. It
mirrors the dark layout: ANSI 0 is light, ANSI 7 and 15 are dark, and ANSI 8
stays a middle grey. Keeping the color names literal, ANSI 0 dark and ANSI 7
light, works only while accents stay at middle tones; once they are dark enough
to read at 4.5:1 on a light ground, black text on them is lost, and that is the
pair programs draw all the time. The mirror keeps every rule above unchanged in
both modes. ANSI 8 must not move toward the background in either: suggestions
drawn in it would disappear.

## What the checks do not ask for

- **White text on an accent, and the foreground on blue.** `ls` draws setuid and
  sticky directories as white on red and blue, yazi and fish draw counts and
  progress in white on accents, Vim draws errors as white on bright red, and
  lazygit draws its selected line on blue in a dark palette. An accent light
  enough to read as text on a dark ground is too light to carry white text;
  xterm's own color resources call color4 and color12 "a tradeoff between
  contrast, depending on whether they are used for text or backgrounds".
  Programs are moving away from it: tmux 3.8 brings its own theme for terminals
  of 256 colors or more, and lazygit 0.66 blends its selection on a light
  background.
- **zsh-syntax-highlighting's comments** (`fg=black,bold`). In a terminal that
  does not brighten bold, a comment is ANSI 0 on the background, which no palette
  can make readable without giving up what ANSI 0 is for. It is the plugin's
  setting to change.

## Letting a palette off a rule

A marketplace palette can waive a rule, with a reason that ships beside it:

```toml title="sets/evangelion.toml"
[[palette]]
slug = "rei"
...

[palette.contrast]
waive = ["bright-follows"]
reason = "why this palette is the exception"
```

## Limits

- WCAG 2 is lenient on dark backgrounds; the floors here are floors, not
  targets.
- The size model is applied below the sizes it was fitted to, and the
  color-blindness rule simulates dichromats only.

## Sources

Standards

- W3C, Web Content Accessibility Guidelines (WCAG) 2.2, Recommendation,
  2024-12-12: relative luminance, contrast ratio, large text, success criteria
  1.4.3 and 1.4.6.
- W3C, Understanding Success Criterion 1.4.3: Contrast (Minimum), the rationale
  for 3:1, 4.5:1 and 7:1.
- W3C, Web Content Accessibility Guidelines (WCAG) 3.0, Working Draft,
  2026-09-10.

Models and studies

- M. Stone, D. A. Szafir, V. Setlur, "An Engineering Model for Color Difference
  as a Function of Size", Color and Imaging Conference, 2014.
- F. Viénot, H. Brettel, J. D. Mollon, "Digital video colourmaps for checking
  the legibility of displays by dichromats", Color Research & Application 24(4),
  1999.
- J. Heer, M. Stone, "Color Naming Models for Color Selection, Image Editing and
  Palette Design", CHI 2012.
- J. Birch, "Worldwide prevalence of red-green color deficiency", JOSA A 29(3),
  2012.
- The apca-w3 package's license.

Program and terminal defaults: GNU coreutils (dircolors), macOS `ls`, git, tmux,
htop, zsh-autosuggestions, zsh-syntax-highlighting, fish, starship, lazygit,
yazi, Vim, Python, Node, GitHub CLI, xterm, Ghostty, kitty, Alacritty, WezTerm,
iTerm2, GNOME Terminal, Windows Terminal and VS Code.
