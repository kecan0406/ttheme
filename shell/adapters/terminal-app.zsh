typeset -g TTHEME_TERMINAL_BASE=""

__tt_hear() {
  local resp q=$'\e]11;?\e\\\e]10;?\e\\\e]12;?\e\\\e]17;?\e\\' e v i
  local -a p
  local -A got
  for i in {0..15}; do q+=$'\e]4;'$i$';?\e\\'; done
  __tt_ask $q || return 1
  resp=$REPLY
  REPLY=""
  for e in ${(ps:\e]:)resp}; do
    [[ $e == *';rgb:'* ]] || continue
    p=(${(s:/:)${${e#*rgb:}%%[^0-9A-Fa-f/]*}})
    (( ${#p} >= 3 )) && got[${e%%;rgb:*}]="#${(L)p[1][1,2]}${(L)p[2][1,2]}${(L)p[3][1,2]}"
  done
  v="$got[11] $got[10] $got[12] ${got[17]:-$got[11]}"
  for i in {0..15}; do v+=" ${got[4;$i]}"; done
  (( ${#${=v}} == 20 )) || return 1
  REPLY=$v
}

__tt_heard() { TTHEME_TERMINAL_BASE=$1 }

__tt_osc_reset() {
  [[ -n $TTHEME_TERMINAL_BASE ]] && __tt_osc_apply "$TTHEME_TERMINAL_BASE"
  unset TTHEME_PAINTED
  return 0
}

[[ -o interactive && -t 1 ]] && __tt_listen
