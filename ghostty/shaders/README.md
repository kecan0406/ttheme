# Shaders

Ghostty is the only Tier-1 terminal that runs GLSL, so nothing here applies to
kitty, Alacritty, WezTerm or iTerm2. A theme picks one with `[ghostty] shader`
in its TOML; the built config wires it up as `custom-shader`.

Shaders apply to the whole Ghostty instance, not per tab — so switching a tab's
palette does not switch its shader.

## Included

Both come from [sahaj-b/ghostty-cursor-shaders][sahaj] (MIT — see `LICENSE`).

| File | Effect | Local change |
|---|---|---|
| `cursor_tail.glsl` | comet trail behind the cursor | `DURATION` 0.09 → 0.05 (shorter tail) |
| `ripple_cursor.glsl` | expanding ring on cursor move | none |

Trail length lives in `DURATION` and `MAX_TRAIL_LENGTH` inside the file.

## Not included

These are in use locally but ship no license, so they are not redistributed
here. Drop them into this directory yourself if you want them:

- `bloom.glsl`, `bloom-subtle.glsl` — [qwerasd205's gist][bloom]
- `gradient-background.glsl`, `animated-gradient-shader.glsl` — [unkn0wncode][unk]

[sahaj]: https://github.com/sahaj-b/ghostty-cursor-shaders
[bloom]: https://gist.github.com/qwerasd205/c3da6c610c8ffe17d6d2d3cc7068f17f
[unk]: https://github.com/unkn0wncode
