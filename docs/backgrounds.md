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
none. A tab busy with a command catches up at its next prompt, focus reporting
is off while that command runs, and a tab whose colors are not a ttheme palette
leaves the picture where it is.

## iTerm2

iTerm2 keeps a picture per tab. There the picture lives in the palette's own
profile — `ttheme · kagami` carries the file, its opacity as Blend and cover or
contain as the image mode, rewritten whenever the picture or its tuning
changes — and putting a palette with a picture on, or taking one off, moves the
tab to that palette's profile with `OSC 1337 SetProfile`. The first time,
iTerm2 asks at the top of the tab whether a control sequence may change the
profile: Always Allow lets every later switch through — put the palette on once
more for the one that asked — and a tab it refuses still wears the palette's
colors, only without the picture. iTerm2 has no
position setting, so a tuned picture that is not centered is baked onto a canvas
the size of the window, as the sizes above 100% are.

## Finding one

A palette with no background yet can find one: on it in `preview`, tab opens
**find**, which searches a booru for the palette's character tag
(`meta.booru`) and lays the results out as a grid of thumbnails. It starts on
danbooru; tab moves to konachan, then yande.re, then back — they share one tag
vocabulary, so the same tag works on each. danbooru and yande.re carry every
rating and `TTHEME_FIND_RATING` picks which come through; konachan is
`konachan.net`, the mirror that carries safe posts only, since `konachan.com`
answers with a Cloudflare challenge. When a site's connection is cut off — the
way a network that blocks boorus by name drops danbooru — find asks whether to
turn on the unblock proxy (`TTHEME_FIND_UNBLOCK`); `y` saves the setting and
opens find again through it, `n` leaves it off. The
sites sit in a strip of tabs under the query, the one you are on lit in its own
color, and it comes again as a badge at the start of the line above a picture
you try on, next to the site the artwork itself came from when the post records
one (`pixiv.net`, `deviantart.com`). The grid starts
with every post of the character; `c` narrows it to **cutouts** — posts carrying
the site's transparency tags (`transparent_background` on danbooru,
`transparent` or `vector` on konachan, `transparent_png` on yande.re) whose PNG header says they have
an alpha channel; yande.re's `transparent_png` already means exactly that, so
its posts skip the header check, which its slow file server would drag out —
and the counter reads shown out of checked, `13/33`. find checks only as far as
the grid reaches and checks more as you scroll; each answer is remembered, so
coming back to a site or a palette never asks its file server again, and a site
you have already seen comes back the moment you tab to it. Newer series carry
few of those tags, so `TTHEME_FIND_CUTOUTS` names the ones to look for, site by
site.

Under each thumbnail is its post id and size, and under that whoever made it:
the artist, which every site names through its tag types at no extra
request, and the uploader as `@name` where a post has no artist tag. A score follows as
`★22` on the sites that keep one. When the same hand uploads the same picture at
the same size over and over, find folds that run into one tile marked `×9`,
wherever the order puts its pictures, and folds in the same way a picture
another site holds too — re-encoded at the same shape, cut from the post its
source names, or hung under the same parent; space unfolds it and folds it
again. Pictures by the uploader of the backgrounds
you already have in the same series come first and carry `≈`, so a series keeps
one hand; anything under 1600 px on its long edge shows its size in yellow.

`s` opens the settings — the ratings to list, the nudity and underwear tags to
block, cutouts or all, newest or score, and whether runs fold — with ↑↓ on the
setting, enter to save them to `config.zsh` and esc to put them back. ←→ change
a value; on the two rows of checkboxes (rating and block) they move between the
boxes and space ticks one, so `safe` and `explicit` can be listed without
`questionable`, or underwear let through while nudity stays blocked. At least
one rating stays ticked. Whatever is not the default shows next to the query, so
the screen never hides what it is filtering by.

