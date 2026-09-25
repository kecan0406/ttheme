source $TTHEME_HOME/adapters/_bg.zsh

typeset -g TTHEME_KITTY_SHOWN=""

__tt_keepable() { (( ${TTHEME_TERMINALS[(Ie)kitty]} )) }

__tt_kitty_var() {
  local REPLY
  __tt_b64s "$2"
  __tt_out $'\e]1337;SetUserVar='$1'='$REPLY$'\a'
}

__tt_shown() {
  [[ $2 != force && $TTHEME_KITTY_SHOWN == $1 ]] && return 1
  TTHEME_KITTY_SHOWN=$1
  __tt_kitty_var ttheme_shown $1
  return 1
}

__tt_unshown() {
  TTHEME_KITTY_SHOWN=""
  __tt_kitty_var ttheme_shown ""
}

__tt_worn() {
  local REPLY=""
  [[ -n $1 ]] && __tt_name_of "$1"
  [[ -n ${TTHEME_PALETTE[$REPLY]} ]] || REPLY=""
  __tt_kitty_var ttheme_worn $REPLY
}

__tt_reloaded() { [[ -n $TTHEME_STARTUP ]] && __tt_kitty_var ttheme_startup $TTHEME_STARTUP }

__tt_bg_shown() { REPLY=$TTHEME_KITTY_SHOWN }

__tt_bg_refresh() { (( ${@[(Ie)$TTHEME_KITTY_SHOWN]} )) && __tt_kitty_var ttheme_shown $TTHEME_KITTY_SHOWN }

__tt_bg_cells() {
  local REPLY resp
  __tt_ask $'\e[16t' || return 0
  resp=$REPLY
  [[ $resp == *'[6;'<1->';'<1->t ]] || return 0
  resp=${${resp##*\[6;}%t}
  bgch=${resp%;*} bgcw=${resp#*;}
}

__tt_bg_crop() {
  __tt_bg_send $1
  REPLY="$REPLY $4"
}
