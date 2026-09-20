# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All dev commands are mise tasks. package.json deliberately has **no scripts** — do not add any; the toolchain (bun 1.3) and tasks live in mise.toml.

- `mise run ci` — lint + typecheck + tests + build + shell check + node-bundle check (exactly what CI runs)
- `mise run build` (or `--only <terminal>`) — regenerate dist/; fails on contrast violations
- `mise run test` / `mise run check` / `mise run lint` / `mise run format`
- `mise run shell:check` — zsh syntax + runtime check of shell/ (depends on build)
- `mise run bin:check` — bundle bin/ttheme.js and smoke-test it under node (help, `init --yes`, idempotency)
- `mise run sandbox [--here | --behind] [--zshenv FILE] [--empty | palette…]` — try ttheme by hand as a user of this checkout: a throwaway home at `$TMPDIR/ttheme-sandbox`, wiped on every run and kept after exit for inspection, with every catalog palette installed — or only the ones named, or none with `--empty` (the new-user state `init` leaves, for testing `browse`). It opens a separate Ghostty instance on it, the only way to test `keep`, new tabs and config reloads; `--here` drops into a zsh in this tab instead (`HOME` moved; `TTHEME_*`, `XDG_CONFIG_HOME`, `XDG_STATE_HOME` and `ZDOTDIR` scrubbed). `--behind` and `--zshenv` exist for Claude: `--behind` hands focus back once the window exists, `--zshenv` seeds a hook every sandbox shell sources first. Claude drives it through the `sandbox` skill (`.claude/skills/sandbox/`), never bare — a bare run puts a window in front of the user
- `mise run site:dev` / `mise run site:build` — the showcase site; not part of ci, and `next build` is where site/ gets typechecked (root `tsc` only covers `src/`)
- `mise run publish` — the only way to publish to npm: runs ci, rebuilds the bundle, then `bun publish`
- `bun install` for dependencies

## Conventions

- First-party code carries **no comments** — a deliberate choice; do not add any. `ghostty/shaders/*.glsl` is third-party (MIT) and keeps its headers.
- No backwards-compat shims, deprecated aliases, or legacy fallbacks.
- `themes/*.toml` is the single source of truth; `dist/` is generated, never committed. `[font]` and `[ghostty]` sections inherit from `themes/_defaults.toml`.
- Series metadata lives once, in `themes/_groups.toml`: every `meta.group` needs a `[[group]]` table there, which owns the `native` title and names the `lead` palette whose signature colors the group. A theme file never repeats them.
- `meta.booru` is the character's booru tag and the only thing ttheme knows about finding its art: `preview`'s tab opens `find` (`src/find.ts`, a hidden CLI verb), which searches that tag live on the sites in `SITES` (`src/booru.ts` — safebooru, yande.re, konachan and danbooru through the `safebooru.donmai.us` mirror), each read at the ratings `TTHEME_FIND_RATING` lists — `safe` by default, where the Moebooru ones carry `rating:s` — with the tag groups `TTHEME_FIND_BLOCK` names (nudity, underwear; both by default) dropped, and installs through `src/backdrop.ts` — the same code the character-background skill scripts import. Never add post ids, image URLs or curated picks to the repo; palettes that are not one character carry no tag.
- `meta.signature` names three palette slots (`cursor`, `foreground`, `background`, `selection`, `ansi0`-`ansi15`) — the colors that identify the character on a card. They must resolve to three different colors.
- `dist/manifest.json` is the data contract for everything outside the build: `init` and `site/` read it instead of re-parsing `themes/` (site tasks depend on `build`). Every dist artifact goes through an `Emitter` in `src/emit/` — terminals emit per theme, `shell`/`meta` emit shared files.
- Every setting has one owner. `~/.config/ttheme/installed.json` owns the install state (terminals, palettes, the startup palette) and `sync` derives the terminal config blocks from it — the zsh layer never edits those blocks itself; preview's keep goes through `ttheme default`, otherwise the next add/remove/update/browse would rewrite it. `config.zsh` owns the runtime settings (`TTHEME_TAB_PALETTE` and friends): the Ghostty block always routes new tabs through `launch-tab.zsh`, which reads the setting when the tab opens.
- Every palette must pass the contrast gate (src/contrast.ts). Opting out needs `[contrast] waive = [...]` **plus** a `reason` — a waiver without a reason fails the test suite.
- `site/` consumes `@base-ui/react` only through `site/components/ui/*`, managed by the shadcn CLI (`site/components.json`, style `base-nova`): add parts with `bunx shadcn@latest add <name>` from `site/`, then adapt them in place — feature components never import `@base-ui/react` directly (biome enforces it). Color tokens use shadcn's vocabulary in a dark-only `:root`. The landing root wears the current palette: its inline style sets the raw slots (`--bg`, `--fg`, `--cu`, `--se`, `--a0`–`--a15`) and the `.wear` class in `globals.css` remaps the shadcn tokens onto them, so every part on the page — ui primitives included — wears that palette.

## Gotchas

- mise.toml task scripts are rendered as tera templates: zsh's `${#VAR}` reads as a tera comment opener. Wrap such scripts in `{% raw %}` / `{% endraw %}`.
- A mise task that hands the terminal to a TUI or a shell needs `interactive = true`; without it a task with `depends` gets no TTY on stdin and its output is line-prefixed.
- `init` copies the CLI bundle next to the shell layer (`~/.config/ttheme/ttheme.js`) and the layer only ever runs that copy, so both always come from one package version, offline. Installing from a checkout therefore needs `mise run bin:build` first — `init` refuses without `bin/ttheme.js`.
- Ghostty on macOS starts shells through `login -flp`, which resets `HOME` but keeps the rest of the environment — steer a Ghostty-launched shell with `ZDOTDIR`/`XDG_*`, never `HOME`. `open` hands the caller's environment to the app, so exporting before `open` is enough; `--env` only adds to it. It also reads `~/Library/Application Support/com.mitchellh.ghostty/config`, so a second instance needs `--config-default-files=false`. It creates its first window only once the app is active, so `open -g` leaves a windowless instance.
- BSD `pgrep`/`pkill` skip their own ancestors, so from inside a Ghostty tab `pkill ghostty` misses that Ghostty. `__tt_reload` therefore walks up to the Ghostty that owns the shell and signals only it, falling back to `pkill` when the shell sits outside one (tmux).
- `shell/ttheme.zsh` only runs from an installed layer, with `palettes.zsh` beside it — there is no source-from-checkout path. `shell/check.zsh` assembles such a layer in a temp dir.
- Any source file using `import.meta.dirname` to reach the repo root must sit directly under `src/` — the npm bundle lives at `bin/ttheme.js`, so `join(import.meta.dirname, '..')` only resolves to the package root when the depth matches.
- `build` needs bun (`Bun.write`, `Bun.TOML.parse`); `init` must stay runnable under plain node — the published package ships a prebuilt `dist/`, and bin:check enforces this.
- `bin/` is generated by `mise run bin:build`, never committed.
- `tests/tui.zsh` unsets the terminal-identity variables (`GHOSTTY_RESOURCES_DIR`, `KITTY_WINDOW_ID`, …) before each capture: its tmux server inherits the environment of whatever terminal runs it, so without that the ghostty adapter loads locally but not on CI and the screens diverge.
- `bunx shadcn@latest add` can emit `import { cn } from "cn"` and add the unrelated `cn` npm package to site/package.json — point the import at `@/lib/utils` and `bun remove cn`.
- The shadcn parts carry `dark:` variants and `<html>` always has `.dark`, so a plain `hover:`/`data-*:` override loses to them on specificity — adapt the part in place or use a plain element.
