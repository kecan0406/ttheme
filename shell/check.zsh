export XDG_CONFIG_HOME=$(mktemp -d)
trap "rm -rf $XDG_CONFIG_HOME" EXIT
export HOME=$XDG_CONFIG_HOME/home
mkdir -p $HOME
unset TERM_PROGRAM GHOSTTY_RESOURCES_DIR KITTY_WINDOW_ID WEZTERM_PANE ALACRITTY_WINDOW_ID KONSOLE_VERSION ITERM_SESSION_ID WT_SESSION WARP_TERMINAL_SESSION_UUID XDG_STATE_HOME
mkdir -p $XDG_CONFIG_HOME/ttheme
cp -R shell/ttheme.zsh shell/preview.zsh shell/adapters dist/shell/palettes.zsh $XDG_CONFIG_HOME/ttheme/
source $XDG_CONFIG_HOME/ttheme/ttheme.zsh
b64d() {
  local in=$(cat)
  [[ $in != *[^A-Za-z0-9+/=]* ]] || { print -u2 "not base64: ${(V)in}"; return 1 }
  print -rn -- $in | base64 --decode
}
(( ${#TTHEME_PALETTE} > 0 )) || { print -u2 "no palettes loaded"; exit 1 }
(( ${#TTHEME_ORDER} + 1 == ${#TTHEME_PALETTE} )) || { print -u2 "order/palette mismatch"; exit 1 }
(( $+functions[__tt_bg_hide] && $+functions[__tt_pv_bg_reset] )) || { print -u2 "preview's Edit palette calls a picture hook a terminal without pictures lacks"; exit 1 }
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
[[ $(ttheme pin --help) == "Usage: ttheme pin"* ]] || { print -u2 "ttheme pin --help did not describe pin"; exit 1 }
[[ $(ttheme pins --help) == "Usage: ttheme pins"$'\n\n'"Map every pin — the pinned directories"* ]] || { print -u2 "ttheme pins --help did not describe pins"; exit 1 }
ttheme pins extra 2>/dev/null && { print -u2 "ttheme pins took an extra argument"; exit 1 }
out=$(__tt_preview hub </dev/null 2>&1) && { print -u2 "preview ran without a tty"; exit 1 }
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
typeset -A bgfrom=() bgurl=() bgby=() bgsrc=() bgfill=() bgfocus=() bgsize=() bgpos=() bgop=() bgdef=() bgoff=() bgbase=() bgload=() bgshot=() bgshotkey=() bgdim=() bgtunef=() bgofff=() bgimages=() bgpic=() bgpics=() bgact=() bgview=() bgswap=() bgthumb=() tsnaps=() bgedit=() bgcolors=() bgprep=()
typeset -i bgprepid=0
functions[__tt_pv_bg_prepare_run]=$functions[__tt_pv_bg_prepare]
__tt_pv_bg_prepare() { : }
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
__tt_blur
__tt_shown kagami && { print -u2 "a tab the terminal said is behind took the picture"; exit 1 }
[[ ! -e $bgd/shown.conf ]] || { print -u2 "a tab behind wrote shown.conf: $(<$bgd/shown.conf)"; exit 1 }
TTHEME_FRONT=-1
__tt_prompt
(( TTHEME_FRONT == -1 )) || { print -u2 "a prompt decided where focus is for a shell that never heard"; exit 1 }
__tt_shown kagami && __tt_reload ||
  { print -u2 "a tab that never heard where focus is did not take the picture — a shell whose line-init never turns focus reporting on would never show one"; exit 1 }
TTHEME_FRONT=1
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
__tt_blur
TTHEME_SPEC=$TTHEME_PALETTE[kagami]; __tt_sync
[[ "$(<$bgd/shown.conf)" == "config-file = ?rei.conf" && $reloads == 5 ]] ||
  { print -u2 "a tab that lost focus still took the picture: $(<$bgd/shown.conf) reloads=$reloads"; exit 1 }
__tt_focus
TTHEME_SPEC=$TTHEME_PALETTE[rei]
__tt_prompt
__tt_precmd
[[ "$(<$bgd/shown.conf)" == "config-file = ?kagami.conf" && $reloads == 6 && $TTHEME_FRONT == 0 ]] ||
  { print -u2 "a prompt took the picture before the terminal said the tab is in front — a command that ends in a tab behind would take it: $(<$bgd/shown.conf) reloads=$reloads front=$TTHEME_FRONT"; exit 1 }
__tt_focus
[[ "$(<$bgd/shown.conf)" == "config-file = ?rei.conf" && $reloads == 7 && $TTHEME_FRONT == 1 ]] ||
  { print -u2 "the focus answer at a prompt did not take the picture: $(<$bgd/shown.conf) reloads=$reloads"; exit 1 }
[[ -z "$(__tt_precmd)" && "$(__tt_focus_on)" == $'\e[?1004h' && "$(__tt_preexec)" == $'\e[?1004l' ]] ||
  { print -u2 "the prompt did not turn focus reporting on and off"; exit 1 }
__tt_bg_saved kagami
(( reloads == 7 )) || { print -u2 "saving a picture Ghostty does not show reloaded it: reloads=$reloads"; exit 1 }
__tt_bg_saved kagami rei
(( reloads == 8 )) || { print -u2 "saving the picture Ghostty shows did not reload it: reloads=$reloads"; exit 1 }
bgsrc=(); __tt_bg_load homura; bgsize[homura]=60
__tt_bg_write homura && [[ ! -e $bgd/homura.conf ]] || { print -u2 "tuning a palette with no picture left a conf behind"; ls $bgd; exit 1 }
print -l "# image safebooru_2 2/3" "background-image = kagami.1a2b3c4d@fill-42.png" "background-image-fit = cover" "background-image-opacity = 0.2" "config-file = ?kagami.1a2b3c4d.tune.conf" "config-file = ?kagami.1a2b3c4d.off.conf" > $bgd/kagami.conf
: > $bgd/kagami.1a2b3c4d.png && : > $bgd/kagami.1a2b3c4d@fill-42.png
bgsrc=(); __tt_bg_load kagami; bgsize[kagami]=100 bgoff[kagami]=1
__tt_bg_write kagami || { print -u2 "__tt_bg_write (a picture's own tuning) failed"; exit 1 }
[[ -e $bgd/kagami.1a2b3c4d.tune.conf && -e $bgd/kagami.1a2b3c4d.off.conf && ! -e $bgd/kagami.tune.conf && $(grep -c config-file $bgd/kagami.conf) == 2 ]] ||
  { print -u2 "tuning did not go to the picture the conf names:"; ls $bgd; cat $bgd/kagami.conf; exit 1 }
te=1 tfocus=1 tename=kagami bgcw=8 tune=kagami tpick=kagami tf=1 help=0 pick= conf=0 msgt=0 flt= color=0
out=; __tt_pv_foot 80
[[ $out == *"f find"* && $out == *"s save"* ]] || { print -u2 "an EDIT bar on a picture with several images dropped the find or save key: $out"; exit 1 }
out=; __tt_pv_foot 200
[[ $out == *"image ×3"* ]] || { print -u2 "the EDIT bar did not count the palette's pictures: $out"; exit 1 }
[[ $out == *"space show"* && $out != *"c colors"* ]] ||
  { print -u2 "the EDIT bar of a hidden picture offered the colors key: $out"; exit 1 }
(
  shown=""
  __tt_pv_bg_show() { shown=$1 }
  __tt_pv_paint() { print -u2 "a picture tweak in the panel repainted the list's palette over the tone"; exit 1 }
  rtype=(thm) rval=(konata) cur=1 resized=0 bgname=""
  __tt_pv_focus
  [[ $shown == kagami ]] || { print -u2 "a size or position step in the panel never showed the picture again: '$shown'"; exit 1 }
) || exit 1
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
te=1 tfocus=1 tename=kagami bgcw=8 tune=kagami tpick=kagami:safebooru_3 tf=4 color=0 out= off=0 msgt=0 help=0 pick= conf=0 flt=
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
te=0 tune= tpick= bgcw=0 out=
(
  __tt_pv_draw() { : }
  __tt_pv_bg_close() { print closed >> $bgd/closed.log }
  __tt_pv_bg_strip_off() { print stripped >> $bgd/closed.log }
  __tt_cli() {
    [[ -e $bgd/closed.log ]] && print closed-before-cli > $bgd/early.log
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
  te=1 tfocus=1 tename=kagami bgcw=8 color=0 msgt=0 help=0 pick= conf=0 flt=
  __tt_pv_tune_open kagami
  bgoff[kagami]=1 tf=1 key=c
  rm -f $bgd/cli.log
  __tt_pv_tune > /dev/null
  [[ ! -e $bgd/cli.log ]] || { print -u2 "c drew a hidden picture again"; exit 1 }
  bgoff[kagami]=0 out=; __tt_pv_foot 200
  [[ $out == *"c colors"* ]] || { print -u2 "the EDIT bar did not offer the colors key: $out"; exit 1 }
  __tt_pv_tune > /dev/null
  REPLY=; __tt_bg_coloring $tpick
  [[ "$(<$bgd/cli.log)" == "image kagami original safebooru_2" && $REPLY == original && $tf == 1 && $tune == kagami && $bgsrc[kagami] == *5e5e5e5e* ]] ||
    { print -u2 "c did not draw the picture again through the CLI, on the row it was pressed on: $(<$bgd/cli.log) coloring=$REPLY tf=$tf tune=$tune src=$bgsrc[kagami]"; exit 1 }
  [[ ! -e $bgd/early.log ]] ||
    { print -u2 "c took the picture or the panel's thumbnails off the screen while the CLI drew it again, so they were gone until the next frame"; exit 1 }
  rm -f $bgd/cli.log
  tf=4 key=right
  __tt_pv_tune > /dev/null
  [[ "$(<$bgd/cli.log)" == "image kagami tone safebooru_2" && $tf == 4 ]] ||
    { print -u2 "the Colors row did not switch back on an arrow key: $(<$bgd/cli.log) tf=$tf"; exit 1 }
) || exit 1
tune= tpick= bgcw=0 out=
(
  functions[__tt_pv_bg_prepare]=$functions[__tt_pv_bg_prepare_run]
  __tt_cli() { print -r -- "$*" >> $bgd/prep.log }
  rm -f $bgd/prep.log
  print -l "# image safebooru_2 1/1" "# picture safebooru_2 kagami.1a2b3c4d kagami.1a2b3c4d@fill-42.png 0.2 -" \
    "background-image = kagami.1a2b3c4d@fill-42.png" "background-image-fit = cover" "background-image-opacity = 0.2" \
    "config-file = ?kagami.1a2b3c4d.tune.conf" "config-file = ?kagami.1a2b3c4d.off.conf" > $bgd/kagami.conf
  bgsrc=() bgcolors=() bgprep=() bgview=() bgswap=() bgedit=() tsnaps=() bgprepid=0 tune= tpick=
  __tt_pv_tune_open kagami
  for i in {1..30}; do [[ -s $bgd/prep.log ]] && break; sleep 0.1; done
  __tt_pv_tune_open kagami
  sleep 0.3
  [[ "$(<$bgd/prep.log)" == "image kagami prepare safebooru_2" ]] ||
    { print -u2 "opening a picture's tuning did not get its other coloring ready exactly once: $(<$bgd/prep.log)"; exit 1 }
  bgprep[kagami:safebooru_2:original]=1 bgcolors[kagami:safebooru_2]=original
  rm -f $bgd/prep.log
  __tt_pv_tune_open kagami
  sleep 0.3
  [[ ! -e $bgd/prep.log ]] ||
    { print -u2 "a coloring marked as prepared was prepared again: $(<$bgd/prep.log)"; exit 1 }
) || exit 1
(
  te=1 bgcw=8 color=0 split=0 sw=0 pw=100 ph=30 help=1 out=
  __tt_pv_help
  [[ $out == *"c  colors"* ]] ||
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
  __tt_apply() { : }
  __tt_fresh() { : }
  TTHEME_PIN= TTHEME_PIN_SPEC= TTHEME_BASE_SPEC=
  for line want in \
    'ssh tusa' tusa \
    'ssh bob@Tusa' tusa \
    'ssh -p 2222 -A tusa' tusa \
    'ssh tusa -p 2222' tusa \
    'ssh -p2222 -lbob -o ServerAliveInterval=30 tusa' tusa \
    'TERM=xterm-256color command ssh tusa' tusa \
    "ssh 'tusa'" tusa \
    'ssh ssh://bob@tusa:2200' tusa \
    'ssh -J jump -t tusa tmux attach' tusa \
    'ssh tusa -t htop' tusa \
    'ssh -- tusa' tusa \
    'ssh tusa 2>/dev/null' tusa \
    'ssh tusa; echo done' tusa \
    '/usr/bin/ssh tusa' tusa \
    'ssh tusa uptime' - \
    'ssh tusa htop -t' - \
    'ssh -N -L 8080:localhost:80 tusa' - \
    'ssh -fN tusa' - \
    'ssh -T git@github.com' - \
    'ssh -G tusa' - \
    'ssh tusa | tee log' - \
    'ssh tusa < script' - \
    'ssh tusa > log' - \
    'ssh tusa &' - \
    'sshfs tusa:/ mnt' - \
    'echo ssh tusa' - \
    'ssh -p 22' -
  do
    REPLY=-
    __tt_ssh_host "$line" || REPLY=-
    [[ $REPLY == "$want" ]] || { print -u2 "ssh read ${(q+)line} as ${(q+)REPLY}, not $want"; exit 1 }
  done
  print -l "ssh:Tusa  homura" "ssh:*.prod  kaito" "ssh:db?.prod  rei" "ssh:gone  nosuchpalette" "ssh:bad host  mio" "ssh:  mio" > $TTHEME_PINS_FILE
  TTHEME_PINS_RAW=; __tt_pins_load 2>/dev/null
  [[ ${(j: :)${(ok)TTHEME_PINS}} == 'ssh:*.prod ssh:db?.prod ssh:gone ssh:tusa' ]] || { print -u2 "ssh pins did not load: ${(kv)TTHEME_PINS}"; exit 1 }
  for host want in tusa ssh:tusa db1.prod 'ssh:db?.prod' db10.prod 'ssh:*.prod' gone - tusa2 -; do
    REPLY=-
    __tt_ssh_rule $host || REPLY=-
    [[ $REPLY == "$want" ]] || { print -u2 "ssh to $host took the pin ${(q+)REPLY}, not $want"; exit 1 }
  done
  TTHEME_SPEC=$TTHEME_PALETTE[miku]
  __tt_ran 'ssh tusa' 'ssh tusa' 'ssh tusa'
  [[ $TTHEME_SPEC == "$TTHEME_PALETTE[homura]" ]] || { print -u2 "ssh to a pinned host did not paint its palette"; exit 1 }
  __tt_prompt
  [[ $TTHEME_SPEC == "$TTHEME_PALETTE[miku]" && -z $TTHEME_SSH_SPEC ]] || { print -u2 "the prompt after ssh did not put the palette back"; exit 1 }
  __tt_ran 'ssh web.prod' 'ssh web.prod' 'ssh web.prod'
  TTHEME_SPEC=$TTHEME_PALETTE[rei]
  __tt_prompt
  [[ $TTHEME_SPEC == "$TTHEME_PALETTE[rei]" ]] || { print -u2 "the prompt after ssh overrode a palette painted by hand"; exit 1 }
  __tt_ran 'ssh tusa uptime' 'ssh tusa uptime' 'ssh tusa uptime'
  [[ $TTHEME_SPEC == "$TTHEME_PALETTE[rei]" && -z $TTHEME_SSH_SPEC ]] || { print -u2 "a remote command painted the tab"; exit 1 }
  TTHEME_SPEC= resets=0
  __tt_osc_reset() { (( ++resets )) }
  __tt_ran 'ssh tusa' 'ssh tusa' 'ssh tusa'
  __tt_prompt
  [[ -z $TTHEME_SPEC && $resets == 1 ]] || { print -u2 "the prompt after ssh did not reset a tab of unknown colors: spec=[$TTHEME_SPEC] resets=$resets"; exit 1 }
  TTHEME_SPEC=$TTHEME_PALETTE[kaito]
  out=$(__tt_pin_save kaito ssh:tusa "$TTHEME_PALETTE[miku]"; [[ $TTHEME_SPEC == "$TTHEME_PALETTE[miku]" ]] && print back)
  [[ $out == "Pinned · kaito → ssh tusa · while connected"$'\n'back ]] || { print -u2 "pinning a host broke: $out"; exit 1 }
  TTHEME_PINS_RAW=; __tt_pins_load 2>/dev/null
  [[ $TTHEME_PINS[ssh:tusa] == kaito && ${#TTHEME_PINS} == 4 ]] || { print -u2 "a host pin did not round-trip: ${(kv)TTHEME_PINS}"; exit 1 }
  out=$(__tt_unpin ssh:TUSA)
  [[ $out == "Unpinned · kaito on ssh tusa · while connected" ]] || { print -u2 "unpinning a host broke: $out"; exit 1 }
  TTHEME_PINS_RAW=; __tt_pins_load 2>/dev/null
  [[ -z $TTHEME_PINS[ssh:tusa] ]] || { print -u2 "unpin left the host pin in the file"; exit 1 }
  out=$(__tt_unpin ssh:tusa 2>&1) && { print -u2 "unpin dropped a host pin that was gone"; exit 1 }
  [[ $out == "ttheme unpin: nothing pinned to ssh tusa" ]] || { print -u2 "unpin of a missing host said: $out"; exit 1 }
  out=$(ttheme pin ssh:bob@tusa 2>&1) && { print -u2 "ttheme pin took a user in a host pin"; exit 1 }
  [[ $out == "ttheme pin: an ssh pin names the host alone — ssh:tusa" ]] || { print -u2 "ttheme pin ssh:bob@tusa said: $out"; exit 1 }
  rm -f $TTHEME_PINS_FILE
) || exit 1
(
  HOME=$XDG_CONFIG_HOME/home
  mkdir -p $HOME/work/api/v2 $HOME/work/site/x $HOME/notes
  print -r -- "//**  rei" > $TTHEME_PINS_FILE
  TTHEME_PINS_RAW=; __tt_pins_load
  REPLY=; __tt_dir_rule $HOME/work && [[ $REPLY == "//**" ]] || { print -u2 "a pin on / and below skipped what is below it: $REPLY"; exit 1 }
  print -l "~/work/**  homura" "~/work/site  kaito" "~/work/site/**  miku" "~/notes/**  nosuchpalette" "/nonexistent-ttheme/place/**  rei" "~  mio" "ssh:tusa  kaito" "ssh:*.prod  nosuchpalette" > $TTHEME_PINS_FILE
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
    "ssh *.prod                 nosuchpalette  while connected · not installed"
    "ssh tusa                   kaito          while connected"
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
  want=("/nonexistent-ttheme/place/**"$'\t'rei "$HOME"$'\t'mio "~/notes/**"$'\t'nosuchpalette "~/work/**"$'\t'homura "~/work/site"$'\t'kaito "~/work/site/**"$'\t'miku "ssh:*.prod"$'\t'nosuchpalette "ssh:tusa"$'\t'kaito)
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
  export XDG_DATA_HOME=$HOME/.local/share
  kd=$XDG_DATA_HOME/konsole
  __tt_apply "#123456 ${TTHEME_PALETTE[kaito]#* }" > $bgd/view.out
  view=${${$(<$bgd/view.out)#*ColorScheme=}%%;*}
  [[ $view == ttheme-view.$$.<-> && -r $kd/$view.colorscheme ]] ||
    { print -u2 "Konsole painted colors no palette's scheme holds with something else than a view scheme of its own: ${(V)$(<$bgd/view.out)}"; exit 1 }
  [[ "$(<$kd/$view.colorscheme)" == *$'[Background]\nColor=18,52,86\n'* ]] || { print -u2 "a Konsole view scheme does not carry the background it was painted with"; exit 1 }
  forks_of __tt_apply "#123457 ${TTHEME_PALETTE[kaito]#* }"
  (( REPLY == 0 )) || { print -u2 "a Konsole view scheme forks again ($REPLY processes) — every tone edit pays it"; exit 1 }
  __tt_apply "#123458 ${TTHEME_PALETTE[kaito]#* }" > /dev/null
  __tt_apply "#123459 ${TTHEME_PALETTE[kaito]#* }" > /dev/null
  [[ ! -e $kd/$view.colorscheme ]] || { print -u2 "a Konsole view scheme two paints old was left behind"; exit 1 }
  views=($kd/ttheme-view.$$.*.colorscheme(N))
  (( ${#views} == 2 )) || { print -u2 "Konsole keeps other than the two latest view schemes: $views"; exit 1 }
  [[ "$(__tt_osc_reset)" == $'\e]50;ColorScheme=ttheme-miku;UseCustomCursorColor=true;customCursorColor='${${=TTHEME_PALETTE[miku]}[3]}$'\a' ]] ||
    { print -u2 "a Konsole reset did not go back to the default palette's scheme, which new tabs open with"; exit 1 }
  TTHEME_STARTUP=
  [[ "$(__tt_osc_reset)" == $'\e]50;ColorScheme=Breeze;UseCustomCursorColor=false\a' ]] ||
    { print -u2 "a Konsole reset while ttheme is off did not go back to the user's own scheme"; exit 1 }
  __tt_keepable || { print -u2 "a wired Konsole did not offer to keep a palette as the default"; exit 1 }
  TTHEME_TERMINALS=() TTHEME_STARTUP=miku
  ! __tt_keepable || { print -u2 "an unwired Konsole offered to keep a palette as the default its new tabs never open with"; exit 1 }
  ! __tt_takes_default || { print -u2 "an unwired Konsole tab that never painted took a default its profile never shows"; exit 1 }
  print -l '[Desktop Entry]' 'DefaultProfile=Mine.profile' > $XDG_CONFIG_HOME/konsolerc
  print -l '[Appearance]' 'ColorScheme=Solarized' '' '[Cursor Options]' 'CustomCursorColor=255,128,0' 'UseCustomCursorColor=true' > $kd/Mine.profile
  [[ "$(__tt_osc_reset)" == $'\e]50;ColorScheme=Solarized;UseCustomCursorColor=true;customCursorColor=#ff8000\a' ]] ||
    { print -u2 "a reset in an unwired Konsole did not go back to the scheme and cursor of the user's own profile: ${(V)$(__tt_osc_reset)}"; exit 1 }
  rm -f $XDG_CONFIG_HOME/konsolerc $kd/Mine.profile
  ttheme use kaito > $bgd/use.out 2>&1 || { print -u2 "ttheme use failed in an unwired Konsole: $(<$bgd/use.out)"; exit 1 }
  [[ $(<$bgd/use.out) == *$'\e]50;ColorScheme=ttheme-view.'* ]] || { print -u2 "ttheme use painted an unwired Konsole through something else than a view scheme: ${(V)$(<$bgd/use.out)}"; exit 1 }
  __tt_konsole_bye
  views=($kd/ttheme-view.$$.*.colorscheme(N))
  (( ! ${#views} )) || { print -u2 "a Konsole shell left its view schemes behind when it exited: $views"; exit 1 }
) || exit 1
(
  TTHEME_TERMINALS=(iterm2) TTHEME_STARTUP=miku TTHEME_TMUX=0 TTHEME_ITERM_SWITCH=1 TTHEME_ITERM_SHOWN=default TTHEME_ITERM_DYED=0
  TTHEME_ITERM_PROFILES=$XDG_CONFIG_HOME/ttheme.json
  print -r -- '{}' > $TTHEME_ITERM_PROFILES
  touch -t 202001010000 $TTHEME_ITERM_PROFILES
  source $XDG_CONFIG_HOME/ttheme/adapters/iterm2.zsh
  [[ "$(__tt_apply "$TTHEME_PALETTE[kaito]")" == $'\e]1337;SetProfile=ttheme · kaito\a' ]] ||
    { print -u2 "an iTerm2 that lets the shell switch profiles was painted rather than moved to the palette's profile: ${(V)$(__tt_apply "$TTHEME_PALETTE[kaito]")}"; exit 1 }
  forks_of __tt_apply "$TTHEME_PALETTE[kaito]"
  (( REPLY == 0 )) || { print -u2 "an iTerm2 profile switch forks again ($REPLY processes) — every preview hover pays it"; exit 1 }
  painted=""
  __tt_pv_paint "$TTHEME_PALETTE[kaito]" > /dev/null
  [[ $painted == "$TTHEME_PALETTE[kaito]" && $TTHEME_ITERM_SHOWN == kaito && $TTHEME_ITERM_DYED == 0 ]] ||
    { print -u2 "a preview hover in iTerm2 did not hold the whole palette through its profile: shown=$TTHEME_ITERM_SHOWN dyed=$TTHEME_ITERM_DYED"; exit 1 }
  [[ -z "$(__tt_shown kaito force)" ]] || { print -u2 "a tab already on its palette's profile was switched to it again"; exit 1 }
  forks_of __tt_shown kaito force
  (( REPLY == 0 )) || { print -u2 "an iTerm2 picture check forks again ($REPLY processes) — every prompt and focus pays it"; exit 1 }
  TTHEME_ITERM_DYED=1
  [[ "$(__tt_shown kaito)" == $'\e[?2026h\e]104;0;1;2;3;4;5;6;7;8;9;10;11;12;13;14;15\e\\\e]110\e\\\e]111\e\\\e]112\e\\\e]117\e\\\e]1337;SetProfile=ttheme · kaito\a\e[?2026l' ]] ||
    { print -u2 "a dyed iTerm2 tab was not reset and moved back onto its palette's profile in one update at its next prompt — iTerm2 keeps what a reset goes back to across a switch: ${(V)$(__tt_shown kaito)}"; exit 1 }
  TTHEME_ITERM_DYED=2
  [[ "$(__tt_shown kaito)" == $'\e[?2026h\e]110\e\\\e]111\e\\\e]1337;SetProfile=ttheme · kaito\a\e[?2026l' ]] ||
    { print -u2 "a tab preview dyed in its background and foreground alone was not reset in those before its switch: ${(V)$(__tt_shown kaito)}"; exit 1 }
  TTHEME_ITERM_DYED=1 TTHEME_ITERM_SWITCH=
  [[ "$(__tt_unshown force)" == $'\e]1337;SetProfile=\a' ]] ||
    { print -u2 "iTerm2 reset a tab's colors before a switch it may refuse: ${(V)$(__tt_unshown force)}"; exit 1 }
  TTHEME_ITERM_DYED=0 TTHEME_ITERM_SWITCH=1
  [[ "$(__tt_apply "$TTHEME_PALETTE[neutral]")" == $'\e]11;'*$'\e]4;15;'* ]] ||
    { print -u2 "iTerm2 switched to a profile ttheme never writes, for a palette outside the rotation"; exit 1 }
  touch $TTHEME_ITERM_PROFILES
  [[ "$(__tt_apply "$TTHEME_PALETTE[kaito]")" == $'\e]11;'*$'\e]4;15;'* ]] ||
    { print -u2 "iTerm2 switched to a profile in the second it may still be reading the profiles file"; exit 1 }
  touch -t 202001010000 $TTHEME_ITERM_PROFILES
  [[ "$(__tt_osc_reset)" == $'\e]1337;SetProfile=\a' ]] ||
    { print -u2 "an iTerm2 reset did not go back to the default profile new tabs open on: ${(V)$(__tt_osc_reset)}"; exit 1 }
  TTHEME_ITERM_SHOWN=default
  [[ -z "$(__tt_osc_reset)" ]] || { print -u2 "an iTerm2 reset switched a tab already on the default profile again"; exit 1 }
  TTHEME_ITERM_SWITCH=
  [[ "$(__tt_apply "$TTHEME_PALETTE[kaito]")" == $'\e]11;'*$'\e]4;15;'* && "$(__tt_osc_reset)" == $'\e]104\e\\\e]110\e\\\e]111\e\\\e]112\e\\\e]117\e\\' ]] ||
    { print -u2 "an iTerm2 that may not let the shell switch profiles was not painted and reset in OSC colors"; exit 1 }
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
  recorded() { print -r -- "$$ $* ${TTHEME_PALETTES_AT:--} ${TTHEME_PINS_AT:--}" }
  mine=('[appearance]' 'font = 1' '' '[appearance.themes]' 'system_theme = false' 'theme = "dark_city"' '' '[other]' 'x = 2')
  print -rl -- "${mine[@]}" > $XDG_CONFIG_HOME/dotwarp/settings.toml
  ln -s $XDG_CONFIG_HOME/dotwarp/settings.toml $TTHEME_WARP_SETTINGS
  __tt_paints && __tt_keepable || { print -u2 "a wired Warp with a settings.toml refused to paint, or to keep a palette as the default"; exit 1 }
  __tt_prompted
  [[ "$(<$tab)" == "$(recorded miku - -)" && "$(<$TTHEME_WARP_SETTINGS)" == *"$(ours miku)"* ]] ||
    { print -u2 "a Warp tab that took no palette did not follow the default: $(<$tab)"; exit 1 }
  ttheme use kaito > /dev/null || { print -u2 "ttheme use failed in a wired Warp"; exit 1 }
  [[ -L $TTHEME_WARP_SETTINGS && "$(<$TTHEME_WARP_SETTINGS)" == "$(print -rl -- "${(@)mine[1,5]}" "$(ours kaito)" "${(@)mine[7,-1]}")" ]] ||
    { print -u2 "ttheme use in Warp did not put the palette in settings.toml alone, or replaced the link:"; cat $TTHEME_WARP_SETTINGS; exit 1 }
  [[ "$(<$TTHEME_HOME/warp.base)" == '"dark_city"' && "$(<$TTHEME_WARP_SETTINGS.ttheme.bak)" == "$(print -rl -- "${mine[@]}")" && ${(t)TTHEME_PAINTED} == *export* ]] ||
    { print -u2 "a Warp paint did not keep the user's theme where ttheme off finds it, or did not mark the tab painted"; exit 1 }
  [[ $TTHEME_SPEC == "$TTHEME_PALETTE[kaito]" && "$(<$tab)" == "$(recorded miku kaito -)" ]] ||
    { print -u2 "a Warp tab did not record the palette it wears where tab switches read it: $(<$tab)"; exit 1 }
  forks_of __tt_apply "$TTHEME_PALETTE[homura]"
  (( REPLY == 0 )) || { print -u2 "a Warp paint forks again ($REPLY processes) — every preview hover pays it"; exit 1 }
  forks_of __tt_prompted
  (( REPLY == 0 )) || { print -u2 "a Warp prompt forks again ($REPLY processes)"; exit 1 }
  __tt_osc_reset
  [[ "$(<$TTHEME_WARP_SETTINGS)" == *"$(ours miku)"* && "$(<$tab)" == "$(recorded miku - -)" && -z ${TTHEME_PAINTED+x} ]] ||
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
  [[ "$(<$TTHEME_WARP_SETTINGS)" == *"$(ours homura)"* && "$(<$tab)" == "$(recorded miku kaito -)" ]] ||
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
  [[ "$(<$TTHEME_WARP_SETTINGS)" == *"$(ours kaito)"* && "$(<$tab)" == "$(recorded miku miku -)" ]] ||
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
  (( TTHEME_WARP_MIXED )) && __tt_warp_warming || { print -u2 "tabs of different palettes did not keep Warp's settings reload warm"; exit 1 }
  TTHEME_WARP_FAST=off
  __tt_warp_warming && { print -u2 "TTHEME_WARP_FAST=off still warmed Warp's settings reload"; exit 1 }
  TTHEME_WARP_FAST=on
  sum=$(shasum < $TTHEME_WARP_SETTINGS)
  zstat -F %s.%N -A was +mtime -- $TTHEME_WARP_SETTINGS
  sleep 0.01
  __tt_warp_prime
  zstat -F %s.%N -A at +mtime -- $TTHEME_WARP_SETTINGS
  [[ "$(shasum < $TTHEME_WARP_SETTINGS)" == "$sum" && $at[1] != "$was[1]" ]] ||
    { print -u2 "warming Warp's settings reload changed the file, or left it untouched"; exit 1 }
  (
    TTHEME_WARP_TABS=$XDG_CONFIG_HOME/fwarpsame
    mkdir -p $TTHEME_WARP_TABS
    print -r -- "$alive miku - -" > $TTHEME_WARP_TABS/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    print -r -- "$alive miku miku -" > $TTHEME_WARP_TABS/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
    __tt_warp_mixed && { print -u2 "tabs that all show the default palette counted as different palettes"; exit 1 }
    rm -rf $TTHEME_WARP_TABS
  ) || exit 1
  sqlite3 $TTHEME_WARP_DB 'update app set active_window_id = 2; update windows set active_tab_index = 1 where id = 2'
  __tt_warp_tick
  [[ "$(worn)" == "$(ours miku)" ]] || { print -u2 "a tab that wears no palette of its own did not get the default: $(worn)"; exit 1 }
  sqlite3 $TTHEME_WARP_DB 'update app set active_window_id = null'
  __tt_warp_tick
  [[ "$(<$TTHEME_WARP_TABS/.active)" == eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee ]] || { print -u2 "Warp going to the background moved the front tab"; exit 1 }
  print -r -- "$alive miku kaito -" > $TTHEME_WARP_TABS/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
  __tt_warp_tick
  [[ "$(worn)" == "$(ours kaito)" ]] || { print -u2 "a palette the front tab took did not follow: $(worn)"; exit 1 }
  (( TTHEME_WARP_WARM > EPOCHREALTIME )) || { print -u2 "a palette the front tab took did not warm Warp's settings reload for the next"; exit 1 }
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
(
  source $XDG_CONFIG_HOME/ttheme/adapters/ghostty.zsh
  TTHEME_TERMINALS=(ghostty) TTHEME_STARTUP=miku TTHEME_TMUX=0 TERM_PROGRAM_VERSION=1.3.2
  reloads=0 asks=$XDG_CONFIG_HOME/asks
  __tt_reload_ghostty() { (( ++reloads )) }
  mkdir -p $TTHEME_GHOSTTY_TABS $XDG_CONFIG_HOME/ttys
  sleep 30 >/dev/null 2>&1 &
  alive=$!
  for t in a b c; do
    : > $XDG_CONFIG_HOME/ttys/$t
    touch -a -t 203001010000 $XDG_CONFIG_HOME/ttys/$t
    __tt_ghostty_key $XDG_CONFIG_HOME/ttys/$t
    typeset key$t=$REPLY
  done
  ttya=$XDG_CONFIG_HOME/ttys/a ttyb=$XDG_CONFIG_HOME/ttys/b ttyc=$XDG_CONFIG_HOME/ttys/c
  print -r -- "$alive miku kagami $ttya" > $TTHEME_GHOSTTY_TABS/$keya
  print -r -- "$alive miku rei $ttyb" > $TTHEME_GHOSTTY_TABS/$keyb
  print -r -- "$alive miku - $ttyc" > $TTHEME_GHOSTTY_TABS/$keyc
  print -r -- "config-file = ?rei.conf" >| $bgd/shown.conf
  answer() { print -r -- "$*" >| $XDG_CONFIG_HOME/answer }
  osascript() { print >> $asks; print -r -- "$(<$XDG_CONFIG_HOME/answer)" }
  shown() { print -r -- "$(<$bgd/shown.conf)" }
  answer 1 $ttya 999
  __tt_ghostty_check || { print -u2 "the follower went blind on a Ghostty that names the terminal in front"; exit 1 }
  [[ "$(shown)" == "config-file = ?kagami.conf" && $reloads == 1 && $TTHEME_GHOSTTY_FRONT == $keya && $TTHEME_GHOSTTY_IDLE == 0 ]] ||
    { print -u2 "the follower did not put up the picture of a busy tab in front: $(shown) reloads=$reloads front=$TTHEME_GHOSTTY_FRONT idle=$TTHEME_GHOSTTY_IDLE"; exit 1 }
  __tt_ghostty_check
  (( reloads == 1 )) || { print -u2 "the follower reloaded Ghostty with the right picture already up"; exit 1 }
  answer 1 $ttyb $alive
  __tt_ghostty_check
  [[ "$(shown)" == "config-file = ?rei.conf" && $reloads == 2 && $TTHEME_GHOSTTY_IDLE == 1 ]] ||
    { print -u2 "the follower left another tab's picture over a tab at its prompt in front: $(shown) reloads=$reloads"; exit 1 }
  answer 0 $ttya 999
  __tt_ghostty_check
  [[ "$(shown)" == "config-file = ?rei.conf" && -z $TTHEME_GHOSTTY_FRONT ]] ||
    { print -u2 "the follower moved the picture while Ghostty was behind another app: $(shown)"; exit 1 }
  answer 1 $ttyc 999
  __tt_ghostty_check
  answer 1 /dev/ttys999 999
  __tt_ghostty_check
  [[ "$(shown)" == "config-file = ?rei.conf" && $reloads == 2 ]] ||
    { print -u2 "a tab that wears no palette, or no ttheme at all, moved the picture: $(shown)"; exit 1 }
  TTHEME_STARTUP=
  answer 1 $ttya 999
  __tt_ghostty_check
  [[ "$(shown)" == "config-file = ?rei.conf" ]] || { print -u2 "a busy tab painted before ttheme went off put its picture back up: $(shown)"; exit 1 }
  TTHEME_STARTUP=miku
  osascript() {
    print >> $asks
    if [[ ! -e $XDG_CONFIG_HOME/claimed ]]; then
      : > $XDG_CONFIG_HOME/claimed
      print -r -- "config-file = ?kagami.conf" >| $bgd/shown.conf
      touch -t 203201010000 $bgd/shown.conf
      print -r -- "1 $ttya 999"
    else
      print -r -- "1 $ttyb $alive"
    fi
  }
  : > $asks
  __tt_ghostty_check
  [[ "$(shown)" == "config-file = ?rei.conf" && $(wc -l < $asks) -eq 2 ]] ||
    { print -u2 "the follower acted on an answer a tab's own claim made stale: $(shown), asked $(wc -l < $asks) times"; exit 1 }
  osascript() { print >> $asks; print -r -- "$(<$XDG_CONFIG_HOME/answer)" }
  answer blind
  __tt_ghostty_check && { print -u2 "the follower kept going on a Ghostty that cannot name the terminal in front"; exit 1 }
  [[ "$(<$TTHEME_GHOSTTY_TABS/.blind)" == 1.3.2 ]] || { print -u2 "a blind Ghostty was not remembered by its version"; exit 1 }
  rm -f $TTHEME_GHOSTTY_TABS/.blind
  answer none
  for i in {1..6}; do __tt_ghostty_check || { print -u2 "the follower gave up after $i answers naming no terminal within seconds"; exit 1 }; done
  [[ ! -e $TTHEME_GHOSTTY_TABS/.blind ]] || { print -u2 "a few seconds of answers naming no terminal marked Ghostty blind"; exit 1 }
  TTHEME_GHOSTTY_NONE_AT=$(( EPOCHREALTIME - 31 ))
  __tt_ghostty_check && { print -u2 "the follower kept asking a Ghostty that named no terminal for half a minute"; exit 1 }
  rm -f $TTHEME_GHOSTTY_TABS/.blind
  TTHEME_GHOSTTY_NONE=0
  answer gone
  __tt_ghostty_check && { print -u2 "a follower kept going after its Ghostty quit"; exit 1 }
  sleep 0 &
  dead=$!
  wait $dead
  answer none
  TTHEME_GHOSTTY_PID=$dead TTHEME_GHOSTTY_NONE=4 TTHEME_GHOSTTY_NONE_AT=$(( EPOCHREALTIME - 60 ))
  __tt_ghostty_check && { print -u2 "a follower kept asking after its Ghostty quit"; exit 1 }
  [[ ! -e $TTHEME_GHOSTTY_TABS/.blind ]] || { print -u2 "a Ghostty that quit was remembered as blind"; exit 1 }
  TTHEME_GHOSTTY_PID= TTHEME_GHOSTTY_NONE=0
  answer 1 $ttya 999
  TTHEME_GHOSTTY_SEEN=() TTHEME_GHOSTTY_RUN=() TTHEME_GHOSTTY_BLUR="" TTHEME_GHOSTTY_ASKED=0 TTHEME_GHOSTTY_WANT=0 TTHEME_GHOSTTY_HUSH=0 TTHEME_GHOSTTY_NONE=0
  TTHEME_GHOSTTY_FRONT=$keyb TTHEME_GHOSTTY_IDLE=1
  print -r -- "config-file = ?rei.conf" >| $bgd/shown.conf
  : > $asks
  __tt_ghostty_tick
  [[ ! -s $asks ]] || { print -u2 "the follower asked Ghostty before any tab took input"; exit 1 }
  touch -a -t 203301010000 $ttya
  __tt_ghostty_tick
  [[ $(wc -l < $asks) -eq 1 && "$(shown)" == "config-file = ?kagami.conf" ]] ||
    { print -u2 "a busy tab behind that took input — the focus report a switch to it sends — did not bring its picture up: $(shown)"; exit 1 }
  : > $asks
  TTHEME_GHOSTTY_ASKED=0
  touch -a -t 203302010000 $ttya
  __tt_ghostty_tick
  [[ ! -s $asks && $TTHEME_GHOSTTY_HUSH != 0 ]] || { print -u2 "typing into the busy tab in front made the follower ask at once"; exit 1 }
  TTHEME_GHOSTTY_HUSH=$(( EPOCHREALTIME - 0.5 ))
  __tt_ghostty_tick
  [[ $(wc -l < $asks) -eq 1 ]] ||
    { print -u2 "a busy tab in front that went quiet after taking input was not checked — a switch to a tab that reports no focus would be missed"; exit 1 }
  : > $asks
  TTHEME_GHOSTTY_IDLE=1 TTHEME_GHOSTTY_FRONT=$keya TTHEME_GHOSTTY_ASKED=$(( EPOCHREALTIME - 5 ))
  touch -a -t 203302020000 $ttya
  __tt_ghostty_tick
  TTHEME_GHOSTTY_HUSH=$(( EPOCHREALTIME - 0.5 ))
  __tt_ghostty_tick
  [[ ! -s $asks ]] || { print -u2 "typing at the prompt of the tab in front made the follower ask within 10 s of its last question"; exit 1 }
  TTHEME_GHOSTTY_ASKED=$(( EPOCHREALTIME - 11 ))
  __tt_ghostty_tick
  [[ $(wc -l < $asks) -eq 1 ]] ||
    { print -u2 "a tab in front last seen at its prompt was never checked again — a program started there would hide a switch to a tab that reports no focus"; exit 1 }
  : > $TTHEME_GHOSTTY_TABS/.blur
  TTHEME_GHOSTTY_ASKED=0
  __tt_ghostty_tick
  : > $asks
  touch -t 203303010000 $TTHEME_GHOSTTY_TABS/.blur
  TTHEME_GHOSTTY_ASKED=0
  __tt_ghostty_tick
  [[ $(wc -l < $asks) -eq 1 ]] || { print -u2 "a tab at its prompt losing focus did not make the follower ask which tab took it"; exit 1 }
  : > $asks
  for i in {1..7}; do
    TTHEME_GHOSTTY_ASKED=0
    touch -a -t 20340101000$i $ttyc
    __tt_ghostty_tick
  done
  [[ $(wc -l < $asks) -eq 4 ]] || { print -u2 "a tab behind that reads its input all the time kept the follower asking: $(wc -l < $asks) times"; exit 1 }
  __tt_ghostty_live || { print -u2 "the follower found no live tab"; exit 1 }
  kill $alive
  wait $alive 2>/dev/null
  __tt_ghostty_live && { print -u2 "the follower kept going with every tab closed"; exit 1 }
  [[ -z $(print -r $TTHEME_GHOSTTY_TABS/[^.]*(N)) ]] || { print -u2 "the follower left closed tabs behind"; exit 1 }
  rm -rf $TTHEME_GHOSTTY_TABS $XDG_CONFIG_HOME/ttys
) || exit 1
(
  source $XDG_CONFIG_HOME/ttheme/adapters/ghostty.zsh
  __tt_ghostty_modules
  TTHEME_TERMINALS=(ghostty) TTHEME_STARTUP=miku TTHEME_TMUX=0 TTHEME_FRONT=1 TERM_PROGRAM_VERSION=1.3.2
  reloads=0 asks=$XDG_CONFIG_HOME/asks
  __tt_reload_ghostty() { (( ++reloads )) }
  mkdir -p $TTHEME_GHOSTTY_TABS $XDG_CONFIG_HOME/ttys
  sleep 30 >/dev/null 2>&1 &
  alive=$!
  : > $XDG_CONFIG_HOME/ttys/a
  ttya=$XDG_CONFIG_HOME/ttys/a
  __tt_ghostty_key $ttya
  keya=$REPLY
  print -r -- "$alive miku kagami $ttya" > $TTHEME_GHOSTTY_TABS/$keya
  print -r -- "config-file = ?rei.conf" >| $bgd/shown.conf
  __tt_ghostty_take "1 $ttya 999 $(( EPOCHREALTIME - 5 ))"
  [[ "$(<$bgd/shown.conf)" == "config-file = ?rei.conf" && $reloads == 0 ]] ||
    { print -u2 "the follower took a watcher's answer older than the last claim: $(<$bgd/shown.conf)"; exit 1 }
  __tt_ghostty_take "1 $ttya 999 $(( EPOCHREALTIME + 5 ))"
  [[ "$(<$bgd/shown.conf)" == "config-file = ?kagami.conf" && $reloads == 1 ]] ||
    { print -u2 "the follower did not take a watcher's answer made after the last claim: $(<$bgd/shown.conf) reloads=$reloads"; exit 1 }
  print -r -- "config-file = ?rei.conf" >| $bgd/shown.conf
  exec {TTHEME_GHOSTTY_WFD}< <(print -r -- "1 $ttya 999")
  zselect -t 200 -r $TTHEME_GHOSTTY_WFD
  __tt_ghostty_heard
  [[ "$(<$bgd/shown.conf)" == "config-file = ?kagami.conf" && $reloads == 2 ]] && (( TTHEME_GHOSTTY_TOLD > 0 )) ||
    { print -u2 "a line from the watcher did not put up its tab's picture: $(<$bgd/shown.conf) reloads=$reloads"; exit 1 }
  zselect -t 200 -r $TTHEME_GHOSTTY_WFD
  __tt_ghostty_heard
  (( TTHEME_GHOSTTY_WFD == 0 )) || { print -u2 "the follower kept reading a watcher that is gone"; exit 1 }
  osascript() { print >> $asks; print -r -- "1 $ttya 999" }
  : > $asks
  : > $TTHEME_GHOSTTY_TABS/.blur
  TTHEME_GHOSTTY_WFD=99 TTHEME_GHOSTTY_TOLD=$EPOCHREALTIME TTHEME_GHOSTTY_BLUR=x TTHEME_GHOSTTY_ASKED=0 TTHEME_GHOSTTY_WANT=0
  __tt_ghostty_tick
  [[ ! -s $asks ]] || { print -u2 "a tab losing focus made the follower ask right after the watcher named the tab in front"; exit 1 }
  TTHEME_GHOSTTY_FRONT=$keya TTHEME_GHOSTTY_IDLE=0 TTHEME_GHOSTTY_HUSH=$(( EPOCHREALTIME - 5 ))
  __tt_ghostty_tick
  [[ ! -s $asks ]] || { print -u2 "the follower asked about a quiet busy tab in front with a watcher running"; exit 1 }
  TTHEME_GHOSTTY_WFD=0
  __tt_ghostty_tick
  [[ -s $asks ]] || { print -u2 "without a watcher, a quiet busy tab in front was never checked"; exit 1 }
  TTHEME_GHOSTTY_CODE=1.0
  __tt_ghostty_tick && { print -u2 "a follower kept running on code that has changed since it started"; exit 1 }
  TTHEME_GHOSTTY_CODE=
  __tt_apply() { painted=$EPOCHREALTIME }
  __tt_reload_ghostty() { TTHEME_GHOSTTY_SENT=1; ( zselect -t 2; print -r -- $EPOCHREALTIME > $XDG_CONFIG_HOME/read; print -r -- "$(<$bgd/shown.conf)" > /dev/null ) & reader=$! }
  print -r -- "config-file = ?rei.conf" >| $bgd/shown.conf
  painted=0
  __tt_wear "$TTHEME_PALETTE[kagami]" kagami force || { print -u2 "__tt_wear did not claim a picture it changes"; exit 1 }
  wait $reader
  [[ "$(<$bgd/shown.conf)" == "config-file = ?kagami.conf" && $TTHEME_SPEC == "$TTHEME_PALETTE[kagami]" ]] ||
    { print -u2 "__tt_wear did not put the palette and its picture on: $(<$bgd/shown.conf)"; exit 1 }
  (( painted > $(<$XDG_CONFIG_HOME/read) )) ||
    { print -u2 "a palette was painted before Ghostty read the picture that goes with it"; exit 1 }
  __tt_reload_ghostty() { TTHEME_GHOSTTY_SENT=1 }
  print -r -- "config-file = ?rei.conf" >| $bgd/shown.conf
  start=$EPOCHREALTIME
  __tt_wear "$TTHEME_PALETTE[kagami]" kagami force
  (( painted - start < 1 )) || { print -u2 "a claim Ghostty never read held the palette back $(( painted - start )) s"; exit 1 }
  __tt_ghostty_took() { print -u2 "a palette whose picture is already up waited for Ghostty"; exit 1 }
  painted=0
  __tt_wear "$TTHEME_PALETTE[kagami]" kagami force && { print -u2 "__tt_wear reloaded with the picture already up"; exit 1 }
  (( painted )) || { print -u2 "a palette whose picture is already up was not painted"; exit 1 }
  TTHEME_FRONT=0
  print -r -- "config-file = ?rei.conf" >| $bgd/shown.conf
  __tt_wear "$TTHEME_PALETTE[kagami]" && { print -u2 "a pin reached behind took the picture"; exit 1 }
  [[ "$(<$bgd/shown.conf)" == "config-file = ?rei.conf" ]] || { print -u2 "a pin reached behind moved the picture: $(<$bgd/shown.conf)"; exit 1 }
  kill $alive
  wait $alive 2>/dev/null
  rm -rf $TTHEME_GHOSTTY_TABS $XDG_CONFIG_HOME/ttys $XDG_CONFIG_HOME/read $asks
) || exit 1
print "shell layer ok — ${#TTHEME_PALETTE} palettes, adapter=$adapter"
