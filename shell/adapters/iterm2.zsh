source $TTHEME_HOME/adapters/_bg.zsh

if (( ! ${+TTHEME_ITERM_SHOWN} )); then
  typeset -gx TTHEME_ITERM_SHOWN=""
  case $ITERM_PROFILE in
    'ttheme · default') TTHEME_ITERM_SHOWN=$TTHEME_STARTUP ;;
    'ttheme · '*) TTHEME_ITERM_SHOWN=${ITERM_PROFILE#ttheme · } ;;
  esac
fi

__tt_keepable() { return 0 }

__tt_bg_shown() {
  REPLY=$TTHEME_ITERM_SHOWN
  [[ -n $REPLY ]]
}

__tt_shown() {
  local dir=${TTHEME_CONFIG:h}/backgrounds was=$TTHEME_ITERM_SHOWN
  [[ $was == $1 ]] && return 1
  [[ -r $dir/$1.conf || ( -n $was && -r $dir/$was.conf ) ]] || return 1
  (( ${TTHEME_ORDER[(Ie)$1]} )) || return 1
  printf '\e]1337;SetProfile=ttheme · %s\a' $1
  TTHEME_ITERM_SHOWN=$1
  return 1
}

__tt_bg_cells() {
  local fd saved resp="" c
  local -a p
  exec {fd}<>/dev/tty 2>/dev/null || return 0
  saved=$(stty -g <&$fd 2>/dev/null)
  stty raw -echo min 0 time 3 <&$fd 2>/dev/null
  printf '\e]1337;ReportCellSize\a' >&$fd
  while IFS= read -r -s -k 1 -t 1 -u $fd c 2>/dev/null; do
    resp+=$c
    [[ $resp == *ReportCellSize=*($'\a'|$'\e\\') ]] && break
  done
  stty "$saved" <&$fd 2>/dev/null
  exec {fd}>&-
  [[ $resp == *ReportCellSize=*($'\a'|$'\e\\') ]] || return 0
  p=(${(s:;:)${${resp##*ReportCellSize=}%%($'\a'|$'\e\\')*}})
  (( ${#p} == 3 )) || return 0
  bgch=${$(( p[1] * p[3] + 0.5 ))%.*} bgcw=${$(( p[2] * p[3] + 0.5 ))%.*}
}

__tt_bg_saved() { __tt_cli image $1 tuned }
