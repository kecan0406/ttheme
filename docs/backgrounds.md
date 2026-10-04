# Background pictures

## Ghostty

A palette can also bring a Ghostty background image. The block `init` writes
includes `~/.config/ttheme/backgrounds/shown.conf` with an optional
`config-file = ?…`, and that one line names the palette whose picture is up.
Putting a palette on — `ttheme use <name>`, enter in `preview`, `ttheme next`,
`ttheme default`, cd into a pinned directory — rewrites the line and sends
`SIGUSR2`, so whatever Ghostty settings you put in `<palette>.conf` arrive with
the palette, and palettes without a file show no image:

```
# ~/.config/ttheme/backgrounds/kagami.conf
background-image = ~/.config/ttheme/backgrounds/kagami.png
background-image-fit = cover
background-image-opacity = 0.2
```

ttheme ships no images; they stay on your machine. A background is Ghostty
config, not an escape sequence, and Ghostty keeps one background for the whole
app, so one picture is up at a time, in every window. Moving to another tab
brings its own: while a tab sits at its prompt it asks for focus events, and
taking focus puts that tab's picture up — or clears it, when its palette has
none — while a command that ends in a tab behind leaves the picture of the tab
in front alone. A tab busy with a program — Claude Code, vim, ssh, a dev server —
cannot hear its focus, so on macOS a small helper watches which Ghostty window is
in front and puts that tab's picture up about a tenth of a second after you
switch to it. It needs a Ghostty whose AppleScript names a terminal's tty (builds
after 1.3.1); with an older one, or on Linux, a busy tab catches up at its next
prompt. A tab whose colors are not a ttheme palette leaves the picture where it
is. Putting a palette on in the tab itself — `ttheme use`, `next`, a pin —
changes its colors and its picture in the same frame. A tab you switch to can
still show the last tab's picture for a frame or two before its own arrives:
Ghostty draws a tab the moment it shows it, with the one picture it holds.

## iTerm2

iTerm2 keeps a picture per tab. There the picture lives in the palette's own
profile — `ttheme · kagami` carries the file, its opacity as Blend and cover or
contain as the image mode, rewritten whenever the picture or its tuning
changes — and putting a palette with a picture on, or taking one off, moves the
tab to that palette's profile with `OSC 1337 SetProfile`. The first time,
iTerm2 asks at the top of the tab whether a control sequence may change the
profile: Always Allow lets every later switch through — put the palette on once
more for the one that asked — and a tab it refuses still wears the palette's
colors, only without the picture. Once ttheme has seen it allowed, at its next
`add`, `remove`, `browse`, `default`, `on` or `off`, every palette goes on through its
profile, colors and picture in one switch. iTerm2 has no
position setting, so a tuned picture that is not centered is baked onto a canvas
the size of the window, as the sizes above 100% are.

## Warp

Warp keeps one theme for the whole app, and a theme can carry a
`background_image`. So a palette with a picture gets a second theme file,
`~/.warp/themes/ttheme-<palette>.<hash>.yaml`, next to its plain one, showing
the picture laid whole on the palette's background at the picture's opacity —
laid on it because Warp's opacity lays the background color over the picture,
so a picture with see-through parts would let the desktop through. The hash
changes with the picture and its opacity, because Warp reads a theme file once
and never again: `ttheme default`, and a tab that wears the palette, put on its
newest one, and a picture changed anywhere moves Warp to its new file within a
second while Warp wears that palette. Warp has no position or size setting and draws every picture as
cover, so with Warp wired a tuned picture that is not a fill is baked onto a
canvas the size of the window, centered or not.

Preview's image edit tunes and finds pictures in Warp too. While you are in it,
each step lays the picture on the background in one pass (about 0.2 s), writes a
short-lived theme and switches Warp to it; a held key does this once, when it is
let go, and an opacity step keeps the same picture, so it draws nothing. Warp
takes another 0.6–0.7 s to show any theme change, and the first time it loads a
picture it draws one frame of the background color alone, which the picture's
opacity shows through (faint at 0.2, a grey flash at 1). Each step's picture is
written where saving it would put it, so applying a tuning shows the very
picture already on screen, and closing preview removes the short-lived theme
and the pictures no theme uses. Warp draws every picture layer above colored
cells, so find draws no cover there and preview puts the palette's plain theme
on while find runs.

## Terminal.app

