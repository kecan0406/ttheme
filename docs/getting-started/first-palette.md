# Your first palette

Run `ttheme` on its own. It opens Preview, where the tab shows every palette
you installed as the cursor lands on it, so you choose by looking.

```sh
ttheme
```

```screen title="ttheme"
 >ω   Preview   Browse   ⇧tab Browse       konata  Lucky☆Star
 ⌕ Search… e.g. kita | Lucky☆St…  2/2      Shell  Code  Diff  Logs  Monitor

   ▸ Bocchi the Rock!  ぼっち・ざ…  1      ▀▀▀ ▀▀▀ ▀▀▀ ▀▀▀ ▀▀▀ ▀▀▀ ▀▀▀ ▀▀▀
   ▾ Lucky☆Star  らき☆すた          1
▌    ■ konata             ■ ■ ■ ■ ■ ■      ~/code/demo on main +2 ~1
                                           ❯ git status -sb
                                            M src/main.rs
                                           ?? notes.md

                                           ❯ cargo test
                                            ✓ parses config
                                            ✗ renders frame

                                           ❯ echo selected text
  PREVIEW   enter use   tab edit   ⇧←→ sample   ? keys               esc cancel
```

## Try palettes on

Preview lists your palettes under their works — a series, a game, a
franchise — each work by its name with its title in its original language
beside it. Palettes of no work, the originals, follow under a line of their
own, by marketplace.

- `↑` `↓` move, and the tab shows each palette the moment the cursor lands on it.
- `→` or `enter` opens a work, `←` closes it.
- Typing filters the list. It matches palette names, works and characters, and
  a character's names in its original language too, so `hitori` and `ひとり`
  both find `bocchi`.
- From 76 columns on, a sample beside the list shows the palette in a shell
  session, code, a diff, logs and a process monitor. `⇧←` `⇧→` switch the scene.
- A palette with a picture shows it behind the list in the terminals that draw
  pictures.
- `?` lists every key, and the mouse works too: a click moves the cursor and a
  double click does what `enter` does.

## Keep one

`enter` on a palette asks where it goes:

- **Default** makes it the palette new tabs open with, in every terminal you
  wired. Open tabs where you have not used a palette by hand follow it.
- **This tab** uses it in this tab alone. Other tabs keep what they show.

While new tabs rotate through your palettes
([new tabs](../usage/tabs.md#a-new-palette-for-every-tab)), `enter` uses it in this
tab at once. `esc` leaves Preview and puts the tab back the way it was.

When you already know the name, skip Preview:

```sh
ttheme use miku          # this tab
ttheme use ttheme/miku   # the full name, when two marketplaces have a miku
ttheme default miku      # the default for new tabs
```

Every palette has a full name — `ttheme/miku` for a built-in one — and the
name alone is enough while only one of yours has it
([names](../usage/palettes.md#names)).

## Get more palettes

`shift+tab` in `ttheme` moves to Browse, which lists every palette of every
marketplace you added. `space` marks palettes to install, or unmarks one to
remove it, and `enter` reviews and applies the change.
[Add and update palettes](../usage/palettes.md) covers Browse and marketplaces.

## What next

- Give a project its own palette: [pin to a folder or ssh host](../usage/pins.md).
- Switch between light and dark: [light, dark and auto](../usage/modes.md).
- Put the character behind your text: [pictures](../usage/pictures.md).
- Make a palette of your own: [your own palette](../creating-palettes/your-own.md).
