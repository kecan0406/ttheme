# commons

What a palette is of belongs to no marketplace: `works/<work>.toml`, one file per work whose stem is its id (a slug, never `ttheme`). `loadCommons` (`src/cli/build.ts`) reads them, and `works/` holds only `<name>.toml` files, no folders. `CONTRIBUTING.md` ("Works and characters") has the fields and `schemas/ttheme-work.json` the schema.

- A character's `danbooru` is the tag that says who they are, and no other character holds it: one character, one subject. A work's `danbooru` is its copyright tag, the whole franchise's, and no other work holds it either. A subject is `<work>` or `<work>/<character>`.
- A work lists its characters in cast order, and its `lead` is the character the work is known by (`leadOf`).
- A built-in palette's subject must exist here, or the build fails. A marketplace's proposals in its own `works/` merge under the commons, never over it.