Terminal.app keeps a picture per tab, in the palette's own profile, as iTerm2
does — `ttheme · kagami` carries the picture, and putting a palette on moves the
tab to that palette's profile through Terminal.app's own scripting, which macOS
lets a Terminal.app tab do without asking. Terminal.app has no graphics
protocol and stretches a profile's picture over the whole window, and it shows
whatever a picture leaves see-through as light grey rather than the background.
So the profile carries the picture laid whole on the palette's background at the
picture's opacity, placed as Ghostty places it on a canvas the shape of your
Terminal.app windows — the layer notes that shape from the first tab it starts
in, and lays the pictures again when a window of another shape turns up. A
profile with a picture is opaque, whatever your own profile's transparency.

Terminal.app reads a profile once a session, and a picture file once per name,
but finds the file again by its identity each time a tab takes the profile. So a
picture tuned, replaced or removed while Terminal.app runs is written into the
file the profile already points at, under a new name, and every tab wearing
that palette takes its profile again at its next prompt or focus; only a
palette's first picture, whose profile Terminal.app read without one, waits for
its next start. Preview's image edit shows each tuning step the same way, in
the tab you tune in, and puts the saved picture back when you leave without
saving. The picture strip shows empty frames and find is not offered, since
both need pictures drawn in the text area.

## Finding one

A palette with no background yet can find one: on it in `preview`, `tab` opens its
panel on an empty frame where the picture would be, and `enter` there (or `f`)
opens **find**, which searches for the palette's character tag (`meta.booru`) and lays
the results out as a grid of thumbnails, over the palette's own background — the
picture the terminal shows for another palette stays out of sight while find is
open. The arrows move through it, and `j`/`k` down and up a row. It opens on
**all**, every site's posts ranked together; tab moves to danbooru, konachan, yande.re and zerochan alone,
then back, and shift+tab goes the other way. The boorus share one tag vocabulary, and zerochan names characters in
words (`Gotou Hitori`), which find asks for with underscores (`gotou_hitori`);
where a site calls the character something else, the palette names it there in
`[meta.booru_sites]`. danbooru and yande.re carry every rating and
`TTHEME_FIND_RATING` picks which come through; konachan is `konachan.net`, the
mirror that carries safe posts only, since `konachan.com` answers with a
Cloudflare challenge; zerochan keeps no rating, so its posts count as safe unless
they carry a nudity tag. danbooru is asked at `shima.donmai.us`, a name of its
own that networks blocking `danbooru.donmai.us` by hostname let through. A
konachan, yande.re or zerochan post that danbooru holds too — the same file,
known by md5 from the tags each page borrows — is downloaded from danbooru's
servers, which answer faster than yande.re's and zerochan's, and stays that
site's post. The
sites sit in a strip of tabs under the query, the one you are on lit in its own
color, and it comes again as a badge at the start of the line above a picture
you try on. The grid starts
with every post of the character; `c` narrows it to **cutouts** — posts carrying
the site's transparency tags (`transparent_background` on danbooru and zerochan,
`transparent` or `vector` on konachan, `transparent_png` on yande.re) whose PNG header says they have
an alpha channel; yande.re's `transparent_png` already means exactly that, so
its posts skip the header check, which its slow file server would drag out —
and the counter reads shown out of checked, `13/33`. find checks only as far as
the grid reaches and checks more as you scroll; each answer is remembered, so
coming back to a site or a palette never asks its file server again, and a site
you have already seen comes back the moment you tab to it. Newer series carry
few of those tags, so `TTHEME_FIND_CUTOUTS` names the ones to look for, site by
site.

Under each thumbnail is its post id — a link to the post's page, marked `⧉` in
the site's color the way Claude Code marks a link, and opened with a click
(cmd+click in Ghostty and iTerm2); the same mark sets off every post number
find, preview's image edit and `ttheme add` show — and size, and under that the artist: named
by the site's own tag types, by danbooru's tags for the same file, or, on a
zerochan post danbooru does not hold, by the post's page once you have tried it
or the post beside it on — a `—` until one is known. A score follows as
`★22` on the sites that keep one. When the same hand uploads the same picture at
the same size over and over, find folds that run into one tile marked `×9`,
wherever the order puts its pictures, and folds in the same way a picture
another site holds too — re-encoded at the same shape, cut from the post its
source names, or hung under the same parent; space unfolds it and folds it
again. Pictures by the uploader of the backgrounds
you already have in the same series come first and carry `≈`, so a series keeps
one hand; anything under 1600 px on its long edge shows its size in yellow.

