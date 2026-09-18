sb_color() {
  local q resp="" c fd saved
  case $1 in
    bg) q=11 ;;
    fg) q=10 ;;
    cursor) q=12 ;;
    <0-15>) q="4;$1" ;;
    *) print -u2 "sb_color: bg, fg, cursor or 0-15"; return 1 ;;
  esac
  exec {fd}<>/dev/tty || return 1
  saved=$(stty -g <&$fd)
  stty raw -echo min 0 time 3 <&$fd
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

sb_report() { print -r -- "$*" >> ${ZDOTDIR:-$HOME}/run.out }

__sb_run() {
  precmd_functions=(${precmd_functions:#__sb_run})
  local dir=${ZDOTDIR:-$HOME} s REPLY
  [[ -e $dir/run.status ]] && return
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
