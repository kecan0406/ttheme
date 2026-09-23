export XDG_CONFIG_HOME=$(mktemp -d)
trap "rm -rf $XDG_CONFIG_HOME" EXIT
mkdir -p $XDG_CONFIG_HOME/ttheme
cp -R shell/ttheme.zsh shell/adapters dist/shell/palettes.zsh $XDG_CONFIG_HOME/ttheme/
source $XDG_CONFIG_HOME/ttheme/ttheme.zsh
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
typeset -A bgfrom=() bgsrc=() bgfill=() bgfocus=() bgsize=() bgpos=() bgop=() bgdef=() bgoff=() bgbase=() bgload=() bgshot=() bgshotkey=() bgdim=()
bgd=$XDG_CONFIG_HOME/ttheme/backgrounds
mkdir -p $bgd && : > $bgd/kagami@fill-42.png && : > $bgd/kagami@60-bottom-right.png && : > $bgd/kagami@130-bottom-right-1600x1000.png
base=("# from safebooru 416805 https://safebooru.org/index.php?page=post&s=view&id=416805" "background-image = kagami@fill-42.png" "background-image-fit = cover" "background-image-opacity = 0.2")
print -l $base > $bgd/kagami.conf
print -l "background-image = kagami@130-bottom-right-1600x1000.png" "background-image-fit = cover" "background-image-position = bottom-right" "background-image-opacity = 0.252" > $bgd/kagami.tune.conf
__tt_bg_load kagami
[[ $bgsrc[kagami] == "$bgd/kagami.png" && $bgfill[kagami] == "$bgd/kagami@fill-42.png" && $bgfocus[kagami] == 42 && $bgsize[kagami] == 130 && $bgpos[kagami] == 9 && $bgop[kagami] == 0.252 &&
  $bgshot[kagami] == "$bgd/kagami@130-bottom-right-1600x1000.png" && $bgdef[kagami] == "fill 5 0.2" && $bgoff[kagami] == 0 &&
  $bgfrom[kagami] == "safebooru 416805" ]] ||
  { print -u2 "__tt_bg_load misread the confs: $bgsrc[kagami] $bgfill[kagami]@$bgfocus[kagami] $bgsize[kagami] $bgpos[kagami] $bgop[kagami] $bgshot[kagami] ($bgdef[kagami]) off=$bgoff[kagami] from=$bgfrom[kagami]"; exit 1 }
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
[[ "$(<$TTHEME_CONFIG)" == "$TTHEME_CONFIG_TEMPLATE" ]] || { print -u2 "config seed drifted from the template"; exit 1 }
reloads=0
__tt_reload() { (( ++reloads )) }
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
[[ "$(__tt_precmd)" == $'\e[?1004h' && "$(__tt_preexec)" == $'\e[?1004l' ]] ||
  { print -u2 "the prompt did not turn focus reporting on and off"; exit 1 }
__tt_bg_saved kagami
(( reloads == 5 )) || { print -u2 "saving a picture Ghostty does not show reloaded it: reloads=$reloads"; exit 1 }
__tt_bg_saved kagami rei
(( reloads == 6 )) || { print -u2 "saving the picture Ghostty shows did not reload it: reloads=$reloads"; exit 1 }
bgsrc=(); __tt_bg_load homura; bgsize[homura]=60
__tt_bg_write homura && [[ ! -e $bgd/homura.conf ]] || { print -u2 "tuning a palette with no picture left a conf behind"; ls $bgd; exit 1 }
mkdir -p $bgd/shelf/kagami/a $bgd/shelf/kagami/b
bgcw=8 tune=kagami tf=1 help=0 pick= conf=0 msgt=0 flt= color=0
out=; __tt_pv_foot 80
[[ $out == *"f find"* ]] || { print -u2 "a TUNE bar with several images dropped the find key: $out"; exit 1 }
msg=${(l:200::x:)} msgt=100 out=; __tt_pv_foot 80
plain=${out//$'\e[K'/}
(( ${(m)#plain} <= 80 )) || { print -u2 "a long preview message overran the bar: ${(m)#plain} columns"; exit 1 }
proj=$XDG_CONFIG_HOME/proj
mkdir -p $proj/sub/deep $proj-sibling
ln -s $proj/sub $XDG_CONFIG_HOME/link
cd $proj
__tt_pin_save homura 2 "$TTHEME_PALETTE[miku]" > /dev/null || { print -u2 "__tt_pin_save failed"; exit 1 }
cd $proj/sub
__tt_pin_save kaito 1 "$TTHEME_PALETTE[miku]" > /dev/null || { print -u2 "__tt_pin_save (exact) failed"; exit 1 }
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
print "shell layer ok — ${#TTHEME_PALETTE} palettes, adapter=$adapter"