While a search is on its way and the grid has nothing to show, the middle of it
names the step it waits on — `Fetching posts`, `Ranking previews by palette
colors  7/30`, `Checking PNG headers` — over a bar in the palette's cursor color
that fills with the count or, while there is none, sweeps slowly across, and
under it the sites, each brightening when its first page arrives. It rises out
of the background in a third of a second and is gone the moment the first tiles
land; the footer carries on with `Loading thumbnails · 14/24` for the tiles in
view, and until the first posts arrive the line above it shows one of the keys
only `?` lists. Scrolled to the end while the next page is on its way, the same
loader sits in the lines under the last row. The grid scrolls a line at a time
instead of jumping a row of tiles, the lines left under the last whole row show
the top of the next one, and the bar on the right edge marks where you are
among the posts fetched so far. iTerm2 cannot show part of a picture by itself,
so find cuts the rows it needs first; there a tile half out of view shows up
once the grid settles rather than sliding past the edge.

`s` opens the settings — the ratings to list, the nudity and underwear tags to
block, cutouts or all, newest or score, and whether runs fold — with ↑↓ on the
setting, enter to save them to `config.zsh` and esc to put them back. ←→ change
a value; on the two rows of checkboxes (rating and block) they move between the
boxes and space ticks one, so `safe` and `explicit` can be listed without
`questionable`, or underwear let through while nudity stays blocked. At least
one rating stays ticked. A row that is not at its default names the default at
the panel's right edge (`Default fit`). `Advanced ›` under the rows (enter on
it, or `a` from any row) turns the panel to its advanced page and `‹ Basic`
back; a `•` beside it says a setting on the other page is not at its default.
The advanced page holds the lowest score, the shortest side a picture
must reach, the sites the all tab mixes, the kinds of picture to hide by tag
(comic, monochrome, sketch, chibi), tags of your own to hide and PNG only. The
panel keeps one size and place on both pages and while a value is typed. Under
the rows the panel says what the one
under the cursor does and which sites keep it, and what each site holds for the
query at the values on screen before they are saved (`makise_kurisu: danbooru
572 · konachan 42 · yande.re 213 · zerochan no count` at 1600 px), counted again
a moment after each change. ←→ steps the score and size, a number typed on
either row sets any other, and enter on `hide tags` takes the tags to type;
enter or `s` saves both pages. Each site is asked to
filter by what it can (danbooru takes its size, score and file-type terms
without counting them against its two tags, zerochan its own `large` and
`huge`), every post is checked again on arrival, and a site that cannot keep a
filter — zerochan has no score — says so above the grid. Whatever is not the
default shows next to the query, so the screen never hides what it is
filtering by.

`/` opens the query for editing — type a tag to search for something else, or paste a post url or id
(`https://yande.re/post/show/214705`, `konachan:244200`, `7159377`) to go
straight to that one picture. While you type, danbooru's tag completion lists
up to eight tags that start like the last word, each with its post count — the
way to find a costume variant such as `amane_suzuha_(beta)` or a tag you only
half remember; `↑`/`↓` pick one and enter searches it; a Japanese input
method composes in the query itself. A palette with no `meta.booru` tag at all opens
find on that empty query, so it can have a background too. `o` opens the post's
page in a browser.