`/` opens the query for editing — type a tag to search for something else, or paste a post url or id
(`https://yande.re/post/show/214705`, `konachan:244200`, `7159377`) to go
straight to that one picture. While you type, danbooru's tag completion lists
up to eight tags that start like the last word, each with its post count — the
way to find a costume variant such as `amane_suzuha_(beta)` or a tag you only
half remember; `↑`/`↓` pick one and enter searches it. A palette with no `meta.booru` tag at all opens
find on that empty query, so it can have a background too. `o` opens the post's
page in a browser.

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
palette, cropped with headroom above the face, at the opacity the contrast gate
allows — over a sample of shell output, with the share of transparent pixels
next to its size (`opaque` when there are none). On macOS an opaque picture is
cut out first: ttheme asks the system's own Vision framework (macOS 14 or newer,
through `osascript` — nothing is installed or uploaded) for the character alone,
marks the picture `cut out`, and `x` switches between the cut-out and the picture
as it is. When Vision finds no character, or would leave almost nothing or
remove almost nothing, the picture stays opaque; elsewhere it always does. A post over 25 megapixels is
fetched as the site's own smaller copy instead — up to 3500 px on yande.re and
konachan, 850 px on danbooru — and its size carries `↓`; those
copies are JPEGs, so a cutout tried on that way comes out opaque. `←`/`→` try
the neighbours, which find fetches ahead of you two at a time, and enter installs
and returns to the grid with the tile marked `✓`, the tab, search and scroll as
you left them; esc then hands the last one installed to the preview, which
carries on straight into the tuning panel below. `c` switches
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

An install writes `<palette>.<hash>.png` (the tinted figure),
`<palette>.<hash>@fill-<focus>.png` (the picture made at the shape of the window
find ran in: a cut-out stands whole from its head down against the right edge, a
little taller than the window, and a wallpaper covers it from its top) — the hash is of
their content, because Ghostty and iTerm2 reload a background only when its path
changes, so no two pictures may share a name — `<palette>.conf` and the untouched original under
`backgrounds/originals/`, and starts it untuned — the picture it replaces moves
to the shelf with the tuning it had. The
conf opens with where the picture came from —
`# from yande.re 214705 https://yande.re/post/show/214705` — and the tuning
panel shows it next to the palette's name.

## Tuning

`preview` shows the background of the palette under the cursor while you
browse: through the kitty graphics protocol (Ghostty, kitty, and iTerm2 3.7 or newer)
it draws that palette's `background-image` where Ghostty would place it, faded by
`background-image-opacity`, behind the list — or just its plain background when
it has no file. Only PNG images preview.

On a palette with a background, tab opens a panel that tunes it in place:
`↑`/`↓` pick size, position or opacity, and `←`/`→` change it (with shift, ten
steps at a time). Size walks 1% at a time, shown large in the middle of the
screen as it changes: 100% is the whole image fitted into the window
(`contain`), below that it shrinks to 20%, above it the image grows around the
face until it covers the window, and the top step is **fill** (`cover`). Fill
uses `<palette>.<hash>@fill-<focus>.png` when it sits beside the image — a crop made
to fill the window, whose name carries the height of the figure at the window's middle, which
the sizes above 100% zoom around — and the image itself otherwise. Position
steps through the nine `background-image-position` anchors, or `1`–`9` jump to
one in reading order; opacity moves by 0.01. Space turns the palette's
background off and on, `=` returns it to its defaults, enter keeps the change
and esc puts back what the panel opened with. `f` in the panel opens find again
to replace the picture.

## Several pictures per palette

A palette holds every picture installed on it: an install shelves the one on
screen rather than dropping it, `,` and `.` walk the saved pictures, and `D`
removes the one shown. Each picture carries its own settings — size, position,
opacity, the off switch and the baked crops travel with it under
`backgrounds/shelf/<palette>/<post>/`, so walking back to a picture puts it
back the way you left it, and tuning you have not confirmed is written to the
picture before `,` or `.` moves off it.

The palette's `.conf` holds those defaults; the preview only appends two
optional includes to it and keeps everything else in `<palette>.tune.conf` (the
tuning) and `<palette>.off.conf` (the off switch), which Ghostty loads after
the conf. Kept changes are written when the preview closes, by whichever key,
and reach both terminals from whichever one ran the preview: Ghostty reloads
when it is showing that palette, and iTerm2's profiles are rewritten. Ghostty has no scale setting,
so every size but 100% and fill is baked into a copy beside the image and the
tuning points at it: below 100% onto a transparent canvas of the image's own
size (`kagami.1a2b3c4d@60-bottom-right.png`, fitted with `contain`), above it onto
one of the window's size at the time (`kagami.1a2b3c4d@130-center-2880x1800.png`,
with `cover`). With iTerm2 wired, a size of 100% or less that is not centered
goes onto the window-sized canvas too, since iTerm2 cannot place an image.
Baking runs `sips`, so those sizes are offered on macOS only.

The preview draws inside the cell grid, and Ghostty's `window-padding` around
it keeps showing the configured background. While the cursor rests on the
configured palette and nothing has been tuned, the preview draws nothing and
lets that background show through whole. Once Ghostty supports kitty's relative
placements (merged after 1.3.1), the preview notices when it opens and hangs
its layers out over the padding instead, so every palette reaches the window
edge.
