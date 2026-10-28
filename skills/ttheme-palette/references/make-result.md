# What `make` gives back

Each palette in the result carries:

- `subject`: the work and character it is of.
- `colors`: all twenty.
- `nativeNames`: the names ttheme filled in — set `native_names` in the anchors yourself when they hold a series title or a nickname.
- `signature`: each signature color's part, `measured` and `final` color and `delta`, the ΔE2000 between them, with `far` set when a cursor or selection moved more than 10 and `turned` when a hue moved more than 12°.
- `turned`: the ANSI colors the role fixer moved, and why.
- `lookalikes`: signature colors that read as one at text size.
- `gate`: contrast checks it still fails, normally none.

`shift` is a color's hue move in degrees, `changed` says the file would differ from what is there, `written` that it was written, and `notes` carries what ttheme noticed on the way (a base scheme list it could not fetch, a tag danbooru renamed, a character the commons holds under another work than `--work`).

`works` lists what `make` adds to the marketplace's `works/`: each `work`, the `characters` it records there and the `file`, with `changed` and `written` as for a palette.
