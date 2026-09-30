export XDG_CONFIG_HOME=$(mktemp -d)
trap "rm -rf $XDG_CONFIG_HOME" EXIT
export HOME=$XDG_CONFIG_HOME/home
mkdir -p $HOME
unset TERM_PROGRAM GHOSTTY_RESOURCES_DIR KITTY_WINDOW_ID WEZTERM_PANE ALACRITTY_WINDOW_ID KONSOLE_VERSION ITERM_SESSION_ID WT_SESSION WARP_TERMINAL_SESSION_UUID XDG_STATE_HOME
mkdir -p $XDG_CONFIG_HOME/ttheme
cp -R shell/ttheme.zsh shell/adapters dist/shell/palettes.zsh $XDG_CONFIG_HOME/ttheme/
source $XDG_CONFIG_HOME/ttheme/ttheme.zsh
b64d() {
  local in=$(cat)
  [[ $in != *[^A-Za-z0-9+/=]* ]] || { print -u2 "not base64: ${(V)in}"; return 1 }
  print -rn -- $in | base64 --decode
}
(( ${#TTHEME_PALETTE} > 0 )) || { print -u2 "no palettes loaded"; exit 1 }
(( ${#TTHEME_ORDER} + 1 == ${#TTHEME_PALETTE} )) || { print -u2 "order/palette mismatch"; exit 1 }
__tt_menu > /dev/null || exit 1
ttheme help > /dev/null || { print -u2 "ttheme help broke"; exit 1 }
ttheme -h > /dev/null || { print -u2 "ttheme -h broke"; exit 1 }
REPLY=; __tt_resolve ho || exit 1
[[ $REPLY == homura ]] || { print -u2 "prefix resolve broke: $REPLY"; exit 1 }
ttheme homura 2>/dev/null && { print -u2 "ttheme took a palette name as a command"; exit 1 }
ttheme use nosuchpalette 2>/dev/null && { print -u2 "ttheme use took a bad name"; exit 1 }
out=$(ttheme use city 2>&1) && { print -u2 "ttheme use took a bad name"; exit 1 }
[[ $out == *"did you mean"*nightcity* ]] || { print -u2 "did-you-mean broke: $out"; exit 1 }
ttheme --frobnicate 2>/dev/null && { print -u2 "ttheme took an unknown option"; exit 1 }
ttheme next extra 2>/dev/null && { print -u2 "ttheme next took an extra argument"; exit 1 }
[[ $(ttheme pin --help) == "Usage: ttheme pin"* ]] || { print -u2 "ttheme pin --help did not describe pin"; exit 1 }
[[ $(ttheme pins --help) == "Usage: ttheme pins"$'\n\n'"Map every pinned directory"* ]] || { print -u2 "ttheme pins --help did not describe pins"; exit 1 }
ttheme pins extra 2>/dev/null && { print -u2 "ttheme pins took an extra argument"; exit 1 }
out=$(ttheme preview </dev/null 2>&1) && { print -u2 "ttheme preview ran without a tty"; exit 1 }
[[ $out == *"needs a terminal"* ]] || { print -u2 "preview tty guard broke: $out"; exit 1 }
EDITOR=true ttheme config > /dev/null || { print -u2 "ttheme config broke"; exit 1 }
source $XDG_CONFIG_HOME/ttheme/adapters/ghostty.zsh
REPLY=; __tt_b64 26 22 29
[[ $REPLY == GhYd ]] || { print -u2 "__tt_b64 broke on 3 bytes: $REPLY"; exit 1 }
REPLY=; __tt_b64 26 22 29 204
[[ $REPLY == GhYdzA== ]] || { print -u2 "__tt_b64 broke on 4 bytes: $REPLY"; exit 1 }
REPLY=; __tt_bg_place 2560 1550 714 518 1 1 100 5 cover
[[ $REPLY == "1 1 714 518 209 0 2137 1550" ]] || { print -u2 "__tt_bg_place broke on a fill: $REPLY"; exit 1 }
REPLY=; __tt_bg_place 2045 1994 100 40 8 16 60 9 contain
[[ $REPLY == "52 17 49 24 5 0 2039 1994" ]] || { print -u2 "__tt_bg_place broke on a sized corner: $REPLY"; exit 1 }
REPLY=; __tt_bg_frame 2056 2560 1600 1000 199 5 contain 62
[[ $REPLY == "1598 1990 1 -733" ]] || { print -u2 "__tt_bg_frame broke on a zoom around the face: $REPLY"; exit 1 }
typeset -A bgfrom=() bgurl=() bgby=() bgsrc=() bgfill=() bgfocus=() bgsize=() bgpos=() bgop=() bgdef=() bgoff=() bgbase=() bgload=() bgshot=() bgshotkey=() bgdim=() bgtunef=() bgofff=() bgimages=() bgpic=() bgpics=() bgact=() bgview=() bgswap=() bgthumb=() tsnaps=() bgedit=() bgcolors=()
bgd=$XDG_CONFIG_HOME/ttheme/backgrounds
mkdir -p $bgd && : > $bgd/kagami@fill-42.png && : > $bgd/kagami@60-bottom-right.png && : > $bgd/kagami@130-bottom-right-1600x1000.png
base=("# by akoiro,potate" "# from safebooru 416805 https://safebooru.org/index.php?page=post&s=view&id=416805" "background-image = kagami@fill-42.png" "background-image-fit = cover" "background-image-opacity = 0.2")
print -l $base > $bgd/kagami.conf
print -l "background-image = kagami@130-bottom-right-1600x1000.png" "background-image-fit = cover" "background-image-position = bottom-right" "background-image-opacity = 0.252" > $bgd/kagami.tune.conf
__tt_bg_load kagami
[[ $bgsrc[kagami] == "$bgd/kagami.png" && $bgfill[kagami] == "$bgd/kagami@fill-42.png" && $bgfocus[kagami] == 42 && $bgsize[kagami] == 130 && $bgpos[kagami] == 9 && $bgop[kagami] == 0.252 &&
  $bgshot[kagami] == "$bgd/kagami@130-bottom-right-1600x1000.png" && $bgdef[kagami] == "fill 5 0.2" && $bgoff[kagami] == 0 &&
  $bgfrom[kagami] == "safebooru 416805" && $bgby[kagami] == "akoiro, potate" &&
  $bgurl[kagami] == "https://safebooru.org/index.php?page=post&s=view&id=416805" ]] ||
  { print -u2 "__tt_bg_load misread the confs: $bgsrc[kagami] $bgfill[kagami]@$bgfocus[kagami] $bgsize[kagami] $bgpos[kagami] $bgop[kagami] $bgshot[kagami] ($bgdef[kagami]) off=$bgoff[kagami] from=$bgfrom[kagami] by=$bgby[kagami] url=$bgurl[kagami]"; exit 1 }
tpick=kagami color=0
TTHEME_ADAPTER=ghostty __tt_pv_bg_title 80
[[ $REPLY == "Background · akoiro, potate · ⧉ "$'\e]8;;'"$bgurl[kagami]"$'\e\\'"safebooru 416805"$'\e]8;;\e\\' ]] ||
  { print -u2 "the tuning title did not link its post: ${(q+)REPLY}"; exit 1 }
TTHEME_ADAPTER=terminal-app __tt_pv_bg_title 80
[[ $REPLY == "Background · akoiro, potate · safebooru 416805" ]] ||
  { print -u2 "the tuning title linked its post where the terminal cannot open it: ${(q+)REPLY}"; exit 1 }
TTHEME_ADAPTER=ghostty __tt_pv_bg_title 30
[[ $REPLY == "Background · akoiro, potate" ]] ||
  { print -u2 "a narrow tuning title did not keep the artist over the post: ${(q+)REPLY}"; exit 1 }
tpick=""
bgsize[kagami]=100 bgoff[kagami]=1
__tt_bg_write kagami || { print -u2 "__tt_bg_write failed"; exit 1 }
[[ "$(<$bgd/kagami.conf)" == "$(print -l $base "config-file = ?kagami.tune.conf" "config-file = ?kagami.off.conf")" ]] ||
  { print -u2 "__tt_bg_write touched the defaults wrong:"; cat $bgd/kagami.conf; exit 1 }
[[ "$(<$bgd/kagami.tune.conf)" == "$(print -l "background-image = $bgd/kagami.png" "background-image-fit = contain" "background-image-position = bottom-right" "background-image-opacity = 0.252")" ]] ||
  { print -u2 "__tt_bg_write wrote the tuning wrong:"; cat $bgd/kagami.tune.conf; exit 1 }
[[ -e $bgd/kagami.off.conf && -e $bgd/kagami@fill-42.png && ! -e $bgd/kagami@60-bottom-right.png && ! -e $bgd/kagami@130-bottom-right-1600x1000.png ]] ||
  { print -u2 "__tt_bg_write left the off switch or sized copies wrong"; ls $bgd; exit 1 }
bgsrc=(); __tt_bg_load kagami
[[ $bgsize[kagami] == 100 && $bgoff[kagami] == 1 ]] || { print -u2 "tuning did not round-trip: $bgsize[kagami] off=$bgoff[kagami]"; exit 1 }
bgsize[kagami]=fill bgpos[kagami]=5 bgop[kagami]=0.2 bgoff[kagami]=0
__tt_bg_write kagami || { print -u2 "__tt_bg_write (defaults) failed"; exit 1 }
[[ ! -e $bgd/kagami.tune.conf && ! -e $bgd/kagami.off.conf && "$(<$bgd/kagami.conf)" == "$(print -l $base "config-file = ?kagami.tune.conf" "config-file = ?kagami.off.conf")" ]] ||
  { print -u2 "returning to the defaults left files behind:"; ls $bgd; cat $bgd/kagami.conf; exit 1 }
print -l "background-image = wall.png" "background-image-fit = cover" > $bgd/wall.conf
__tt_bg_load wall
[[ $bgsize[wall] == fill && $bgfill[wall] == "$bgd/wall.png" && $bgfocus[wall] == 50 && $bgdef[wall] == "fill 5 1" ]] ||
  { print -u2 "a plain cover image did not load as fill: $bgsize[wall] $bgfill[wall]@$bgfocus[wall] ($bgdef[wall])"; exit 1 }
(
  TTHEME_TERMINALS=(warp)
  ! __tt_bg_aligns && __tt_bg_covers || { print -u2 "with Warp wired a tuned picture was not baked for it"; exit 1 }
  printf '\x89PNG\r\n\x1a\n\0\0\0\x0dIHDR\0\0\x06\x5a\0\0\x07\x60' >| $bgd/kagami.png
  __tt_bg_bake() { print -r -- "$*" >| $XDG_CONFIG_HOME/bake.log; : >| $2 }
  pw=80 ph=24 bgcw=20 bgch=40 bgmx=0 bgmy=0
  bgsrc=(); __tt_bg_load kagami
  bgsize[kagami]=60 bgpos[kagami]=5 bgop[kagami]=0.3
  __tt_bg_write kagami || { print -u2 "__tt_bg_write (Warp wired) failed"; exit 1 }
  [[ "$(<$bgd/kagami.tune.conf)" == "$(print -l "background-image = $bgd/kagami@60-center-1600x960.png" "background-image-fit = cover" "background-image-position = center" "background-image-opacity = 0.3")" &&
    "$(<$XDG_CONFIG_HOME/bake.log)" == "$bgd/kagami.png $bgd/kagami@60-center-1600x960.png 1600 960 "* ]] ||
    { print -u2 "a centered picture tuned with Warp wired was not baked on the window, which Warp covers:"; cat $bgd/kagami.tune.conf; exit 1 }
  __tt_cli() { print -r -- "$*" >> $XDG_CONFIG_HOME/cli.log }
  __tt_pictured kagami
  TTHEME_TERMINALS=(iterm2 warp)
  __tt_pictured kagami
  [[ "$(<$XDG_CONFIG_HOME/cli.log)" == "$(print -l "image kagami tuned" "image kagami tuned")" ]] ||
    { print -u2 "a picture saved with Warp wired did not refresh Warp's themes once:"; cat $XDG_CONFIG_HOME/cli.log; exit 1 }
  rm -f $bgd/kagami.png $bgd/kagami.tune.conf $bgd/kagami@60-center-1600x960.png $XDG_CONFIG_HOME/bake.log $XDG_CONFIG_HOME/cli.log
) || exit 1
[[ "$(<$TTHEME_CONFIG)" == "$TTHEME_CONFIG_TEMPLATE" ]] || { print -u2 "config seed drifted from the template"; exit 1 }
reloads=0
TTHEME_TERMINALS=(ghostty)
__tt_reload_ghostty() { (( ++reloads )) }
__tt_shown kagami && __tt_reload || { print -u2 "__tt_shown did not move the picture to kagami"; exit 1 }
[[ "$(<$bgd/shown.conf)" == "config-file = ?kagami.conf" ]] || { print -u2 "shown.conf named the wrong palette: $(<$bgd/shown.conf)"; exit 1 }
__tt_shown kagami && { print -u2 "__tt_shown asked for a reload with nothing to change"; exit 1 }
__tt_shown miku && __tt_reload || { print -u2 "__tt_shown kept a picture the palette does not have"; exit 1 }
[[ "$(<$bgd/shown.conf)" == "config-file = ?miku.conf" ]] || { print -u2 "shown.conf did not follow miku: $(<$bgd/shown.conf)"; exit 1 }
__tt_shown rei && { print -u2 "__tt_shown reloaded between two palettes with no picture"; exit 1 }
(( reloads == 2 )) || { print -u2 "__tt_shown asked for $reloads reloads"; exit 1 }
REPLY=; __tt_bg_shown || { print -u2 "__tt_bg_shown did not read shown.conf"; exit 1 }
[[ $REPLY == miku ]] || { print -u2 "shown.conf did not read back as miku: $REPLY"; exit 1 }
TTHEME_SPEC=$TTHEME_PALETTE[kagami]; __tt_sync
[[ "$(<$bgd/shown.conf)" == "config-file = ?kagami.conf" && $reloads == 3 ]] ||
  { print -u2 "taking the tab did not put its picture up: $(<$bgd/shown.conf) reloads=$reloads"; exit 1 }
__tt_focus
(( reloads == 3 )) || { print -u2 "focus reloaded with the right picture already up"; exit 1 }
print -r -- "config-file = ?miku.conf" > $bgd/shown.conf
__tt_focus
[[ "$(<$bgd/shown.conf)" == "config-file = ?kagami.conf" && $reloads == 4 ]] ||
  { print -u2 "focus did not take the picture back: $(<$bgd/shown.conf) reloads=$reloads"; exit 1 }
TTHEME_SPEC=$TTHEME_PALETTE[rei]; __tt_sync
[[ "$(<$bgd/shown.conf)" == "config-file = ?rei.conf" && $reloads == 5 ]] ||
  { print -u2 "a tab kept another palette's picture: $(<$bgd/shown.conf) reloads=$reloads"; exit 1 }
TTHEME_SPEC=; __tt_sync
[[ "$(<$bgd/shown.conf)" == "config-file = ?rei.conf" && $reloads == 5 ]] ||
  { print -u2 "a tab of unknown colors moved the picture: $(<$bgd/shown.conf) reloads=$reloads"; exit 1 }
[[ -z "$(__tt_precmd)" && "$(__tt_focus_on)" == $'\e[?1004h' && "$(__tt_preexec)" == $'\e[?1004l' ]] ||
  { print -u2 "the prompt did not turn focus reporting on and off"; exit 1 }
__tt_bg_saved kagami
(( reloads == 5 )) || { print -u2 "saving a picture Ghostty does not show reloaded it: reloads=$reloads"; exit 1 }
__tt_bg_saved kagami rei
(( reloads == 6 )) || { print -u2 "saving the picture Ghostty shows did not reload it: reloads=$reloads"; exit 1 }
bgsrc=(); __tt_bg_load homura; bgsize[homura]=60
__tt_bg_write homura && [[ ! -e $bgd/homura.conf ]] || { print -u2 "tuning a palette with no picture left a conf behind"; ls $bgd; exit 1 }
print -l "# image safebooru_2 2/3" "background-image = kagami.1a2b3c4d@fill-42.png" "background-image-fit = cover" "background-image-opacity = 0.2" "config-file = ?kagami.1a2b3c4d.tune.conf" "config-file = ?kagami.1a2b3c4d.off.conf" > $bgd/kagami.conf
: > $bgd/kagami.1a2b3c4d.png && : > $bgd/kagami.1a2b3c4d@fill-42.png
bgsrc=(); __tt_bg_load kagami; bgsize[kagami]=100 bgoff[kagami]=1
__tt_bg_write kagami || { print -u2 "__tt_bg_write (a picture's own tuning) failed"; exit 1 }
[[ -e $bgd/kagami.1a2b3c4d.tune.conf && -e $bgd/kagami.1a2b3c4d.off.conf && ! -e $bgd/kagami.tune.conf && $(grep -c config-file $bgd/kagami.conf) == 2 ]] ||
  { print -u2 "tuning did not go to the picture the conf names:"; ls $bgd; cat $bgd/kagami.conf; exit 1 }
bgcw=8 tune=kagami tpick=kagami tf=1 help=0 pick= conf=0 msgt=0 flt= color=0
out=; __tt_pv_foot 80
[[ $out == *"f find"* ]] || { print -u2 "an IMAGE EDIT bar with several images dropped the find key: $out"; exit 1 }
out=; __tt_pv_foot 200
[[ $out == *"image ×3"* ]] || { print -u2 "the IMAGE EDIT bar did not count the palette's pictures: $out"; exit 1 }
[[ $out == *"space show"* && $out != *"c colors"* ]] ||
  { print -u2 "the IMAGE EDIT bar of a hidden picture offered the colors key: $out"; exit 1 }
msg=${(l:200::x:)} msgt=100 out=; __tt_pv_foot 80
plain=${out//$'\e[K'/}
(( ${(m)#plain} <= 80 )) || { print -u2 "a long preview message overran the bar: ${(m)#plain} columns"; exit 1 }
print -l "# image safebooru_2 2/3" "# picture safebooru_1 kagami.aaaaaaaa kagami.aaaaaaaa@fill-40.png 0.2 akoiro safebooru 1 x" \
  "# picture safebooru_2 kagami.1a2b3c4d kagami.1a2b3c4d@fill-42.png 0.2 -" "# picture safebooru_3 kagami.cccccccc kagami.cccccccc@fill-40.png 0.3 -" \
  "background-image = kagami.1a2b3c4d@fill-42.png" "background-image-fit = cover" "background-image-opacity = 0.2" \
  "config-file = ?kagami.1a2b3c4d.tune.conf" "config-file = ?kagami.1a2b3c4d.off.conf" > $bgd/kagami.conf
: > $bgd/kagami.aaaaaaaa@fill-40.png && : > $bgd/kagami.cccccccc@fill-40.png
bgsrc=() bgedit=() bgview=() bgswap=() tune= tpick= msgt=0
__tt_pv_tune_open kagami
__tt_pv_bg_pick 1
[[ $tpick == kagami:safebooru_3 && $bgop[$tpick] == 0.3 && $bgtunef[$tpick] == kagami.cccccccc.tune.conf ]] ||
  { print -u2 "the picture strip did not move to the next picture: $tpick op=$bgop[$tpick] tune=$bgtunef[$tpick]"; exit 1 }
__tt_bg_load kagami:safebooru_1
[[ $bgby[kagami:safebooru_1] == akoiro && $bgfrom[kagami:safebooru_1] == "safebooru 1" && -z $bgby[$tpick] ]] ||
  { print -u2 "a held picture lost its artist or post: by=$bgby[kagami:safebooru_1] from=$bgfrom[kagami:safebooru_1] ($tpick by=$bgby[$tpick])"; exit 1 }
bgop[$tpick]=0.5
__tt_pv_untune
[[ -z $tune && $bgop[kagami:safebooru_3] == 0.3 && ${#bgswap} == 0 && ${#bgedit} == 0 ]] ||
  { print -u2 "esc in the tuning panel kept a picture or its tuning: op=$bgop[kagami:safebooru_3] swap=${(kv)bgswap} edit=${(k)bgedit}"; exit 1 }
__tt_pv_tune_open kagami
__tt_pv_bg_pick -1
bgop[$tpick]=0.4
__tt_pv_tune_keep
[[ $bgswap[kagami] == safebooru_1 && $bgview[kagami] == kagami:safebooru_1 && -n $bgedit[kagami:safebooru_1] && -z $tune ]] ||
  { print -u2 "enter in the tuning panel did not keep the picture it moved to: swap=${(kv)bgswap} view=${(kv)bgview} edit=${(k)bgedit}"; exit 1 }
print -l "# image safebooru_2 2/3" "# picture safebooru_2 kagami.1a2b3c4d kagami.1a2b3c4d@fill-42.png 0.2 -" \
  "# picture safebooru_3 kagami.cccccccc kagami.cccccccc@fill-40.png 0.1 -" "# colors safebooru_3 original" \
  "background-image = kagami.1a2b3c4d@fill-42.png" "background-image-fit = cover" "background-image-opacity = 0.2" \
  "config-file = ?kagami.1a2b3c4d.tune.conf" "config-file = ?kagami.1a2b3c4d.off.conf" > $bgd/kagami.conf
bgsrc=() bgcolors=(); __tt_bg_load kagami
REPLY=; __tt_bg_coloring kagami; first=$REPLY
REPLY=; __tt_bg_coloring kagami:safebooru_3
[[ $first == tone && $REPLY == original ]] ||
  { print -u2 "the conf's colors line did not reach its picture: active=$first other=$REPLY (${(kv)bgcolors})"; exit 1 }
bgcw=8 tune=kagami tpick=kagami:safebooru_3 tf=4 color=0 out= off=0 msgt=0 help=0 pick= conf=0 flt=
__tt_pv_bg_panel kagami:safebooru_3 4 1 60
[[ $out == *Colors* && $out == *"[original]"* && $out == *" tone "* ]] ||
  { print -u2 "the tuning panel did not show the picture's colors: $out"; exit 1 }
out=; __tt_pv_foot 200
[[ $out == *switch* && $out != *"= reset"* && $out == *"+ reset all"* ]] ||
  { print -u2 "the Colors row's hints kept the field reset: $out"; exit 1 }
print -l "# image safebooru_2 2/3" "# picture safebooru_2 kagami.1a2b3c4d kagami.1a2b3c4d@fill-42.png 0.2 -" \
  "# picture safebooru_3 kagami.cccccccc kagami.cccccccc@fill-40.png 0.1 -" \
  "background-image = kagami.1a2b3c4d@fill-42.png" "background-image-fit = cover" "background-image-opacity = 0.2" \
  "config-file = ?kagami.1a2b3c4d.tune.conf" "config-file = ?kagami.1a2b3c4d.off.conf" > $bgd/kagami.conf
bgsrc=(); __tt_bg_load kagami
REPLY=; __tt_bg_coloring kagami:safebooru_3
[[ $REPLY == tone && ${#bgcolors} == 0 ]] ||
  { print -u2 "a picture drawn in tone again kept its colors mark: $REPLY (${(kv)bgcolors})"; exit 1 }
tune= tpick= bgcw=0 out=
(
  __tt_pv_draw() { : }
  __tt_pv_bg_close() { : }
  __tt_cli() {
    print -r -- "$*" > $bgd/cli.log
    print -l "# image safebooru_2 1/1" "# picture safebooru_2 kagami.5e5e5e5e kagami.5e5e5e5e@fill-42.png 0.1 -" "# colors safebooru_2 original" \
      "background-image = kagami.5e5e5e5e@fill-42.png" "background-image-fit = cover" "background-image-opacity = 0.1" \
      "config-file = ?kagami.5e5e5e5e.tune.conf" "config-file = ?kagami.5e5e5e5e.off.conf" > $bgd/kagami.conf
    print "Background · kagami safebooru_2 in its own colors"
  }
  print -l "# image safebooru_2 1/1" "# picture safebooru_2 kagami.1a2b3c4d kagami.1a2b3c4d@fill-42.png 0.2 -" \
    "background-image = kagami.1a2b3c4d@fill-42.png" "background-image-fit = cover" "background-image-opacity = 0.2" \
    "config-file = ?kagami.1a2b3c4d.tune.conf" "config-file = ?kagami.1a2b3c4d.off.conf" > $bgd/kagami.conf
  bgsrc=() bgcolors=() bgedit=() bgview=() bgswap=() tsnaps=()
  bgcw=8 color=0 msgt=0 help=0 pick= conf=0 flt=
  __tt_pv_tune_open kagami
  bgoff[kagami]=1 tf=1 key=c
  rm -f $bgd/cli.log
  __tt_pv_tune > /dev/null
  [[ ! -e $bgd/cli.log ]] || { print -u2 "c drew a hidden picture again"; exit 1 }
  bgoff[kagami]=0 out=; __tt_pv_foot 200
  [[ $out == *"c colors"* ]] || { print -u2 "the IMAGE EDIT bar did not offer the colors key: $out"; exit 1 }
  __tt_pv_tune > /dev/null
  REPLY=; __tt_bg_coloring $tpick
  [[ "$(<$bgd/cli.log)" == "image kagami original safebooru_2" && $REPLY == original && $tf == 1 && $tune == kagami && $bgsrc[kagami] == *5e5e5e5e* ]] ||
    { print -u2 "c did not draw the picture again through the CLI, on the row it was pressed on: $(<$bgd/cli.log) coloring=$REPLY tf=$tf tune=$tune src=$bgsrc[kagami]"; exit 1 }
  rm -f $bgd/cli.log
  tf=4 key=right
  __tt_pv_tune > /dev/null
  [[ "$(<$bgd/cli.log)" == "image kagami tone safebooru_2" && $tf == 4 ]] ||
    { print -u2 "the Colors row did not switch back on an arrow key: $(<$bgd/cli.log) tf=$tf"; exit 1 }
) || exit 1
tune= tpick= bgcw=0 out=
(
  bgcw=8 color=0 split=1 sw=60 sc=40 se=100 pw=100 ph=24 help=1 out=
  __tt_pv_help
  [[ $out == *"c  tone  ↔  the picture's own colors"* ]] ||
    { print -u2 "the help did not name the colors key: $out"; exit 1 }
) || exit 1
proj=$XDG_CONFIG_HOME/proj
mkdir -p $proj/sub/deep $proj-sibling
ln -s $proj/sub $XDG_CONFIG_HOME/link
cd $proj
__tt_pin_save homura "$proj/**" "$TTHEME_PALETTE[miku]" > /dev/null || { print -u2 "__tt_pin_save failed"; exit 1 }
cd $proj/sub
__tt_pin_save kaito "$proj/sub" "$TTHEME_PALETTE[miku]" > /dev/null || { print -u2 "__tt_pin_save (exact) failed"; exit 1 }
TTHEME_PINS_RAW=; __tt_pins_load
[[ ${#TTHEME_PINS} == 2 && $TTHEME_PINS[$proj/**] == homura && $TTHEME_PINS[$proj/sub] == kaito ]] || { print -u2 "pins did not round-trip: ${(kv)TTHEME_PINS}"; cat $TTHEME_PINS_FILE; exit 1 }
REPLY=; __tt_dir_rule $proj/sub/deep && [[ $REPLY == "$proj/**" ]] || { print -u2 "subtree rule broke: $REPLY"; exit 1 }
REPLY=; __tt_dir_rule $proj/sub && [[ $REPLY == "$proj/sub" ]] || { print -u2 "nearest rule broke: $REPLY"; exit 1 }
REPLY=; __tt_dir_rule $XDG_CONFIG_HOME/link && [[ $REPLY == "$proj/sub" ]] || { print -u2 "symlink did not resolve to its pin: $REPLY"; exit 1 }
__tt_dir_rule $proj-sibling && { print -u2 "sibling matched a pin: $REPLY"; exit 1 }
TTHEME_SPEC=$TTHEME_PALETTE[miku] TTHEME_PIN= TTHEME_PIN_SPEC= TTHEME_BASE_SPEC=
cd $proj/sub/deep; __tt_dir_sync > /dev/null
[[ $TTHEME_SPEC == "$TTHEME_PALETTE[homura]" ]] || { print -u2 "cd into a pin did not paint homura"; exit 1 }
cd $proj/sub; __tt_dir_sync > /dev/null
[[ $TTHEME_SPEC == "$TTHEME_PALETTE[kaito]" ]] || { print -u2 "nested pin did not paint kaito"; exit 1 }
cd $XDG_CONFIG_HOME; __tt_dir_sync > /dev/null
[[ $TTHEME_SPEC == "$TTHEME_PALETTE[miku]" ]] || { print -u2 "leaving the pins did not restore miku"; exit 1 }
cd $proj/sub; __tt_dir_sync > /dev/null
TTHEME_SPEC=$TTHEME_PALETTE[rei]
cd $XDG_CONFIG_HOME; __tt_dir_sync > /dev/null
[[ $TTHEME_SPEC == "$TTHEME_PALETTE[rei]" ]] || { print -u2 "leaving overrode a hand-painted tab"; exit 1 }
TTHEME_SPEC= TTHEME_PIN= TTHEME_PIN_SPEC= TTHEME_BASE_SPEC=
resets=0 reset_fn=$functions[__tt_osc_reset]
__tt_osc_reset() { (( resets++ )) }
cd $proj/sub; __tt_dir_sync > /dev/null
cd $XDG_CONFIG_HOME; __tt_dir_sync > /dev/null
functions[__tt_osc_reset]=$reset_fn
[[ -z $TTHEME_SPEC && $resets == 1 ]] || { print -u2 "leaving a pin from a tab of unknown colors did not reset it: spec=[$TTHEME_SPEC] resets=$resets"; exit 1 }
cd $proj/sub
__tt_unpin > /dev/null || { print -u2 "__tt_unpin failed"; exit 1 }
TTHEME_PINS_RAW=; __tt_pins_load
[[ ${#TTHEME_PINS} == 1 && $TTHEME_PINS[$proj/**] == homura ]] || { print -u2 "unpin rewrote the wrong pin: ${(kv)TTHEME_PINS}"; exit 1 }
out=$(__tt_unpin 2>&1) && { print -u2 "unpin succeeded with nothing pinned"; exit 1 }
[[ $out == *covers* ]] || { print -u2 "unpin hint broke: $out"; exit 1 }
cd $proj-sibling
__tt_unpin 2>/dev/null && { print -u2 "unpin succeeded outside every pin"; exit 1 }
cd $proj; __tt_unpin > /dev/null || { print -u2 "__tt_unpin (last pin) failed"; exit 1 }
[[ ! -e $TTHEME_PINS_FILE ]] || { print -u2 "empty pins file left behind"; exit 1 }
print -l "~/proj-home/**  luka" "# comment" "" "$proj-sibling   rei" "$proj two/**  mio  " > $TTHEME_PINS_FILE
cd $proj-sibling; __tt_chpwd > /dev/null
[[ ${#TTHEME_PINS} == 3 && $TTHEME_PINS[$HOME/proj-home/**] == luka && ${TTHEME_PINS[$proj two/**]} == mio && $TTHEME_PIN == "$proj-sibling" ]] || { print -u2 "hand-written pins did not load on cd: ${(kv)TTHEME_PINS} pin=$TTHEME_PIN"; exit 1 }
REPLY=; __tt_tilde $HOME/proj-home
[[ $REPLY == "~/proj-home" ]] || { print -u2 "__tt_tilde kept the home prefix: $REPLY"; exit 1 }
cd $OLDPWD
(
  __tt_active() { return 0 }
  mkdir -p $XDG_CONFIG_HOME/reach
  cd $XDG_CONFIG_HOME/reach
  rm -f $TTHEME_PINS_FILE
  TTHEME_PINS_RAW=; __tt_pins_load
  TTHEME_SPEC=$TTHEME_PALETTE[miku] TTHEME_PIN= TTHEME_PIN_SPEC= TTHEME_BASE_SPEC=
  __tt_fresh > /dev/null
  [[ $TTHEME_SPEC == "$TTHEME_PALETTE[miku]" ]] || { print -u2 "a prompt repainted a tab with no pin changed"; exit 1 }
  print -r -- "$XDG_CONFIG_HOME/reach  homura" > $TTHEME_PINS_FILE
  __tt_fresh > /dev/null
  [[ $TTHEME_SPEC == "$TTHEME_PALETTE[homura]" && $TTHEME_PIN == "$XDG_CONFIG_HOME/reach" ]] ||
    { print -u2 "a pin set in another tab did not reach a tab already in its directory at its next prompt: pin=$TTHEME_PIN"; exit 1 }
  print -r -- "$XDG_CONFIG_HOME/reach  kaito" > $TTHEME_PINS_FILE
  touch -t 203101010000 $TTHEME_PINS_FILE
  __tt_fresh > /dev/null
  [[ $TTHEME_SPEC == "$TTHEME_PALETTE[kaito]" && $TTHEME_BASE_SPEC == "$TTHEME_PALETTE[miku]" ]] ||
    { print -u2 "a pin moved to another palette in another tab did not repaint a tab under it, or lost the palette it wore before"; exit 1 }
  rm -f $TTHEME_PINS_FILE
  __tt_fresh > /dev/null
  [[ $TTHEME_SPEC == "$TTHEME_PALETTE[miku]" && -z $TTHEME_PIN ]] ||
    { print -u2 "a pin dropped in another tab did not give a tab under it its palette back: pin=$TTHEME_PIN"; exit 1 }
) || exit 1
(
  HOME=$XDG_CONFIG_HOME/home
  mkdir -p $HOME/work/api/v2 $HOME/work/site/x $HOME/notes
  print -r -- "//**  rei" > $TTHEME_PINS_FILE
  TTHEME_PINS_RAW=; __tt_pins_load
  REPLY=; __tt_dir_rule $HOME/work && [[ $REPLY == "//**" ]] || { print -u2 "a pin on / and below skipped what is below it: $REPLY"; exit 1 }
  print -l "~/work/**  homura" "~/work/site  kaito" "~/work/site/**  miku" "~/notes/**  nosuchpalette" "/nonexistent-ttheme/place/**  rei" "~  mio" > $TTHEME_PINS_FILE
  TTHEME_PINS_RAW=; __tt_pins_load 2>/dev/null
  REPLY=; __tt_dir_rule $HOME && [[ $REPLY == "$HOME" ]] || { print -u2 "a pin on ~ alone did not cover the home directory: $REPLY"; exit 1 }
  REPLY=; __tt_dir_rule $HOME/work/site && [[ $REPLY == "$HOME/work/site" ]] || { print -u2 "a directory's own pin lost to its pin on everything below: $REPLY"; exit 1 }
  REPLY=; __tt_dir_rule $HOME/work/site/x && [[ $REPLY == "$HOME/work/site/**" ]] || { print -u2 "a pin on everything below skipped a subdirectory: $REPLY"; exit 1 }
  cd $HOME/work/api/v2
  color=0
  out=$(COLUMNS=200 __tt_map_tree)
  want=(
    "~                          mio            this directory"
    "├─ notes                   nosuchpalette  and below · not installed"
    "└─ work                    homura         and below"
    "   ├─ api/v2 ← here"
    "   └─ site                 kaito          this directory · miku below"
    "/nonexistent-ttheme/place  rei            and below · no such directory"
    ""
    "Here · homura pinned to ~/work and below"
    "ttheme pin picks one here · ttheme unpin drops one · $TTHEME_PINS_FILE"
  )
  [[ $out == ${(F)want} ]] || { print -u2 "the pins map drew:"; print -ru2 -- $out; exit 1 }
  color=1
  out=$(__tt_map_tree)
  __tt_map_tip homura
  [[ ${${(f)out}[4]} == "   $REPLY├─ "$'\e[0m\e[2mapi/v2\e[0m '"$REPLY"$'\e[1m← here\e[0m' ]] ||
    { print -u2 "the pins map did not draw homura's branches, or the here mark, in homura's color: ${(q+)${(f)out}[4]}"; exit 1 }
  [[ ${${(f)out}[2]} == $'\e[2m├─ \e[0m\e[1mnotes\e[0m'* ]] || { print -u2 "a branch outside every pin was not dim: ${(q+)${(f)out}[2]}"; exit 1 }
  cd $HOME/work/site
  [[ ${${(f)"$(color=0 __tt_map_tree)"}[-2]} == "Here · kaito pinned to this directory" ]] ||
    { print -u2 "the pins map named the wrong pin here: ${${(f)"$(color=0 __tt_map_tree)"}[-2]}"; exit 1 }
  out=$(__tt_pins_map)
  want=("/nonexistent-ttheme/place/**"$'\t'rei "$HOME"$'\t'mio "~/notes/**"$'\t'nosuchpalette "~/work/**"$'\t'homura "~/work/site"$'\t'kaito "~/work/site/**"$'\t'miku)
  [[ $out == ${(F)want} ]] || { print -u2 "piped, pins did not print path and palette per line:"; print -ru2 -- $out; exit 1 }
  rm -f $TTHEME_PINS_FILE
  TTHEME_PINS_RAW=x
  [[ -z $(__tt_pins_map) ]] || { print -u2 "piped, pins printed something with nothing pinned"; exit 1 }
) || exit 1
(
  HOME=$XDG_CONFIG_HOME/scope
  mkdir -p $HOME/code/acme/.git $HOME/code/acme/src/deep $HOME/code/acme/docs/api $HOME/code/acme/web $HOME/solo
  __tt_apply() { : }
  __tt_osc_reset() { : }
  typeset -a plabel pkeys reach mine under lab drops block
  typeset pkdef="" rsub="" pick="" cover=""
  typeset -i pk color=0
  fresh() {
    print -l "~/code/**  konata" "~/code/acme/docs/**  rei" "~/code/acme/docs/api  miku" "~/code/acme/web  kita" > $TTHEME_PINS_FILE
    TTHEME_PINS_RAW=; __tt_pins_load
  }
  fresh
  __tt_pin_scopes $HOME/code/acme/src/deep
  [[ ${(j:|:)plabel} == " This directory | And below | Repository " && $pkdef == 2 &&
    ${(j:|:)pkeys} == "$HOME/code/acme/src/deep|$HOME/code/acme/src/deep/**|$HOME/code/acme/**" ]] ||
    { print -u2 "a directory inside a repository was not offered the repository: ${(j:|:)plabel} ${(j:|:)pkeys} $pkdef"; exit 1 }
  __tt_pin_scopes $HOME/code/acme
  (( ${#plabel} == 2 )) || { print -u2 "a repository's root was offered itself as its repository"; exit 1 }
  __tt_pin_scopes $HOME/code/acme/web
  [[ $pkdef == 1 ]] || { print -u2 "a directory pinned alone did not start on that scope"; exit 1 }
  mkdir $HOME/.git
  __tt_pin_scopes $HOME/solo
  (( ${#plabel} == 2 )) || { print -u2 "a home directory under git was offered as a repository"; exit 1 }
  rmdir $HOME/.git
  cd $HOME/code/acme/src/deep
  __tt_pin_scopes $PWD
  pick=homura pk=3
  __tt_pv_reach 60 12
  want=(
    "~/code        konata  and below"
    "└─ acme       homura  and below  new"
    "   ├─ docs    rei     and below"
    "   │  └─ api  miku    this directory"
    "   ├─ src/deep ← here"
    "   └─ web     kita    this directory"
    ""
    "Then here · homura pinned to ~/code/acme and below"
  )
  [[ ${(F)reach} == ${(F)want} && $rsub == "→ ~/code/acme · and below" ]] ||
    { print -u2 "pinning the repository did not show what it reaches ($rsub):"; print -rlu2 -- $reach; exit 1 }
  __tt_pv_reach 30 12
  [[ ${reach[2]} == "└─ acme       homura  new" && ${reach[-1]} == "  pinned to ~/code/acme and b…" ]] ||
    { print -u2 "a narrow reach panel did not give up the notes before the tree, or wrap what paints here:"; print -rlu2 -- $reach; exit 1 }
  __tt_clip $'\e[1mabcdef\e[0m' 4 && { print -u2 "a clip that cut said it fit"; exit 1 }
  [[ $REPLY == $'\e[1mabc…\e[0m' ]] || { print -u2 "a clip lost its colors or its width: ${(q+)REPLY}"; exit 1 }
  __tt_clip ab 2 && [[ $REPLY == ab ]] || { print -u2 "a clip cut what fits"; exit 1 }
  cd $HOME/code/acme/docs
  __tt_unpin_options
  [[ ${(j:|:)lab} == " This directory | And below | ~/code " && $drops[1] == "$HOME/code/acme/docs/**" &&
    $drops[2] == "$HOME/code/acme/docs/**"$'\n'"$HOME/code/acme/docs/api" && $drops[3] == "$HOME/code/**" ]] ||
    { print -u2 "unpin offered the wrong scopes: ${(j:|:)lab}"; print -rlu2 -- $drops; exit 1 }
  COLUMNS=100 LINES=30 __tt_unpin_block 2
  want=(
    "[UNPIN]  This directory  [And below]  ~/code    ←→ choose · enter unpin · esc keep"
    "~/code             konata  and below"
    "└─ acme"
    "   ├─ docs ← here  rei     and below  ✕ unpin"
    "   │  └─ api       miku    this directory  ✕ unpin"
    "   └─ web          kita    this directory"
    "Then here · konata pinned to ~/code and below"
  )
  [[ ${(F)block} == ${(F)want} ]] || { print -u2 "unpin's and-below choice did not mark what goes:"; print -rlu2 -- $block; exit 1 }
  COLUMNS=100 LINES=30 __tt_unpin_block 3
  [[ ${block[2]} == *"✕ unpin" && ${block[4]} != *"✕"* && ${block[-1]} == "Then here · rei pinned to this directory and below" ]] ||
    { print -u2 "unpin's covering choice marked the wrong pin:"; print -rlu2 -- $block; exit 1 }
  out=$(ttheme unpin < /dev/null 2>&1) || { print -u2 "unpin without a terminal did not drop this directory's own pin: $out"; exit 1 }
  TTHEME_PINS_RAW=; __tt_pins_load
  [[ -z ${TTHEME_PINS[$HOME/code/acme/docs/**]} && -n ${TTHEME_PINS[$HOME/code/acme/docs/api]} && $out == *"Unpinned · rei on ~/code/acme/docs · and below"* ]] ||
    { print -u2 "unpin without a terminal dropped the wrong pins: $out"; exit 1 }
  cd $HOME/code/acme/src/deep
  out=$(ttheme unpin < /dev/null 2>&1) && { print -u2 "unpin dropped a pin above without being asked"; exit 1 }
  [[ $out == *"ttheme unpin ~/code"* ]] || { print -u2 "unpin under someone else's pin did not say how to drop it: $out"; exit 1 }
  out=$(ttheme unpin '~/code/acme/web' 2>&1) || { print -u2 "unpin with a path did not drop its pin: $out"; exit 1 }
  TTHEME_PINS_RAW=; __tt_pins_load
  [[ -z ${TTHEME_PINS[$HOME/code/acme/web]} && $out == *"Unpinned · kita on ~/code/acme/web · this directory"* ]] ||
    { print -u2 "unpin with a path dropped the wrong pin: $out"; exit 1 }
  out=$(ttheme unpin $HOME/code/acme 2>&1) && { print -u2 "unpin with a path took one without a pin"; exit 1 }
  [[ $out == *"nothing pinned to ~/code/acme — the pin on ~/code and below covers it"* ]] || { print -u2 "unpin's hint for a path under a pin broke: $out"; exit 1 }
  ttheme pin $HOME/nowhere 2>/dev/null && { print -u2 "ttheme pin took a directory that does not exist"; exit 1 }
  fresh
  TTHEME_SPEC=$TTHEME_PALETTE[mio] TTHEME_PIN= TTHEME_PIN_SPEC= TTHEME_BASE_SPEC=
  TTHEME_SPEC=$TTHEME_PALETTE[homura]
  __tt_pin_save homura "$HOME/code/acme/**" "$TTHEME_PALETTE[mio]" > /dev/null
  [[ $TTHEME_SPEC == "$TTHEME_PALETTE[homura]" && $TTHEME_PIN == "$HOME/code/acme/**" && $TTHEME_BASE_SPEC == "$TTHEME_PALETTE[mio]" ]] ||
    { print -u2 "a repository pin did not take the tab inside it: pin=$TTHEME_PIN"; exit 1 }
  cd $HOME/code/acme/docs
  __tt_dir_sync
  TTHEME_SPEC=$TTHEME_PALETTE[kaito]
  out=$(__tt_pin_save kaito "$HOME/code/acme/**" "$TTHEME_PALETTE[rei]"; print -r -- "|$TTHEME_PIN|${TTHEME_SPEC%% *}")
  [[ $out == *"Here · rei pinned to this directory and below"*"|$HOME/code/acme/docs/**|${TTHEME_PALETTE[rei]%% *}" ]] ||
    { print -u2 "a tab under its own pin took a pin above it: $out"; exit 1 }
) || exit 1
print -r -- 'typeset -g TTHEME_STARTUP=rei' >> $TTHEME_HOME/palettes.zsh
touch -t 203001010000 $TTHEME_HOME/palettes.zsh
__tt_fresh
[[ $TTHEME_STARTUP == rei && -n ${TTHEME_PALETTE[miku]} ]] || { print -u2 "a rewritten palettes.zsh did not reload: startup=$TTHEME_STARTUP"; exit 1 }
adapter=$TTHEME_ADAPTER
TTHEME_ITERM_SHOWN=default TTHEME_STARTUP=miku
source $XDG_CONFIG_HOME/ttheme/adapters/iterm2.zsh
REPLY=; __tt_bg_shown && [[ $REPLY == miku ]] || { print -u2 "a tab on ttheme · default did not read the startup picture: $REPLY"; exit 1 }
TTHEME_STARTUP=rei
REPLY=; __tt_bg_shown && [[ $REPLY == rei ]] || { print -u2 "a tab on ttheme · default did not follow a new default: $REPLY"; exit 1 }
forks_of() {
  local log=$XDG_CONFIG_HOME/xtrace.log
  local -a pids
  ( zmodload zsh/system; setopt prompt_subst; PS4='+${sysparams[pid]}> '; setopt xtrace; "$@" ) 2>$log >/dev/null
  pids=(${(u)${(f)"$(grep -oE '\+[0-9]+> ' $log | tr -dc '0-9\n')"}})
  REPLY=$(( ${#pids} - 1 ))
}
for pair in 'gojo Z29qbw==' 'owner@market/slug b3duZXJAbWFya2V0L3NsdWc=' '日本/é 5pel5pysL8Op' 'ab YWI='; do
  REPLY=; __tt_b64s ${pair% *}
  [[ $REPLY == ${pair##* } ]] || { print -u2 "__tt_b64s broke on ${pair% *}: $REPLY"; exit 1 }
done
typeset -A bgsent=()
forks_of __tt_bg_send $bgd/kagami.png
(( REPLY == 0 )) || { print -u2 "sending a picture to preview forks again ($REPLY processes)"; exit 1 }
(
  typeset -A bgsent=() bgcost=()
  typeset -a bgorder=()
  integer bgnext=0 bgbytes=0
  for i in {1..10}; do print -rn -- $'\x89PNG\r\n\x1a\n\0\0\0\rIHDR\0\0\x0f\xa0\0\0\x07\xd0\x08\x06' > $bgd/p$i.png; done
  for i in {1..10}; do __tt_bg_send $bgd/p$i.png; done > $bgd/sent.out
  out=$(<$bgd/sent.out)
  [[ ${#bgsent} == 4 && bgbytes -eq 128000000 && -z $bgsent[$bgd/p6.png] && $bgsent[$bgd/p10.png] == 12 && ${#${(M)${(ps:\e_G:)out}:#a=d,d=I,*}} == 6 ]] ||
    { print -u2 "preview holds more than 128 MB of pictures in the terminal, or frees the wrong ones: $bgbytes ${(kv)bgsent}"; exit 1 }
  __tt_bg_send $bgd/p7.png > $bgd/sent.out
  [[ $REPLY == 9 && ! -s $bgd/sent.out ]] || { print -u2 "a picture preview still holds was sent again"; exit 1 }
  __tt_bg_send $bgd/p1.png > /dev/null
  [[ -z $bgsent[$bgd/p8.png] && $bgsent[$bgd/p7.png] == 9 && $bgsent[$bgd/p1.png] == 13 ]] ||
    { print -u2 "a picture shown again was not kept over older ones: ${(kv)bgsent}"; exit 1 }
  [[ ${functions[__tt_pv_bg_show]} != *'d=i,i=%d,q'* ]] ||
    { print -u2 "preview deletes a picture by image id alone — iTerm2 frees its data then, and the picture never comes back"; exit 1 }
) || exit 1
print -rn -- $'\x89PNG\r\n\x1a\n\0\0\0\rIHDR\0\0\x07\x58\0\0\x03\xf0\x08\x06' > $bgd/dim.png
bgdim=()
forks_of __tt_bg_dim $bgd/dim.png
(( REPLY == 0 )) || { print -u2 "reading a picture's size forks again ($REPLY processes) — preview's first hover of every picture pays it"; exit 1 }
__tt_bg_dim $bgd/dim.png && [[ $bgdim[$bgd/dim.png] == "1880 1008" ]] || { print -u2 "__tt_bg_dim misread a PNG header: ${bgdim[$bgd/dim.png]}"; exit 1 }
__tt_bg_dim $bgd/kagami@fill-42.png && { print -u2 "__tt_bg_dim took an empty file for a picture"; exit 1 }
(
  source $XDG_CONFIG_HOME/ttheme/adapters/kitty.zsh
  forks_of __tt_apply "$TTHEME_PALETTE[miku]"
  (( REPLY == 0 )) || { print -u2 "a kitty paint forks again ($REPLY processes) — every preview hover pays it"; exit 1 }
  source $XDG_CONFIG_HOME/ttheme/adapters/wezterm.zsh
  forks_of __tt_shown miku force
  (( REPLY == 0 )) || { print -u2 "a WezTerm picture change forks again ($REPLY processes)"; exit 1 }
) || exit 1
for pictured in ghostty iterm2 kitty; do
  (
    source $XDG_CONFIG_HOME/ttheme/adapters/$pictured.zsh
    print -r -- "config-file = ?miku.conf" > $bgd/shown.conf
    TTHEME_ITERM_SHOWN=miku
    forks_of __tt_shown kagami force
    (( REPLY == 0 )) || { print -u2 "a picture change in $pictured forks again ($REPLY processes) — every focus-in between two pictures pays it"; exit 1 }
  ) || exit 1
done
(
  source $XDG_CONFIG_HOME/ttheme/adapters/wezterm.zsh
  typeset -A bgsrc=() bgfill=() bgfocus=() bgsize=() bgpos=() bgop=() bgdef=() bgoff=() bgbase=() bgload=() bgshot=() bgshotkey=() bgdim=() bgtunef=() bgofff=() bgimages=()
  print -rn -- $'\x89PNG\r\n\x1a\n\0\0\0\rIHDR\0\0\x07\x58\0\0\x03\xf0\x08\x06' > $bgd/homura@fill-50.png
  print -l "background-image = homura@fill-50.png" "background-image-fit = cover" "background-image-opacity = 0.3" > $bgd/homura.conf
  bgcw=14 bgch=32 pw=80 ph=24 bginc="" bgname="" TTHEME_WEZTERM_VIEW=""
  __tt_pv_bg_show homura > $bgd/view.out
  REPLY=; __tt_bg_frame 1880 1008 1120 768 100 5 cover
  want="${${=TTHEME_PALETTE[homura]}[1]}|$bgd/homura@fill-50.png|0.3|1120|768|${REPLY// /|}|5"
  [[ $(<$bgd/view.out) == $'\e]1337;SetUserVar=ttheme_view='*$'\a' && "$(print -rn -- ${${$(<$bgd/view.out)#*=ttheme_view=}%$'\a'} | b64d)" == "$want" ]] ||
    { print -u2 "a WezTerm preview hover sent the wrong view: ${(V)$(<$bgd/view.out)}, wanted $want"; exit 1 }
  __tt_pv_bg_show homura > $bgd/view.out
  [[ ! -s $bgd/view.out ]] || { print -u2 "a WezTerm preview hover sent an unchanged view again"; exit 1 }
  TTHEME_WEZTERM_VIEW=""
  forks_of __tt_pv_bg_show homura
  (( REPLY == 0 )) || { print -u2 "a WezTerm preview hover forks again ($REPLY processes)"; exit 1 }
  __tt_pv_bg_show homura > /dev/null
  __tt_pv_bg_close > $bgd/view.out
  [[ $(<$bgd/view.out) == *$'\e]1337;SetUserVar=ttheme_view=\a' ]] || { print -u2 "closing preview in WezTerm left its view up"; exit 1 }
) || exit 1
(
  TTHEME_TERMINALS=(konsole) TTHEME_KONSOLE_BASE='ColorScheme=Breeze;UseCustomCursorColor=false' TTHEME_STARTUP=miku TTHEME_TMUX=0
  source $XDG_CONFIG_HOME/ttheme/adapters/konsole.zsh
  cursor=${${=TTHEME_PALETTE[kaito]}[3]}
  [[ "$(__tt_apply "$TTHEME_PALETTE[kaito]")" == $'\e]50;ColorScheme=ttheme-kaito;UseCustomCursorColor=true;customCursorColor='$cursor$'\a' ]] ||
    { print -u2 "a Konsole paint did not switch the tab to the palette's color scheme: ${(V)$(__tt_apply "$TTHEME_PALETTE[kaito]")}"; exit 1 }
  forks_of __tt_apply "$TTHEME_PALETTE[kaito]"
  (( REPLY == 0 )) || { print -u2 "a Konsole paint forks again ($REPLY processes) — every preview hover pays it"; exit 1 }
  [[ "$(__tt_apply "#123456 ${TTHEME_PALETTE[kaito]#* }")" == $'\e]11;#123456\e\\\e]10;'${${=TTHEME_PALETTE[kaito]}[2]}$'\e\\' ]] ||
    { print -u2 "Konsole painted colors no scheme holds with more than the background and foreground it can draw"; exit 1 }
  [[ "$(__tt_osc_reset)" == $'\e]50;ColorScheme=ttheme-miku;UseCustomCursorColor=true;customCursorColor='${${=TTHEME_PALETTE[miku]}[3]}$'\a' ]] ||
    { print -u2 "a Konsole reset did not go back to the default palette's scheme, which new tabs open with"; exit 1 }
  TTHEME_STARTUP=
  [[ "$(__tt_osc_reset)" == $'\e]50;ColorScheme=Breeze;UseCustomCursorColor=false\a' ]] ||
    { print -u2 "a Konsole reset while ttheme is off did not go back to the user's own scheme"; exit 1 }
  __tt_keepable || { print -u2 "a wired Konsole did not offer to keep a palette as the default"; exit 1 }
  TTHEME_TERMINALS=()
  ! __tt_paints || { print -u2 "an unwired Konsole, which has no ttheme color schemes, claimed the layer can paint it"; exit 1 }
  out=$(ttheme use kaito 2>&1) && { print -u2 "ttheme use ran in an unwired Konsole"; exit 1 }
  [[ $out == *"wire it with"* ]] || { print -u2 "an unwired Konsole refused ttheme use without saying how to wire it: $out"; exit 1 }
  EDITOR=true ttheme config > /dev/null || { print -u2 "an unwired Konsole refused a verb that paints no tab"; exit 1 }
) || exit 1
(
  source $XDG_CONFIG_HOME/ttheme/adapters/warp.zsh
  TTHEME_TERMINALS=()
  out=$(ttheme use kaito 2>&1) && { print -u2 "ttheme use ran in a Warp ttheme does not wire"; exit 1 }
  [[ $out == *"wire it with"* ]] || { print -u2 "an unwired Warp refused ttheme use without saying how to wire it: $out"; exit 1 }
  ttheme 2>/dev/null && { print -u2 "the palette menu ran in an unwired Warp"; exit 1 }
  TTHEME_TERMINALS=(warp) TTHEME_WARP_SETTINGS=$XDG_CONFIG_HOME/nowarp/settings.toml
  ! __tt_paints || { print -u2 "the layer claimed it can paint a Warp that has no settings.toml"; exit 1 }
) || exit 1
(
  source $XDG_CONFIG_HOME/ttheme/adapters/warp.zsh
  mkdir -p $XDG_CONFIG_HOME/warp $XDG_CONFIG_HOME/dotwarp $XDG_CONFIG_HOME/warpthemes
  TTHEME_WARP_SETTINGS=$XDG_CONFIG_HOME/warp/settings.toml TTHEME_WARP_THEMES=$XDG_CONFIG_HOME/warpthemes TTHEME_TERMINALS=(warp)
  TTHEME_STARTUP=miku TTHEME_SPEC=$TTHEME_PALETTE[miku] TTHEME_WARP_FOLLOWS=0 WARP_TERMINAL_SESSION_UUID=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
  unset TTHEME_PAINTED
  for name in miku kaito homura; do print -r -- "name: \"$name\"" > $TTHEME_WARP_THEMES/ttheme-$name.yaml; done
  touch -t 202001010000 $TTHEME_WARP_THEMES/ttheme-*.yaml
  tab=$TTHEME_WARP_TABS/$WARP_TERMINAL_SESSION_UUID
  ours() { __tt_warp_value $1; print -r -- "theme = $REPLY" }
  mine=('[appearance]' 'font = 1' '' '[appearance.themes]' 'system_theme = false' 'theme = "dark_city"' '' '[other]' 'x = 2')
  print -rl -- "${mine[@]}" > $XDG_CONFIG_HOME/dotwarp/settings.toml
  ln -s $XDG_CONFIG_HOME/dotwarp/settings.toml $TTHEME_WARP_SETTINGS
  __tt_paints && __tt_keepable || { print -u2 "a wired Warp with a settings.toml refused to paint, or to keep a palette as the default"; exit 1 }
  __tt_prompted
  [[ "$(<$tab)" == "$$ miku - -" && "$(<$TTHEME_WARP_SETTINGS)" == *"$(ours miku)"* ]] ||
    { print -u2 "a Warp tab that took no palette did not follow the default: $(<$tab)"; exit 1 }
  ttheme use kaito > /dev/null || { print -u2 "ttheme use failed in a wired Warp"; exit 1 }
  [[ -L $TTHEME_WARP_SETTINGS && "$(<$TTHEME_WARP_SETTINGS)" == "$(print -rl -- "${(@)mine[1,5]}" "$(ours kaito)" "${(@)mine[7,-1]}")" ]] ||
    { print -u2 "ttheme use in Warp did not put the palette in settings.toml alone, or replaced the link:"; cat $TTHEME_WARP_SETTINGS; exit 1 }
  [[ "$(<$TTHEME_HOME/warp.base)" == '"dark_city"' && "$(<$TTHEME_WARP_SETTINGS.ttheme.bak)" == "$(print -rl -- "${mine[@]}")" && ${(t)TTHEME_PAINTED} == *export* ]] ||
    { print -u2 "a Warp paint did not keep the user's theme where ttheme off finds it, or did not mark the tab painted"; exit 1 }
  [[ $TTHEME_SPEC == "$TTHEME_PALETTE[kaito]" && "$(<$tab)" == "$$ miku kaito -" ]] ||
    { print -u2 "a Warp tab did not record the palette it wears where tab switches read it: $(<$tab)"; exit 1 }
  forks_of __tt_apply "$TTHEME_PALETTE[homura]"
  (( REPLY == 0 )) || { print -u2 "a Warp paint forks again ($REPLY processes) — every preview hover pays it"; exit 1 }
  forks_of __tt_prompted
  (( REPLY == 0 )) || { print -u2 "a Warp prompt forks again ($REPLY processes)"; exit 1 }
  __tt_osc_reset
  [[ "$(<$TTHEME_WARP_SETTINGS)" == *"$(ours miku)"* && "$(<$tab)" == "$$ miku - -" && -z ${TTHEME_PAINTED+x} ]] ||
    { print -u2 "a Warp reset did not put on the default palette new tabs open with: $(<$tab)"; exit 1 }
  TTHEME_STARTUP=
  __tt_osc_reset
  [[ "$(<$TTHEME_WARP_SETTINGS)" == "$(print -rl -- "${mine[@]}")" && ! -e $TTHEME_HOME/warp.base ]] ||
    { print -u2 "a Warp reset while ttheme is off did not give the user's theme back as it was:"; cat $TTHEME_WARP_SETTINGS; exit 1 }
  __tt_hear && { print -u2 "a new Warp tab heard a palette while ttheme is off: $REPLY"; exit 1 }
  TTHEME_STARTUP=miku
  REPLY=; __tt_hear
  [[ $REPLY == ${TTHEME_PALETTE[miku]%% *} ]] || { print -u2 "a new Warp tab did not take the default palette for the one it wears: $REPLY"; exit 1 }
  __tt_apply "$TTHEME_PALETTE[homura]"
  REPLY=; __tt_hear
  [[ $REPLY == ${TTHEME_PALETTE[homura]%% *} ]] || { print -u2 "a shell started in a painted Warp tab did not take the palette Warp wears: $REPLY"; exit 1 }
  TTHEME_WARP_FOLLOWS=1 TTHEME_SPEC=$TTHEME_PALETTE[kaito]
  __tt_shown kaito
  [[ "$(<$TTHEME_WARP_SETTINGS)" == *"$(ours homura)"* && "$(<$tab)" == "$$ miku kaito -" ]] ||
    { print -u2 "a Warp prompt moved the app-wide theme itself where tab switches are followed, or did not record its palette"; exit 1 }
  __tt_shown kaito force
  [[ "$(<$TTHEME_WARP_SETTINGS)" == *"$(ours kaito)"* ]] || { print -u2 "a Warp tab that took a palette did not put it on"; exit 1 }
  print -rl -- "${(@)mine[1,5]}" 'theme = "dark_city"' "${(@)mine[7,-1]}" >| $XDG_CONFIG_HOME/dotwarp/settings.toml
  __tt_reloaded
  [[ "$(<$TTHEME_WARP_SETTINGS)" == *"$(ours kaito)"* ]] || { print -u2 "a Warp tab did not put its palette back over the theme a command's sync wrote"; exit 1 }
  TTHEME_WARP_FOLLOWS=0
  : >| $TTHEME_WARP_TABS/.follow
  print -r -- bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb >| $TTHEME_WARP_TABS/.active
  zsh -c 'zmodload zsh/system; zsystem flock -f fd $1 && : >| $2 && sleep 5' zsh $TTHEME_WARP_TABS/.follow $XDG_CONFIG_HOME/held >/dev/null 2>&1 &
  holder=$!
  for (( i = 0; i < 100; i++ )); do [[ -e $XDG_CONFIG_HOME/held ]] && break; sleep 0.05; done
  __tt_apply "$TTHEME_PALETTE[miku]"
  [[ "$(<$TTHEME_WARP_SETTINGS)" == *"$(ours kaito)"* && "$(<$tab)" == "$$ miku miku -" ]] ||
    { print -u2 "a Warp tab behind another one moved the app-wide theme, or did not record its palette"; exit 1 }
  kill $holder 2>/dev/null
  wait $holder 2>/dev/null
  __tt_apply "$TTHEME_PALETTE[miku]"
  [[ "$(<$TTHEME_WARP_SETTINGS)" == *"$(ours miku)"* ]] || { print -u2 "a Warp tab stayed off the theme after the follower that put another tab in front was gone"; exit 1 }
  rm -f $TTHEME_WARP_TABS/.active $TTHEME_WARP_TABS/.follow $XDG_CONFIG_HOME/held
  print -r -- 'name: "kaito"' >| $TTHEME_WARP_THEMES/ttheme-kaito.0123abcd.yaml
  at=$EPOCHREALTIME
  __tt_apply "$TTHEME_PALETTE[kaito]"
  (( EPOCHREALTIME - at >= 0.25 )) && [[ "$(<$TTHEME_WARP_SETTINGS)" == *'path = "ttheme-kaito.0123abcd.yaml"'* ]] ||
    { print -u2 "Warp was pointed at a theme file too new for it to know yet"; exit 1 }
  rm -f $TTHEME_WARP_THEMES/ttheme-kaito.0123abcd.yaml $TTHEME_HOME/warp.base
  print -rl -- '[general]' 'x = 1' >| $XDG_CONFIG_HOME/dotwarp/settings.toml
  __tt_apply "$TTHEME_PALETTE[miku]"
  [[ "$(<$TTHEME_WARP_SETTINGS)" == "$(print -rl -- '[general]' 'x = 1' '' '[appearance.themes]' "$(ours miku)")" ]] ||
    { print -u2 "a Warp paint did not add the theme table:"; cat $TTHEME_WARP_SETTINGS; exit 1 }
  TTHEME_STARTUP=
  __tt_osc_reset
  [[ "$(<$TTHEME_WARP_SETTINGS)" == *$'\ntheme = "dark"' && ! -e $TTHEME_HOME/warp.base ]] ||
    { print -u2 "a Warp reset while ttheme is off, over no theme of the user's, did not leave Warp's default"; cat $TTHEME_WARP_SETTINGS; exit 1 }
  __tt_apply "custom" && { print -u2 "Warp wore a spec that is no palette"; exit 1 }
  : > $TTHEME_WARP_THEMES/ttheme-miku.0123abcd.yaml
  touch -t 202001010000 $TTHEME_WARP_THEMES/ttheme-miku.0123abcd.yaml
  : > $TTHEME_WARP_THEMES/ttheme-miku.89abcdef.yaml
  REPLY=; __tt_warp_value miku
  [[ $REPLY == '{ custom = { name = "miku", path = "ttheme-miku.89abcdef.yaml" } }' ]] ||
    { print -u2 "a Warp palette with a picture did not wear its newest pictured theme: $REPLY"; exit 1 }
  rm -rf $TTHEME_WARP_TABS
) || exit 1
(
  source $XDG_CONFIG_HOME/ttheme/adapters/warp.zsh
  (( $+commands[sqlite3] )) || { print -u2 "sqlite3 is missing — Warp's tab switches are read with it"; exit 1 }
  mkdir -p $XDG_CONFIG_HOME/fwarp $XDG_CONFIG_HOME/fwarpthemes
  TTHEME_WARP_SETTINGS=$XDG_CONFIG_HOME/fwarp/settings.toml TTHEME_WARP_THEMES=$XDG_CONFIG_HOME/fwarpthemes TTHEME_TERMINALS=(warp)
  TTHEME_STARTUP=miku TTHEME_WARP_DB=$XDG_CONFIG_HOME/fwarp/warp.sqlite
  print -rl -- '[appearance.themes]' 'theme = "Dracula"' > $TTHEME_WARP_SETTINGS
  for name in miku kaito homura; do print -r -- "name: \"$name\"" > $TTHEME_WARP_THEMES/ttheme-$name.yaml; done
  touch -t 202001010000 $TTHEME_WARP_THEMES/ttheme-*.yaml
  sqlite3 $TTHEME_WARP_DB "
    create table app (id integer primary key, active_window_id integer references windows(id));
    create table windows (id integer primary key not null, active_tab_index integer not null);
    create table tabs (id integer primary key not null, window_id integer not null, custom_title text);
    create table pane_nodes (id integer primary key not null, tab_id integer not null, parent_pane_node_id integer, flex float, is_leaf boolean not null);
    create table pane_leaves (pane_node_id integer not null unique, kind text not null, is_focused boolean not null default false);
    create table terminal_panes (id integer primary key not null, kind text not null default 'terminal', uuid blob not null unique, cwd text, is_active boolean not null default false);
    insert into app values (1, 2);
    insert into windows values (1, 0), (2, 1);
    insert into tabs values (1, 1, null), (2, 1, null), (3, 2, null), (4, 2, null);
    insert into pane_nodes values (1, 1, null, null, 1), (2, 2, null, null, 1), (3, 3, null, null, 0), (4, 3, 3, 0.5, 1), (5, 3, 3, 0.5, 1), (6, 4, null, null, 1);
    insert into pane_leaves values (1, 'terminal', 1), (2, 'terminal', 1), (4, 'terminal', 0), (5, 'terminal', 1), (6, 'terminal', 1);
    insert into terminal_panes (id, uuid) values (1, x'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), (2, x'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'), (4, x'cccccccccccccccccccccccccccccccc'), (5, x'dddddddddddddddddddddddddddddddd'), (6, x'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')"
  active() { sqlite3 $TTHEME_WARP_DB "$1"; REPLY=; __tt_warp_active; print -r -- $REPLY }
  [[ $(active '') == eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee && $(active 'update windows set active_tab_index = 0 where id = 2') == dddddddddddddddddddddddddddddddd &&
     $(active 'update app set active_window_id = null') == '' && $(active 'update app set active_window_id = 1') == aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ]] ||
    { print -u2 "Warp's front tab was misread from its session database"; exit 1 }
  mkdir -p $TTHEME_WARP_TABS
  sleep 30 >/dev/null 2>&1 &
  alive=$!
  print -r -- "$alive miku kaito -" > $TTHEME_WARP_TABS/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
  print -r -- "$alive miku homura -" > $TTHEME_WARP_TABS/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
  print -r -- "$alive miku - -" > $TTHEME_WARP_TABS/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
  ours() { __tt_warp_value $1; print -r -- "theme = $REPLY" }
  worn() { grep '^theme' $TTHEME_WARP_SETTINGS }
  __tt_warp_tick
  [[ "$(<$TTHEME_WARP_TABS/.active)" == aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa && "$(worn)" == "$(ours kaito)" && "$(<$TTHEME_HOME/warp.base)" == '"Dracula"' ]] ||
    { print -u2 "the follower did not put on the palette of Warp's front tab: $(worn)"; exit 1 }
  : > $XDG_CONFIG_HOME/wrote
  __tt_warp_set() { print -r -- "$1" >> $XDG_CONFIG_HOME/wrote; }
  __tt_warp_tick
  [[ ! -s $XDG_CONFIG_HOME/wrote ]] || { print -u2 "the follower wrote Warp's settings again with nothing changed"; exit 1 }
  unfunction __tt_warp_set
  source $XDG_CONFIG_HOME/ttheme/adapters/warp.zsh
  TTHEME_WARP_SETTINGS=$XDG_CONFIG_HOME/fwarp/settings.toml TTHEME_WARP_THEMES=$XDG_CONFIG_HOME/fwarpthemes TTHEME_WARP_DB=$XDG_CONFIG_HOME/fwarp/warp.sqlite
  sqlite3 $TTHEME_WARP_DB 'update windows set active_tab_index = 1 where id = 1'
  __tt_warp_tick
  [[ "$(<$TTHEME_WARP_TABS/.active)" == bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb && "$(worn)" == "$(ours homura)" ]] ||
    { print -u2 "switching tabs did not put on the palette of the tab in front: $(worn)"; exit 1 }
  sqlite3 $TTHEME_WARP_DB 'update app set active_window_id = 2; update windows set active_tab_index = 1 where id = 2'
  __tt_warp_tick
  [[ "$(worn)" == "$(ours miku)" ]] || { print -u2 "a tab that wears no palette of its own did not get the default: $(worn)"; exit 1 }
  sqlite3 $TTHEME_WARP_DB 'update app set active_window_id = null'
  __tt_warp_tick
  [[ "$(<$TTHEME_WARP_TABS/.active)" == eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee ]] || { print -u2 "Warp going to the background moved the front tab"; exit 1 }
  print -r -- "$alive miku kaito -" > $TTHEME_WARP_TABS/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
  __tt_warp_tick
  [[ "$(worn)" == "$(ours kaito)" ]] || { print -u2 "a palette the front tab took did not follow: $(worn)"; exit 1 }
  TTHEME_STARTUP= TTHEME_WARP_LAST=
  __tt_warp_tick
  [[ "$(worn)" == 'theme = "Dracula"' && ! -e $TTHEME_HOME/warp.base ]] ||
    { print -u2 "a tab painted before ttheme went off kept its palette in front: $(worn)"; exit 1 }
  print -r -- "$alive - kaito -" > $TTHEME_WARP_TABS/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
  __tt_warp_tick
  [[ "$(worn)" == "$(ours kaito)" && "$(<$TTHEME_HOME/warp.base)" == '"Dracula"' ]] ||
    { print -u2 "a palette a tab took while ttheme is off did not follow: $(worn)"; exit 1 }
  print -r -- "$alive - - -" > $TTHEME_WARP_TABS/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
  __tt_warp_tick
  [[ "$(worn)" == 'theme = "Dracula"' ]] || { print -u2 "a tab with no palette while ttheme is off did not get the user's theme back: $(worn)"; exit 1 }
  __tt_warp_live || { print -u2 "the follower found no live tab"; exit 1 }
  kill $alive
  wait $alive 2>/dev/null
  __tt_warp_live && { print -u2 "the follower kept going with every tab closed"; exit 1 }
  [[ -z $(print -r $TTHEME_WARP_TABS/[0-9a-f]*(N)) ]] || { print -u2 "the follower left closed tabs behind"; exit 1 }
  rm -rf $TTHEME_WARP_TABS $TTHEME_HOME/warp.base
) || exit 1
(
  source $XDG_CONFIG_HOME/ttheme/adapters/warp.zsh
  mkdir -p $XDG_CONFIG_HOME/warpview $XDG_CONFIG_HOME/warpviewthemes
  TTHEME_WARP_SETTINGS=$XDG_CONFIG_HOME/warpview/settings.toml TTHEME_WARP_THEMES=$XDG_CONFIG_HOME/warpviewthemes TTHEME_TERMINALS=(warp)
  print -rl -- '[appearance.themes]' 'theme = "Dracula"' > $TTHEME_WARP_SETTINGS
  head -c 6000 /dev/urandom > $XDG_CONFIG_HOME/big.png
  out=$(base64() { if (( $# )); then command base64 "$@"; else command base64 | fold -w 76; fi }; __tt_bg_transmit 7 $XDG_CONFIG_HOME/big.png)
  sent=${(j::)${${${(ps:\e_G:)out}#*;}%$'\e\\'}}
  [[ $out == $'\e_Ga=t,f=100,i=7,m=1,q=2;'* && ${#${(M)${(ps:\e_G:)out}:#m=0,*}} == 1 && $sent != *[^A-Za-z0-9+/=]* && "$(print -rn -- $sent | base64 --decode | shasum)" == "$(shasum < $XDG_CONFIG_HOME/big.png)" ]] ||
    { print -u2 "a picture sent to Warp did not arrive whole in its chunks"; exit 1 }
  print -rl -- 'name: "miku"' 'details: darker' 'terminal_colors:' >| $TTHEME_WARP_THEMES/ttheme-miku.yaml
  : >| $TTHEME_WARP_THEMES/ttheme-miku.89abcdef.yaml
  printf '\x89PNG\r\n\x1a\n\0\0\0\x0dIHDR\0\0\x06\x5a\0\0\x07\x60' >| $bgd/miku.0a1b2c3d.png
  : >| $bgd/miku.0a1b2c3d@fill-40.png
  print -rl -- 'background-image = miku.0a1b2c3d@fill-40.png' 'background-image-fit = cover' 'background-image-opacity = 0.19' >| $bgd/miku.conf
  __tt_pv_draw() { : }
  __tt_cli() { print -r -- "$*" >> $XDG_CONFIG_HOME/cli.log; [[ $1 == flatten ]] && : >| $3 }
  bgsrc=() bgcut="" pw=91 ph=51 bgcw=32 bgch=40 msg="" msgt=0
  __tt_bg_load miku
  bgsize[miku]=140 bgpos[miku]=6
  __tt_warp_view miku > /dev/null
  view=$TTHEME_WARP_SHOWING
  __tt_warp_laid miku $bgd/miku.0a1b2c3d@140-center-right-2912x2040.png
  out=$REPLY
  [[ $out == $TTHEME_WARP_THEMES/ttheme-miku.????????.png && "$(<$XDG_CONFIG_HOME/cli.log)" == "flatten $bgd/miku.0a1b2c3d.png $out ${TTHEME_PALETTE[miku]%% *} 1 2912x2040 2459x2856+453-122" && $TTHEME_WARP_LAID == "$out" ]] ||
    { print -u2 "a Warp view did not lay its picture whole on the grid's canvas, into the file saving it shows: $(<$XDG_CONFIG_HOME/cli.log)"; exit 1 }
  [[ "$(<$TTHEME_WARP_THEMES/$view)" == *$'details: darker\nbackground_image:\n  path: "'$out$'"\n  opacity: 19\nterminal_colors:'* && "$(<$TTHEME_WARP_SETTINGS)" == *"path = \"$view\""* ]] ||
    { print -u2 "Warp was not put on a view of the laid picture at its opacity:"; cat $TTHEME_WARP_THEMES/$view; exit 1 }
  [[ "$(<$TTHEME_HOME/warp.base)" == '"Dracula"' ]] || { print -u2 "a Warp view did not keep the user's theme where ttheme off finds it"; exit 1 }
  : >| $XDG_CONFIG_HOME/cli.log
  bgop[miku]=0.3
  __tt_warp_view miku > /dev/null
  [[ ! -s $XDG_CONFIG_HOME/cli.log && ! -e $TTHEME_WARP_THEMES/$view && "$(<$TTHEME_WARP_THEMES/$TTHEME_WARP_SHOWING)" == *$'  path: "'$out$'"\n  opacity: 30\n'* ]] ||
    { print -u2 "a Warp view that only changed its opacity drew its picture again or moved to another file: $(<$XDG_CONFIG_HOME/cli.log)"; exit 1 }
  bgop[miku]=0.19 view=$TTHEME_WARP_SHOWING
  bgsize[miku]=141
  __tt_warp_view miku > /dev/null
  [[ ! -e $TTHEME_WARP_THEMES/$view && "$(<$TTHEME_WARP_SETTINGS)" == *"path = \"$TTHEME_WARP_SHOWING\""* ]] ||
    { print -u2 "a new Warp view left the one before it behind"; exit 1 }
  : >| $XDG_CONFIG_HOME/cli.log
  bgsize[miku]=140
  __tt_warp_view miku > /dev/null
  [[ ! -s $XDG_CONFIG_HOME/cli.log && "$(<$TTHEME_WARP_SETTINGS)" == *"path = \"$TTHEME_WARP_SHOWING\""* ]] ||
    { print -u2 "a Warp view drew a picture it had drawn already: $(<$XDG_CONFIG_HOME/cli.log)"; exit 1 }
  : >| $XDG_CONFIG_HOME/cli.log
  bgsize[miku]=fill bgpos[miku]=5
  __tt_warp_view miku > /dev/null
  __tt_warp_laid miku $bgd/miku.0a1b2c3d@fill-40.png
  [[ "$(<$XDG_CONFIG_HOME/cli.log)" == "flatten $bgd/miku.0a1b2c3d@fill-40.png $REPLY ${TTHEME_PALETTE[miku]%% *} 1" ]] ||
    { print -u2 "a Warp view of the fill did not lay the fill itself into the file its theme shows: $(<$XDG_CONFIG_HOME/cli.log)"; exit 1 }
  bgsize[miku]=140 bgpos[miku]=6
  __tt_warp_view miku > /dev/null
  view=$TTHEME_WARP_SHOWING bgname=miku bgedit[miku]=1 applied=$TTHEME_PALETTE[miku]
  __tt_pv_bg_close > /dev/null
  [[ ${#TTHEME_WARP_LAID} == 0 ]] || { print -u2 "closing preview kept its list of laid pictures to sweep"; exit 1 }
  [[ $TTHEME_WARP_SHOWING == "$view" && "$(<$TTHEME_WARP_SETTINGS)" == *"path = \"$view\""* ]] ||
    { print -u2 "closing preview took Warp off the view of a tuning about to be saved"; exit 1 }
  __tt_bg_refresh miku
  [[ -z $TTHEME_WARP_SHOWING && ! -e $TTHEME_WARP_THEMES/$view && "$(<$TTHEME_WARP_SETTINGS)" == *"path = \"$view\""* ]] ||
    { print -u2 "a saved tuning moved Warp itself where the CLI puts its new picture on, or left the view file"; exit 1 }
  : >| $XDG_CONFIG_HOME/cli.log
  __tt_bg_bake $bgd/miku.0a1b2c3d.png $bgd/miku.0a1b2c3d@140-center-right-2912x2040.png 2912 2040 2459 2856 453 -122
  [[ "$(<$XDG_CONFIG_HOME/cli.log)" == "bake $bgd/miku.0a1b2c3d.png $bgd/miku.0a1b2c3d@140-center-right-2912x2040.png 2912x2040 2459x2856+453-122" ]] ||
    { print -u2 "Warp baked a tuned picture without the CLI: $(<$XDG_CONFIG_HOME/cli.log)"; exit 1 }
  bgedit=() bgsize[miku]=144
  __tt_warp_view miku > /dev/null
  view=$TTHEME_WARP_SHOWING bgname=miku:k2 bgview[miku]=miku:k2
  __tt_pv_bg_close > /dev/null
  [[ $TTHEME_WARP_SHOWING == "$view" ]] || { print -u2 "closing preview took Warp off the view of a picture chosen to be shown"; exit 1 }
  bgname=miku bgview=()
  __tt_pv_bg_close > /dev/null
  [[ -z $TTHEME_WARP_SHOWING && ! -e $TTHEME_WARP_THEMES/$view && "$(<$TTHEME_WARP_SETTINGS)" == *'path = "ttheme-miku.89abcdef.yaml"'* ]] ||
    { print -u2 "closing preview left up the view of a picture nobody kept"; exit 1 }
  __tt_bg_hide miku
  [[ "$(<$TTHEME_WARP_SETTINGS)" == *'path = "ttheme-miku.yaml"'* ]] || { print -u2 "find opened over Warp's picture, which covers its loading bar"; exit 1 }
  rm -f $bgd/miku.0a1b2c3d.png $bgd/miku.0a1b2c3d@fill-40.png $bgd/miku.conf $XDG_CONFIG_HOME/cli.log
) || exit 1
mkdir -p $XDG_CONFIG_HOME/fakebin
print -rl -- '#!/bin/sh' 'printf %s "$NODE_COMPILE_CACHE"' > $XDG_CONFIG_HOME/fakebin/node
chmod +x $XDG_CONFIG_HOME/fakebin/node
out=$(PATH=$XDG_CONFIG_HOME/fakebin:$PATH XDG_CACHE_HOME=/c __tt_cli --version)
[[ $out == /c/ttheme/node ]] || { print -u2 "the layer no longer hands node its compile cache: [$out]"; exit 1 }
(
  TTHEME_STATE_DIR=$XDG_CONFIG_HOME/state TTHEME_TAB_PALETTE=off TTHEME_STARTUP=miku TTHEME_ADAPTER=ghostty TTHEME_TMUX=0
  unset TTHEME_PAINTED
  __tt_osc_apply "$TTHEME_PALETTE[kaito]" > /dev/null
  [[ ${(t)TTHEME_PAINTED} == *export* ]] || { print -u2 "a paint no longer tells the shells it starts that the tab is painted"; exit 1 }
  __tt_remember '#123456'
  [[ ! -e $TTHEME_STATE_DIR/colors.ghostty ]] || { print -u2 "a painted tab kept its paint as the terminal's own colors"; exit 1 }
  __tt_osc_reset > /dev/null
  [[ -z ${TTHEME_PAINTED+x} ]] || { print -u2 "a reset left the tab marked painted"; exit 1 }
  stale=${TTHEME_PALETTE[miku]%% *} fresh=${TTHEME_PALETTE[kaito]%% *} synced=0
  __tt_hear() { REPLY=$fresh }
  __tt_sync() { synced=1 }
  TTHEME_HEARD=$stale TTHEME_SPEC=$TTHEME_PALETTE[miku] TTHEME_PIN=
  __tt_recheck
  [[ $TTHEME_SPEC == "$TTHEME_PALETTE[kaito]" && $TTHEME_HEARD == $fresh && $synced == 1 && "$(<$TTHEME_STATE_DIR/colors.ghostty)" == "miku $fresh" ]] ||
    { print -u2 "a recheck did not move the tab off a stale remembered color: spec=${TTHEME_SPEC%% *} heard=$TTHEME_HEARD synced=$synced"; exit 1 }
  TTHEME_HEARD=$stale TTHEME_PIN=/pinned TTHEME_BASE_SPEC=$TTHEME_PALETTE[miku] TTHEME_SPEC=$TTHEME_PALETTE[homura]
  __tt_recheck
  [[ $TTHEME_BASE_SPEC == "$TTHEME_PALETTE[kaito]" && $TTHEME_SPEC == "$TTHEME_PALETTE[homura]" ]] ||
    { print -u2 "a recheck under a pin moved the wrong spec: base=${TTHEME_BASE_SPEC%% *} spec=${TTHEME_SPEC%% *}"; exit 1 }
  TTHEME_HEARD=$stale TTHEME_PIN= TTHEME_SPEC=$TTHEME_PALETTE[miku]
  export TTHEME_PAINTED=1
  __tt_recheck
  [[ $TTHEME_SPEC == "$TTHEME_PALETTE[miku]" && $TTHEME_HEARD == $stale ]] || { print -u2 "a recheck trusted a painted tab's colors"; exit 1 }
) || exit 1
(
  setopt noclobber
  mkdir -p $XDG_CONFIG_HOME/dotfiles $XDG_CONFIG_HOME/linked
  print -r -- "$TTHEME_CONFIG_TEMPLATE" >| $XDG_CONFIG_HOME/dotfiles/config.zsh
  ln -s $XDG_CONFIG_HOME/dotfiles/config.zsh $XDG_CONFIG_HOME/linked/config.zsh
  TTHEME_CONFIG=$XDG_CONFIG_HOME/linked/config.zsh
  __tt_config_write TTHEME_SORT series || { print -u2 "saving a setting failed under noclobber"; exit 1 }
  [[ -L $TTHEME_CONFIG && "$(<$XDG_CONFIG_HOME/dotfiles/config.zsh)" == *': ${TTHEME_SORT:=series}'* ]] ||
    { print -u2 "saving a setting replaced a linked config.zsh, or never reached it"; exit 1 }
) || exit 1
print "shell layer ok — ${#TTHEME_PALETTE} palettes, adapter=$adapter"
