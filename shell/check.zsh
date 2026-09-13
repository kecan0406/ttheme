export XDG_CONFIG_HOME=$(mktemp -d)
trap "rm -rf $XDG_CONFIG_HOME" EXIT
source shell/ttheme.zsh
(( ${#TTHEME_PALETTE} > 0 )) || { print -u2 "no palettes loaded"; exit 1 }
(( ${#TTHEME_ORDER} + 1 == ${#TTHEME_PALETTE} )) || { print -u2 "order/palette mismatch"; exit 1 }
__tt_menu > /dev/null || exit 1
ttheme help > /dev/null || { print -u2 "ttheme help broke"; exit 1 }
ttheme -h > /dev/null || { print -u2 "ttheme -h broke"; exit 1 }
REPLY=; __tt_resolve ho || exit 1
[[ $REPLY == homura ]] || { print -u2 "prefix resolve broke: $REPLY"; exit 1 }
ttheme nosuchpalette 2>/dev/null && { print -u2 "ttheme took a bad name"; exit 1 }
out=$(ttheme city 2>&1) && { print -u2 "ttheme took a bad name"; exit 1 }
[[ $out == *"did you mean"*nightcity* ]] || { print -u2 "did-you-mean broke: $out"; exit 1 }
ttheme --frobnicate 2>/dev/null && { print -u2 "ttheme took an unknown option"; exit 1 }
out=$(ttheme preview </dev/null 2>&1) && { print -u2 "ttheme preview ran without a tty"; exit 1 }
[[ $out == *"needs a terminal"* ]] || { print -u2 "preview tty guard broke: $out"; exit 1 }
EDITOR=true ttheme config > /dev/null || { print -u2 "ttheme config broke"; exit 1 }
source shell/adapters/ghostty.zsh
killall() { :; }; pkill() { :; }
mkdir -p $XDG_CONFIG_HOME/ghostty
print -l "font-size = 14" "# ttheme begin" "theme = magi" "config-file = x" "# ttheme end" > $XDG_CONFIG_HOME/ghostty/config
__tt_persist homura || { print -u2 "__tt_persist failed"; exit 1 }
[[ "$(<$XDG_CONFIG_HOME/ghostty/config)" == "$(print -l "font-size = 14" "# ttheme begin" "theme = homura" "config-file = x" "# ttheme end")" ]] ||
  { print -u2 "__tt_persist rewrote the config wrong:"; cat $XDG_CONFIG_HOME/ghostty/config; exit 1 }
print "theme = magi" > $XDG_CONFIG_HOME/ghostty/config
__tt_persist homura 2>/dev/null && { print -u2 "__tt_persist touched a theme line outside the block"; exit 1 }
[[ "$(<$TTHEME_CONFIG)" == "$TTHEME_CONFIG_TEMPLATE" ]] || { print -u2 "config seed drifted from the template"; exit 1 }
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
print -l "~/proj-home/**  luka" "# comment" "" "$proj-sibling   rei" > $TTHEME_PINS_FILE
cd $proj-sibling; __tt_chpwd > /dev/null
[[ ${#TTHEME_PINS} == 2 && $TTHEME_PINS[$HOME/proj-home/**] == luka && $TTHEME_PIN == "$proj-sibling" ]] || { print -u2 "hand-written pins did not load on cd: ${(kv)TTHEME_PINS} pin=$TTHEME_PIN"; exit 1 }
cd $OLDPWD
print "shell layer ok — ${#TTHEME_PALETTE} palettes, adapter=$TTHEME_ADAPTER"
