# site

The showcase site (Elysia 2 on Bun, deployed to Vercel). `.claude/rules/site.md` holds its rules.

- The site renders from `src/core`, `src/store` and `src/pictures` alone, and builds from `dist/builtin.json` and `dist/commons.json`.
- `site:dev` and `site:build` share `site/public` and `site/assets.json`: stop the dev server before a build. `site:check` typechecks the server and browser code and runs `xss-scan` over both, without building and without the network.
- Browser code is typed against the browsers the site supports (`client/tsconfig.json`), so it uses no iterator helpers: Safari before 18.4 lacks them.
- The marketplaces and the repository's star count are read from GitHub once, at build. A push to `main` deploys.

## The docs

- The user docs are Markdown in `docs/<group>/<page>.md`: one `#` title, then the one paragraph that is the page's lede and its description. The site renders them at `/docs/<group>/<page>`; `lib/docs.ts` holds the nav table and `lib/markdown.tsx` the syntax.
- A `sh` fence is a command block, and its copy button leaves out the `# comments`; one command with no comment is a `CommandRow`, and a pair of `tab="npx"` and `tab="bunx"` fences of one command each is one row with runner tabs. `lib/highlight.ts` colors `sh` and `toml` text (docs and the builder's TOML panel) through the palette's ANSI slots, `[data-t]` in `globals.css`; a new language is a tokenizer there, never a library. `title="…"` on a fence makes it a file. A `screen` fence is a terminal window holding `mise run look` text. Two or more fences in a row that each carry `tab="…"` are one set of tabs. An ordered list whose items all open in bold is a list of steps. `> [!NOTE]`, `> [!TIP]` and `> [!WARNING]` are callouts. A code span that names a key is drawn as a key. A relative link to another page's `.md` becomes that page's path, and any other raw HTML comes out escaped.
- The docs are written for the person using ttheme: what to run, what it does, what a terminal cannot do, never how it is built or measured.
- The site build fails on a broken link or anchor, a docs file the nav table leaves out, an anchor `ttheme help` names that Commands lacks, and a `GATE_RULES` rule that `docs/guide/make.md` leaves out. The Commands and Settings pages append what `VERB_SPECS` (through `site/commands.json`) and `CONFIG_SETTINGS` hold, and the `doc` lines of the latter read the same as `config.zsh`'s comments.

## Deployment

- Vercel follows `vercel.json` (`framework: null`, Bun `1.x`, the project's Root Directory `site`): the theme build, then `build.ts`, which writes the assets to `public/assets` and then the Build Output API directory `.vercel/output` that Vercel deploys as it stands (`output()`): `static/assets` content-hashed and `immutable` through a route header, every response carrying `SECURITY_HEADERS` (no CSP, whose policy the document's inline scripts would need nonces or hashes for), the prerendered pages as `static/<path>.html` served at `<path>` through `config.json`'s `overrides`, and one Bun function `functions/render.func`, the server bundled whole with no `node_modules`, which every path the filesystem misses is routed to. It is not named `index.func`, which took `/` from `index.html`. Vercel's Elysia preset is not used.
- Only `main` deploys: `vercel.json`'s `git.deploymentEnabled` builds no preview for another branch or a pull request.
- The function's `.vc-config.json` (`output()`) copies what Vercel's own Elysia preset writes for a Bun function (`runtime: bun1.x`, `launcherType: Nodejs`; `architecture` left out). Before changing a field, compare it with what the preset writes now: `vercel build` on a copy without `framework: null` whose entry, named by `outputDirectory`, imports `elysia`.
- `dev.ts` serves `/assets/*` itself with `no-store`, but for the fonts, which `Shelf` names by their content in dev too and `dev.ts` answers `immutable` as the CDN does. GitHub Pages keeps the README's pictures, the marketplace index and `stars.json` (`mise run pages`), and `pages.yml` deploys them, on a push or on its schedule, only when one of the files differs from the published copy; a run started by hand always deploys.
