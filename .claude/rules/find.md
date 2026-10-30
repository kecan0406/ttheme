---
paths:
  - "src/cli/find/**"
  - "src/tui/find/**"
  - "src/pictures/{booru-net,fit,works,render,cutout,backdrop,redrawing}*.ts"
  - "src/core/{artists,booru,png,scenes,backdrop-tone}*.ts"
  - "src/cli/pictures.ts"
  - "src/bin.ts"
---

# find: booru search, own pictures, backdrops

## Search

- find searches for the palette's character by its tags in the commons (`siteTags`); a palette of a whole work, or an original, has no tag.
- A palette names a post only by site and number, never an image URL or file.
- danbooru is asked at `shima.donmai.us`, and a pasted `danbooru.donmai.us` link still opens.
- Tags and danbooru's copy are borrowed with one `md5:` list per page, never a request per post.
- Every site is asked for a filter in its own terms (`Site.narrow`), and `eligible` checks every post again on arrival.
- A count danbooru gave up on is NaN, never 0.
- Kin is settled when a post arrives, never by where it lands, and a near dHash only folds, never drops.
- preview reads the `TTHEME_FIND_*` settings again after find returns.

## Screen

- Tiles never move under the cursor, and no preview is fetched for a page nobody scrolls to.
- The installed strip and its rows are always there above `GRID_TOP`, so the first install moves no tile.
- `gridLayout` always leaves the rail's column free.
- The loader stays at the site's quiet uwu level: no kaomoji, sparkles or bouncing type.
- The 80 ms beat runs only while the frame on screen read `view.beat`.
- Nothing draws once the session is aborted, and no timer outlives it.
- Every link is marked `⧉ ` in the color of the site it opens.
- A post is marked as a link only where the terminal opens OSC 8 links (`linkable`), and in the CLI only on a TTY.
- A paste while find asks a question, installs or shows a panel is dropped.

## Pictures

- find never decodes or encodes an image on its own thread: every decode, resize, tint and PNG write goes through `src/pictures/render.ts`.
- `src/bin.ts` guards `runCli` behind `isMainThread`.
- The try view is what installs, down to its tuning and coloring: both draw through the same `draw` and `tryOn`.
- Only PNG and JPEG decode; anything else goes through `sips` on macOS with `--matchTo` the sRGB profile, and `-Z` only for a picture over `MAX_PIXELS`.
- Never widen the crop box past the image: the frame blits instead.
- Cut-outs use the operating system's Vision: never add an ONNX runtime, a model or a `rembg` dependency.
- The cut kept in the cache is Vision's own, before matting.