The row under the site tabs lists the tags the search uses and, after them, the
characters danbooru says share posts with the first one (up to nine in all, so
a palette for a game's version also offers its cast). `1`–`9` turns one on or
off, and the search runs again at once with the tags that are on ORed together.
Danbooru searches two tags at a time and zerochan one, so a longer list is cut
there and the line above the grid names what was left out; konachan, yande.re
and zerochan are asked for the same names once you turn one on.

Under the tags, a strip of thumbnails shows the pictures the palette already has
— the one on show first marked with a bar — with each post number above it as a
link, and `+3` for those that do not fit. A line under it marks where the grid
begins. The strip stays where it is while the grid scrolls under it, and a
picture you install joins it at once.

## Your own pictures

A picture of your own goes in the same way. Drop an image file on the window
while find is open, or paste it — a file copied in Finder, its path, or a link
to the image — and find tries it on as if it were a post. `ctrl+v` (or `v`
outside the search field, `alt+v` on Windows) reads the clipboard itself, which
is how a screenshot or a browser's "Copy Image" gets in, since no terminal
pastes picture data as text — on macOS ctrl+shift+cmd+4 takes a screenshot
straight to the clipboard. When the window comes back into focus with a picture
on the clipboard, find says so for a few seconds; text on the clipboard that is
neither a file nor a link goes into the search field instead. Every terminal hands a dropped
file over as its path, each quoted its own way, and find reads them all; kitty
and iTerm2 3.7 also deliver the dropped picture itself through kitty's
drag-and-drop protocol, so a picture dragged out of a browser works there too,
and kitty's clipboard protocol makes Cmd+V with a picture on the clipboard work
directly, over ssh as well. PNG and JPEG work everywhere; macOS converts any
other picture (HEIC, WebP, GIF, TIFF…) and shrinks one over 25 megapixels. The
installed picture is named `local` in the conf's `# from` line, with the file or
link it came from, and keeps its original under `backgrounds/originals/` like a
booru post. Over ssh `ctrl+v` can only reach the clipboard through kitty's protocol,
since the clipboard is on your own machine.

## Trying it on

Enter tries the picture on: ttheme downloads the original and paints the whole
window with it the way the installed background will look — tinted with the
palette (or in its own colors, with `TTHEME_BG_COLORS=original`, and `c` switches between the two), cropped with
headroom above the face, at the opacity the contrast gate allows — over one of preview's five sample scenes (⇧←→ switch them), with the
share of transparent pixels next to its size (`opaque` when there are none).
Under that line the post's page, the source the artwork came from and its artist
always show, a `—` where the post names none; a source that is a pixiv image
file (which pixiv refuses to open from a link) is named by its artwork page; the page, the source and the post
id are links, opened with a click (cmd+click in Ghostty and iTerm2). `i` puts
the rest of the post's details where the scene was — characters, series, the
other tags, rating, score, the day it was posted, file type and size, uploader,
each row kept with a `—` where the post names none — and `i` again brings the
scene back. They come with the posts' own answers, except on zerochan, whose
list types no tags: a post danbooru holds takes danbooru's names and leaves its
uploader and day at `—`, and one it does not fetches its page once — beside the
picture, and ahead of time for the posts on either side — for its artist,
characters, series, uploader and day. `t` opens the same tuning panel preview's image edit has (see
[Tuning](#tuning)) over the picture: size, position and opacity change what you
see in place, stay as you move to the next post, and are installed with the
picture, so preview opens it the way you left it. `c` draws the picture in the palette's tone or in its own
colors, from the picture or from the tuning panel: the setting only names where
find starts, the choice stays as you move to the next post and is what enter
installs, and the opacity goes back to the new coloring's default (esc in the
panel undoes the tuning, not the colors). On macOS an opaque picture is
cut out first: ttheme asks the system's own Vision framework (macOS 14 or newer,
through `osascript` — nothing is installed or uploaded) for the character alone,
marks the picture `cut out`, and `x` switches between the cut-out and the picture
as it is. When Vision finds no character, or would leave almost nothing or
remove almost nothing, the picture stays opaque; elsewhere it always does. A post over 25 megapixels is
fetched as the site's own smaller copy instead — up to 3500 px on yande.re and
konachan, 850 px on danbooru; zerochan names none, so its larger posts are left
out — and its size carries `↓`; those
copies are JPEGs, so a cutout tried on that way comes out opaque. `←`/`→` try
the neighbours, which find fetches ahead of you two at a time, and enter installs
— keeping the artist and the artwork's page with the picture, which the tuning
panel's title names (`Background · akoiro · danbooru 12267381`) — and returns
to the grid with the tile marked `✓`, the tab, search and scroll as
you left them; esc then hands the last one installed to the preview, which
carries on straight into the tuning panel below. In the grid `c` switches
between every post and the cutouts, esc goes back. Unless the settings say otherwise,
only `safe` and `general` posts are shown, and none tagged with nudity or
underwear (`nude`, `panties` and each site's own spelling of them) — with only
`safe` ticked yande.re and konachan are asked for `rating:s`, whatever else is
searched; ticking more ratings or unticking a block in the `s` panel widen it. danbooru takes only two tags from a
signed-out search, so on it a cutout search leaves the score order out and says
so. Thumbnails and header checks stay in
`~/.cache/ttheme/<site>/`; the pictures you try on last only while find is open.
When a site asks ttheme to slow down, find waits as long as it names, up to a
minute, with a countdown at the bottom. ttheme keeps no
list of images — the tag is all it knows about a character.

An install writes `<palette>.<hash>.png` (the figure),
`<palette>.<hash>@fill-<focus>.png` (the picture made at the shape of the window
find ran in: a cut-out stands whole from its head down against the right edge, a
little taller than the window, and a wallpaper covers it from its top) — the hash is of
the post and their content, because Ghostty and iTerm2 reload a background only when its path
changes, so no two pictures may share a name — and the untouched original under
`backgrounds/originals/`, with the cut-out's alpha beside it as
`<palette>-<post>.cut.png` when Vision cut the character out, records it in
`backgrounds/images.json`, and starts it untuned; the picture that was up stays
saved with the tuning it had. The palette's `<palette>.conf` is rewritten from
`images.json` to point at the picture on screen, and opens with where it came
from — `# from yande.re 214705 https://yande.re/post/show/214705` — and the
tuning panel shows it next to the palette's name.

Both files are one color, the palette's tone, with the picture's brightness as
their alpha: an 8-bit indexed PNG, about 40% of the size of a full-color one. The
terminal lays that over its own background at the picture's opacity, so what
shows is the background moving toward the tone as far as the picture is bright —
the tint, without the background baked into any pixel. A picture whose brightest
percent stops short of white is lifted until it reaches the tone, at most twice
over, so a dark picture still shows; the contrast gate's opacity is worked out
for the tone itself, so the lift never takes text past it. Resizing uses a
Mitchell filter that averages every source pixel when it shrinks, so fine lines
neither break up nor alias, and stays smooth when a small picture is enlarged.
`TTHEME_BG_BLUR` softens every picture by that many screen pixels.

## Original colors

A picture can also keep its own colors. `TTHEME_BG_COLORS=original` (in `ttheme
config`, or alt-c in `preview`) draws every picture installed from then on that
way, and the `Colors` row of preview's image edit (or `c` in find's try view, for the
picture about to be installed) switches one picture at a time,
whatever the setting is — `←`/`→` on it, or `c` from any field, draw that picture
again from its original, in the palette's tone or in its own colors, which takes
a moment and is kept at once: esc undoes the tuning, not the colors, and `c`
again switches back. While image edit sits on a picture, ttheme draws the other
coloring in the background (`ttheme image <palette> prepare`), and every drawing
is kept in `~/.cache/ttheme/drawn/` (the twelve latest, however many pictures
there are), so `c` and going back to the coloring you left both just move the
files in place, in a few hundredths of a second, as long as the picture's
original and the palette's tone are as they were. The
files are then ordinary RGBA PNGs: the picture's colors and its own alpha (the
cut-out's, or none), bigger than a tone picture's indexed file, and the terminal
lays them over its background at the picture's opacity, exactly as it does a
tone. Nothing is lifted, so the picture is as bright as the artist made it.

