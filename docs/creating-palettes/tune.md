# Tune a palette

You can change any palette's colors, an official one included, without making a
copy. Your changes are kept as a tone: an override of just the slots you moved,
laid over the colors its marketplace gives.

## Open the editor

```sh
ttheme edit miku   # a palette that is not yours: your changes become its tone
ttheme edit        # asks to edit the palette this tab wears
```

In `ttheme`, the same editor opens from a palette's panel: put the cursor on the
palette, press `tab`, then `enter` on **Edit palette**.

The editor works as it does for [your own palette](your-own.md): pick a slot,
tune it, and `s` saves. A tone has no seeds or signature marks, and it never
changes the palette file itself.

## What a tone does

- Every terminal you wired, the shell and the pictures' tint follow the tone at
  once, in every open tab that wears the palette.
- `ttheme update` leaves it in place. A new version of the palette shows through
  every slot you did not tune.
- A tone belongs to one [mode](../usage/modes.md), so light and dark can be
  tuned apart.
- Preview and Browse mark a tuned palette with a yellow `●`.

Tones live in `~/.config/ttheme/tone.json`.

## Fix the gate in one step

```sh
ttheme check miku         # the gate's numbers for a palette
ttheme check --fix miku   # colors that pass, saved as its tone
```

On a palette of your own, `--fix` writes the colors into its file instead.

## Go back

In the editor, `R` puts every slot back to the marketplace's colors, and `s`
after it drops the tone. In the panel, **Reset palette** beside Edit palette
does the same: `enter`, then `enter` again to confirm.

## Share a tuned palette

`ttheme share miku` asks whether to share your tone or the original. A tuned
palette goes out as `miku-tuned`, since `miku` belongs to the original wherever
it is installed. [Share a link](share.md) covers the rest.
