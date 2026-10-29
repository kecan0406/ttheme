# site

The showcase site (Elysia 2 on Bun, deployed to Vercel). `.claude/rules/site.md` is its reference.

- The site renders from `src/core`, `src/store` and `src/pictures` alone, and builds from `dist/builtin.json` and `dist/commons.json`.
- `site:dev` and `site:build` share `site/public` and `site/assets.json`: stop the dev server before a build. `site:check` typechecks the server and browser code and runs `xss-scan` over both, without building and without the network.
- Browser code is typed against the browsers the site supports (`client/tsconfig.json`), so it uses no iterator helpers: Safari before 18.4 lacks them.
- The marketplaces and the repository's star count are read from GitHub once, at build. A push to `main` deploys.

## The docs

- The user docs are Markdown in `docs/<group>/<page>.md`: one `#` title, then the one paragraph that is the page's lede and its description. The site renders them at `/docs/<group>/<page>`; `lib/docs.ts` holds the nav table and `lib/markdown.tsx` the syntax.
- A `sh` fence is a command block, and its copy button leaves out the `# comments`. `title="…"` on a fence makes it a file. A `screen` fence is a terminal window holding `mise run look` text. Two or more fences in a row that each carry `tab="…"` are one set of tabs. An ordered list whose items all open in bold is a list of steps. `> [!NOTE]`, `> [!TIP]` and `> [!WARNING]` are callouts. A code span that names a key is drawn as a key. A relative link to another page's `.md` becomes that page's path, and any other raw HTML comes out escaped.
- The docs are written for the person using ttheme: what to run, what it does, what a terminal cannot do, never how it is built or measured.
- The site build fails on a broken link or anchor, a docs file the nav table leaves out, an anchor `ttheme help` names that Commands lacks, and a `GATE_RULES` rule that `docs/guide/make.md` leaves out. The Commands and Settings pages append what `VERB_SPECS` (through `site/commands.json`) and `CONFIG_SETTINGS` hold, and the `doc` lines of the latter read the same as `config.zsh`'s comments.
