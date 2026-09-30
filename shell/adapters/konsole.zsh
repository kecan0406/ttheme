__tt_paints() { (( ${TTHEME_TERMINALS[(Ie)konsole]} )) }

__tt_unpainted() {
  print -u2 "ttheme: Konsole draws a palette's 16 colors only from the color schemes init writes — wire it with \`npx @kecan0406/ttheme@latest init\`"
}

__tt_keepable() { __tt_paints }

__tt_takes_default() { __tt_osc_reset }

__tt_reverts() { return 1 }

__tt_follows_focus() { return 0 }

__tt_scheme() {
  local -a p=(${=TTHEME_PALETTE[$1]})
  REPLY="ColorScheme=ttheme-${${1/@/--}/\//--};UseCustomCursorColor=true;customCursorColor=$p[3]"
}

__tt_osc_apply() {
  local -a p=(${=1})
  (( ${#p} >= 20 )) || return 1
  local REPLY
  __tt_name_of "$1"
  if __tt_paints && [[ -n ${TTHEME_PALETTE[$REPLY]} ]]; then
    __tt_scheme $REPLY
    __tt_out $'\e]50;'$REPLY$'\a'
  elif [[ $p[1] == - ]]; then
    __tt_out $'\e]10;'$p[2]$'\e\\'
  else
    __tt_out $'\e]11;'$p[1]$'\e\\\e]10;'$p[2]$'\e\\'
  fi
  export TTHEME_PAINTED=1
  (( TTHEME_TMUX )) && tmux set -q @ttheme_bg "$p[1]" 2>/dev/null
  __tt_worn "$1"
  return 0
}

__tt_osc_reset() {
  local REPLY=$TTHEME_KONSOLE_BASE
  if __tt_paints; then
    [[ -n $TTHEME_STARTUP && -n ${TTHEME_PALETTE[$TTHEME_STARTUP]} ]] && __tt_scheme $TTHEME_STARTUP
    __tt_out $'\e]50;'$REPLY$'\a'
  else
    __tt_out $'\e]110;\e\\\e]111;\e\\'
  fi
  unset TTHEME_PAINTED
  (( TTHEME_TMUX )) && tmux set -qu @ttheme_bg 2>/dev/null
  __tt_worn ""
  return 0
}
