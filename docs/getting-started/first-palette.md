# Your first palette

Run `ttheme` on its own. It opens Preview, where every palette you installed
repaints the tab as the cursor lands on it, so you choose by looking.

```sh
ttheme
```

## Try palettes on

Preview lists your palettes under their catalogs, one catalog per series.

- `↑` `↓` move, and the tab wears each palette the moment the cursor lands on it.
- `→` or `enter` opens a catalog, `←` closes it.
- Typing filters the list. It matches palette and catalog names, and a
  character's names in Japanese too, so `hitori` and `ひとり` both find
  `bocchi`.
- From 76 columns on, a sample beside the list shows the palette in a shell
  session, code, a diff, logs and a process monitor. `⇧←` `⇧→` switch the scene.
- A palette with a picture shows it behind the list in the terminals that draw
  pictures.
- `?` lists every key, and the mouse works too: a click moves the cursor and a
  double click does what `enter` does.

## Keep one

`enter` on a palette asks where it goes:

- **Default** makes it the palette new tabs open with, in every terminal you
  wired. Open tabs you have not painted by hand follow it.
- **This tab** paints this tab alone. Other tabs keep what they wear.

While new tabs rotate through your palettes
([new tabs](../usage/tabs.md#a-new-palette-for-every-tab)), `enter` paints this
tab at once. `esc` leaves Preview and puts the tab back the way it was.

When you already know the name, skip Preview:

```sh
ttheme use miku      # this tab
ttheme use ho        # a unique prefix is enough
ttheme default miku  # the default for new tabs
```

## Get more palettes

`tab` in `ttheme` moves to Browse, which lists every palette of every
marketplace you added. `space` marks palettes to install, or unmarks one to
remove it, and `enter` reviews and applies the change.
[Add and update palettes](../usage/palettes.md) covers Browse and marketplaces.

## What next

- Give a project its own palette: [pin to a folder or ssh host](../usage/pins.md).
- Switch between light and dark: [light, dark and auto](../usage/modes.md).
- Put the character behind your text: [pictures](../usage/pictures.md).
- Make a palette of your own: [your own palette](../creating-palettes/your-own.md).
