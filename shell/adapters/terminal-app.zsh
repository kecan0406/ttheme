typeset -g TTHEME_TERMINAL_BASE=""

__tt_terminal_base() {
  local fd saved resp="" c q=$'\e]11;?\e\\\e]10;?\e\\\e]12;?\e\\\e]17;?\e\\' e v i
  local -a p
  local -A got
  for i in {0..15}; do q+=$'\e]4;'$i$';?\e\\'; done
  exec {fd}<>/dev/tty 2>/dev/null || return 1
  saved=$(stty -g <&$fd 2>/dev/null)
  [[ -n $saved ]] || { exec {fd}>&-; return 1 }
  stty raw -echo min 0 time 3 <&$fd 2>/dev/null
  printf '%s\e[5n' $q >&$fd
  while IFS= read -r -k 1 -u $fd c 2>/dev/null; do
    resp+=$c
    [[ $resp == *$'\e[0n' ]] && break
    (( ${#resp} < 2048 )) || break
  done
  stty "$saved" <&$fd 2>/dev/null
  exec {fd}>&-
  for e in ${(ps:\e]:)resp}; do
    [[ $e == *';rgb:'* ]] || continue
    p=(${(s:/:)${${e#*rgb:}%%[^0-9A-Fa-f/]*}})
    (( ${#p} >= 3 )) && got[${e%%;rgb:*}]="#${(L)p[1][1,2]}${(L)p[2][1,2]}${(L)p[3][1,2]}"
  done
  v="$got[11] $got[10] $got[12] ${got[17]:-$got[11]}"
  for i in {0..15}; do v+=" ${got[4;$i]}"; done
  (( ${#${=v}} == 20 )) && TTHEME_TERMINAL_BASE=$v
}

__tt_osc_reset() {
  [[ -n $TTHEME_TERMINAL_BASE ]] && __tt_osc_apply "$TTHEME_TERMINAL_BASE"
  return 0
}

[[ -o interactive && -t 1 ]] && __tt_terminal_base
