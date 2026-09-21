sb_color() {
  local q resp="" c fd saved
  case $1 in
    bg) q=11 ;;
    fg) q=10 ;;
    cursor) q=12 ;;
    <0-255>) q="4;$1" ;;
    *) print -u2 "sb_color: bg, fg, cursor or 0-255"; return 1 ;;
  esac
  exec {fd}<>/dev/tty || return 1
  saved=$(stty -g <&$fd)
  stty raw -echo min 0 time 10 <&$fd
  printf '\e]%s;?\e\\' $q >&$fd
  while IFS= read -r -k 1 -u $fd c; do
    resp+=$c
    [[ $resp == *$'\e\\' || $resp == *$'\a' ]] && break
    (( ${#resp} < 64 )) || break
  done
  stty $saved <&$fd
  exec {fd}>&-
  local -a p=(${(s:/:)${${resp#*rgb:}%%[^0-9A-Fa-f/]*}})
  print -r -- "#${(L)p[1][1,2]}${(L)p[2][1,2]}${(L)p[3][1,2]}"
}

__sb_ask() {
  local c fd saved
  REPLY=""
  exec {fd}<>/dev/tty || return 1
  saved=$(stty -g <&$fd)
  stty raw -echo min 0 time ${2:-10} <&$fd
  printf '%s\e[5n' "$1" >&$fd
  while IFS= read -r -k 1 -u $fd c; do
    REPLY+=$c
    [[ $REPLY == *$'\e[0n' ]] && break
    (( ${#REPLY} < 4096 )) || break
  done
  stty $saved <&$fd
  exec {fd}>&-
  REPLY=${REPLY%$'\e[0n'}
}

sb_query() {
  local REPLY
  __sb_ask "$1" || return 1
  print -r -- "${(V)REPLY}"
}

sb_report() { print -r -- "$*" >> ${ZDOTDIR:-$HOME}/run.out }

sb_shot() {
  local dir=${ZDOTDIR:-$HOME}/shots i
  mkdir -p $dir
  : > $dir/$1.req
  for i in {1..100}; do
    [[ -e $dir/$1.done ]] && return 0
    [[ -e $dir/$1.skip ]] && { print -u2 "sb_shot $1: no screenshot — the driver runs without --shots"; return 1 }
    sleep 0.1
  done
  print -u2 "sb_shot $1: the driver never took it"
  return 1
}

__sb_run() {
  precmd_functions=(${precmd_functions:#__sb_run})
  local dir=${ZDOTDIR:-$HOME} s REPLY
  (( $+functions[__sb_tab_run] )) && __sb_tab_run && return
  [[ -e $dir/run.started ]] && return
  : > $dir/run.started
  __sb_commands 2>> $dir/run.err
  s=$?
  if (( $+functions[__tt_name_of] )); then
    __tt_name_of "$TTHEME_SPEC"
    sb_report "palette   $REPLY"
    sb_report "installed ${(@ok)TTHEME_PALETTE}"
  fi
  sb_report "bg        $(sb_color bg)"
  print -r -- $s > $dir/run.status
}

precmd_functions+=(__sb_run)
