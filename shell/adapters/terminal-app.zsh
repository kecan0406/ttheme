typeset -g TTHEME_TERMINAL_BASE=""

__tt_hear() {
  local q=$'\e]11;?\e\\\e]10;?\e\\\e]12;?\e\\\e]17;?\e\\' v i
  local -A got
  for i in {0..15}; do q+=$'\e]4;'$i$';?\e\\'; done
  __tt_ask $q || return 1
  __tt_colors "$REPLY"
  REPLY=""
  v="$got[11] $got[10] $got[12] ${got[17]:-$got[11]}"
  for i in {0..15}; do v+=" ${got[4;$i]}"; done
  (( ${#${=v}} == 20 )) || return 1
  REPLY=$v
}

__tt_heard() { TTHEME_TERMINAL_BASE=$1 }

__tt_takes_default() { return 1 }

__tt_reverts() { return 1 }

__tt_osc_reset() {
  [[ -n $TTHEME_TERMINAL_BASE ]] && __tt_osc_apply "$TTHEME_TERMINAL_BASE"
  unset TTHEME_PAINTED
  return 0
}

() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  [[ -o interactive && -t 1 ]] && __tt_listen
}