That brightness is what sets the default opacity. A tone is one known color, so
the contrast gate could work its opacity out once for the palette; a picture in
its own colors is as bright as its brightest pixels, so ttheme takes the color
of the brightest 1% of the picture (`peak` in `images.json`) and gives it the
highest opacity at which the palette's text still passes the gate on it, and
never brighter than a tone picture may be. A picture with white in it opens at
about half a tone's opacity, a dark one stronger, and either is faint: raise
the opacity in the tuning panel as far as the text allows — the panel does not
stop you at the gate. Switching a picture between tone and original keeps its
size and position and puts its opacity back to the new default. When the
palette's colors change, the opacity stays as it is. The terminals take these files as they take a tone's, since each only lays
a file over its background at an opacity — Warp and Terminal.app through a copy
laid on the background first; Ghostty, iTerm2, kitty, WezTerm, Warp, Konsole and
Terminal.app are the ones that show pictures at all.

When a palette's colors change (`edit`, `update`, a new catalog), the next sync
paints its pictures in the new tone under new names, carrying their tuning and
their opacity: a picture keeps the opacity it was installed with, or the one you
set, however the colors move. Changing
`TTHEME_BG_BLUR` in `ttheme config` or preview's alt-c panel draws every picture
again from its original, as does the first `init` of a version that draws them
differently; a picture whose original is gone is left as it was, and init says so.

## Tuning

