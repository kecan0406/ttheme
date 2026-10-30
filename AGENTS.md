# AGENTS.md

Rules every coding agent needs in this repository: the gate, the hard rules, the traps and where the rest lives. This file stays under 150 lines and 10 KB, and `mise run test` fails above that.

- An area's rules go in the `AGENTS.md` beside its code, not here.
- Measurements, dates and history go in a commit's body, not here.
- Add a line only after the same mistake happened twice.

## Setup and the gate

Every dev command is a `mise` task (`mise tasks`); `package.json` has no scripts and takes none. The toolchain is bun 1.3 and node 22, the oldest `engines` allows. The checks need zsh, tmux and sqlite3 on `PATH`.

Run `mise run format`, then `mise run ci`, once, right before a change leaves your hands: a pull request, a merge, a push to `main` or `mise run release`. `ci` is exactly what CI runs and takes a minute or two, and `format` first fixes most of what lint would fail on. A push to `main` is itself a deploy (the site on Vercel, Pages).

While a change goes back and forth with the person you work for, run no check unless a round asks to see something, and say the round is unchecked. The `PostToolUse` hooks in `.claude/settings.json` fix a file an edit tool touched (oxlint, biome) and measure the instruction files against their budgets; an edit made through Bash never reaches them.

| Task | Use it when |
|---|---|
| `mise run ci` | the gate |
| `mise run test` · `check` · `lint` | unit tests with the contrast gate · typecheck · biome, then anti-slop |
| `mise run build` | regenerate `dist/`; fails on a contrast violation or a subject the commons lacks |
| `mise run look <scenario> <cols>x<rows>` | see a TUI screen without a window; compare a change with `--against HEAD`, never by putting a file back from git |
| `mise run sandbox` | try ttheme in a throwaway home; opens windows, so drive it through the `sandbox` skill (`.agents/skills/sandbox/SKILL.md`), never bare |
| `mise run parity` · `walk` · `costs` · `forks` | the terminal model, its random walk, the cost and fork ratchets (`tests/AGENTS.md`) |
| `mise run compat` | each installed terminal's real behavior; opens windows, not part of `ci` |
| `mise run shell:check` · `bin:check` | the zsh layer · the bundle under node 22 |

## Rules

- First-party code carries no comments.
- No backwards-compat shims, deprecated aliases or legacy fallbacks.
- Every screen, message and docs page follows `.claude/rules/text.md`.
- Source is layered by folder, each layer importing only those before it: `src/core` (pure, no I/O), `src/store`, `src/pictures`, `src/terminals`, `src/tui`, `src/cli`, then `src/bin.ts`; `src/root.ts` and `src/embed.ts` sit outside. `.oxlintrc.json` enforces it. A module that mixes layers is split, its pure part going down.
- A module that reads a file or a response into ttheme's types takes and returns `unknown` and goes on the decoder list in `.oxlintrc.json`.
- An optional key is written `...(x ? { k: x } : {})`; the lint rule against it is off.
- A map keyed by outside text (a palette's name, a booru tag or artist, a file's name) is read through `Object.hasOwn` or built with no prototype: `constructor` and `__proto__` are names such keys may carry.
- Text someone else wrote (a marketplace's files, the index, a booru's answer) is made inert (`src/core/text.ts`) before a screen or a message shows it.
- ttheme writes colors only: no font, size, codepoint map or shader in any terminal, and a palette's 16 ANSI colors, never the 256-color extension.
- A user's config is edited only through `editUserFile` (`src/store/edits.ts`).
- Every setting has one owner. `installed.json` owns the install state and `sync` derives the terminals' config blocks from it, so the zsh layer never edits them. `images.json` owns the pictures and only the CLI writes it. `config.zsh` owns the runtime settings.
- Every palette has a full name, `<publisher>/<slug>`; the bare slug is never stored.
- A format that released copies of ttheme read only gains fields; a breaking change goes under another file or prefix name (marketplace files, share codes `tt7:`, the marketplace index, `--json` output).
- A change to the keys of a palette, marketplace or work file updates `schemas/`; `schemas.test.ts` holds them to the code.
- A change to a verb, a setting or a terminal's support updates its page in `docs/` in the same commit.
- Shell code works with both GNU and BSD tools; CI runs GNU's.
- Never add a `CLAUDE.md` or a `CLAUDE.local.md`: Claude Code reads `AGENTS.md` by itself only while neither is beside it or above it, nested files included.
- A `.claude/rules` file stays under 200 lines and 25 KB; `mise run test` fails above that.