`preview` shows the background of the palette under the cursor while you
browse: through the kitty graphics protocol (Ghostty, kitty, and iTerm2 3.7 or newer)
it draws that palette's `background-image` where Ghostty would place it, faded by
`background-image-opacity`, behind the list — or just its plain background when
it has no file. Only PNG images preview.

On a palette with a background, the panel `tab`, `→` or `ctrl+e` opens in `preview` tunes it
in place, above the palette's colors — the panel opens on it, and `↓` past its
last field moves on to the slots. Its first row is **Images**, the palette's
pictures as thumbnails (see [Several pictures](#several-pictures-per-palette)),
and under it `↑`/`↓` (or `j`/`k`) pick colors, size, position or opacity, and `←`/`→` change it (with
shift, ten steps at a time; `c` switches the colors from any field — see
[Original colors](#original-colors)). Size walks 1% at a time, shown large in the middle of the
screen as it changes: 100% is the whole image fitted into the window
(`contain`), below that it shrinks to 20%, above it the image grows around the
face until it covers the window, and the top step is **fill** (`cover`). Fill
uses `<palette>.<hash>@fill-<focus>.png` when it sits beside the image — a crop made
to fill the window, whose name carries the height of the figure at the window's middle, which
the sizes above 100% zoom around — and the image itself otherwise. Position
steps through the nine `background-image-position` anchors, or `1`–`9` jump to
one in reading order; opacity moves by 0.01. A field that is not at its
default carries `↺` at the panel's right edge, lit on the field the cursor is on:
`=` puts that one field back, `+` all three of size, position and opacity (and
shows the picture again if it was off). Space turns the palette's background off and on, `s` saves
the change — with the tone, see [Palette edit](usage.md#palette-edit) — and esc goes back to the list,
dropping what you changed since the last save. `f` in the panel opens find to add a picture, keeping what you tuned so far.

## Several pictures per palette

A palette holds every picture installed on it: an install keeps the one on
screen rather than dropping it. At the top of the tuning panel, **Images** shows
up to five of the palette's pictures as thumbnails, with the one on screen
framed and its place (`2/3`) beside them; `←`/`→` on that row, or `,` and `.`
from any, move along it, the
strip sliding round when there are more, and the background shows that picture
with its own tuning at once — nothing is saved until `s`, which makes it the
palette's picture, and esc goes back to the one the panel opened with. `D`
removes the picture the strip is on, with its files. `backgrounds/images.json` lists each
palette's pictures and which one is up; only ttheme writes it, and the pictures'
files never move — showing another picture only rewrites `<palette>.conf` to
point at it, and every picture the palette holds is listed in the conf as a
`# picture` line, which is where the strip reads them. Each picture carries its own settings — size, position, opacity,
the off switch and the baked crops sit beside it under its own name
(`kagami.1a2b3c4d.tune.conf`), so moving back to a picture puts it back the way
you left it.

The palette's `.conf` holds the shown picture's defaults and includes that
picture's `<palette>.<hash>.tune.conf` (the tuning) and
`<palette>.<hash>.off.conf` (the off switch), which Ghostty loads after the
conf. A `<palette>.conf` you write yourself is left alone; the preview appends
`<palette>.tune.conf` and `<palette>.off.conf` includes to it instead.
Saved changes are written at once, by `s`,
and reach both terminals from whichever one ran the preview: Ghostty reloads
when it is showing that palette, and iTerm2's profiles are rewritten. Ghostty has no scale setting,
so every size but 100% and fill is baked into a copy beside the image and the
tuning points at it: below 100% onto a transparent canvas of the image's own
size (`kagami.1a2b3c4d@60-bottom-right.png`, fitted with `contain`), above it onto
one of the window's size at the time (`kagami.1a2b3c4d@130-center-2880x1800.png`,
with `cover`). With iTerm2 wired, a size of 100% or less that is not centered
goes onto the window-sized canvas too, since iTerm2 cannot place an image.
Baking runs `sips`, so those sizes are offered on macOS only.

The preview and find draw inside the cell grid, and Ghostty's `window-padding` around
it keeps showing the configured background. While the cursor rests on the
configured palette and nothing has been tuned, the preview draws nothing and
lets that background show through whole. Once Ghostty supports kitty's relative
placements (merged after 1.3.1), the preview notices when it opens and hangs
its layers out over the padding instead, so every palette reaches the window
edge, and hands the same margins to find, whose plain background covers the
padding too.