## Traps

- `mise.toml` scripts are tera templates: wrap one with `${#VAR}` in `{% raw %}` and `{% endraw %}`. A task that hands the terminal to a TUI or a shell needs `interactive = true`.
- `init` copies the CLI bundle next to the shell layer and the layer runs only that copy, so installing from a checkout needs `mise run bin:build` first. `bin/` and `dist/` are generated, never committed.
- The package ships `dist/builtin.json` and `dist/commons.json`, the only dist files the CLI reads; a new runtime read of `dist/` fails `bin:check`. `init` must stay runnable under plain node.
- The bundle runs on node 22 and up. A regex with modifiers or a repeated group name stops the whole bundle loading there, and `Promise.try`, `RegExp.escape`, `Error.isError`, `Iterator.concat`, `Map#getOrInsert`, `Uint8Array.fromBase64` and `Math.sumPrecise` are missing, while tsc and `bun test` accept them; only `bin:check` catches one.
- Iterator helpers are slower than array methods on V8 and JSC: use them for laziness or to feed `new Set`, `new Map` or `Object.fromEntries`, never in a `src/core` module the site's browser code reaches. Biome breaks a chain of three or more calls one call to a line.
- `ROOT` (`src/root.ts`) reaches the package root through `import.meta.dirname` and so sits directly under `src/`; every other file under `src/` joins from `ROOT`.
- The shell layer's hot paths start no process (`mise run forks` holds it). Compare modification times in nanoseconds (`zstat -F %s.%N`): whole seconds miss two writes in one second. Under the harness `err_return` is set, so count with `(( ++x ))`: `(( x++ ))` from 0 returns from the function.
- Preview's key loop (`__tt_pv_getch`) leaves when five reads in a row come back at once, which only a hung-up tty does; `[[ -t 0 ]]` and `stty size` still succeed on a dead one.

## Where the rest lives

| Before you change | Read |
|---|---|
| `src/core/`, `src/store/`, `src/pictures/` | the `AGENTS.md` in that folder |
| `src/cli/`: verbs, init, update, marketplaces | `src/cli/AGENTS.md` |
| `src/terminals/`, `shell/`: wiring, emitters, the shell layer | `src/terminals/AGENTS.md`, then `.claude/rules/terminals.md` |
| `src/tui/`, `shell/preview.zsh`: screens, keys, mouse | `src/tui/AGENTS.md`, the `tui` skill (`.agents/skills/tui/SKILL.md`), `HACKING.md` ("Working on the TUIs"), `.claude/rules/tui.md` |
| find, the picture search | `.claude/rules/find.md` |
| `tests/`, the parity, compat and cost harnesses | `tests/AGENTS.md`, `HACKING.md` |
| `site/`, `docs/` | `site/AGENTS.md`, `.claude/rules/site.md` |
| `builtin/`, `commons/`: palettes, works, characters | the `AGENTS.md` in that folder, `CONTRIBUTING.md` ("Works and characters"), the `palette` skill (`.agents/skills/palette/SKILL.md`) |
| the wording of a screen, a message or a docs page | `.claude/rules/text.md` |

## Commits

- A subject is `<area>: <summary>` in 72 characters at most, the summary lowercase, imperative and without a full stop. The area is where most of the change is: `core`, `store`, `pictures`, `terminals`, `tui` or `cli` under `src/`; `shell`, `site`, `docs`, `builtin`, `commons`, `schemas`, `skills` or `tests` for that folder; `ci` for `.github` and `mise.toml`; `agents` for `AGENTS.md`, `.agents` and `.claude`; `docs` also for the other Markdown at the root. `mise run ci` checks every commit `origin/main` lacks.
- The body says how things were, how they are now and why.
- A change a user would notice adds a line for that user under `## Unreleased` in `CHANGELOG.md`, in the same commit. `mise run release` refuses an empty section and turns its heading into the version in its own `release: <version>` commit; the GitHub release posts that section.

`CONTRIBUTING.md` has the rest: issues, palettes, what the project accepts.

## Maintainers only

- Release only with `mise run release <x.y.z | patch | minor | major>`; never tag, publish or edit a release by hand. A built-in palette or a commons change reaches users only as a release, so each is a patch release.
- Actions are pinned to full SHAs, which the repository requires; Dependabot moves the pins.
