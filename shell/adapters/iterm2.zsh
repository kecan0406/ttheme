source $TTHEME_HOME/adapters/_bg.zsh

if (( ! ${+TTHEME_ITERM_SHOWN} )); then
  typeset -gx TTHEME_ITERM_SHOWN=""
  [[ $ITERM_PROFILE == 'ttheme · '* ]] && TTHEME_ITERM_SHOWN=${ITERM_PROFILE#ttheme · }
fi

__tt_keepable() { return 0 }

__tt_bg_shown() {
  REPLY=$TTHEME_ITERM_SHOWN
  [[ $REPLY == default ]] && REPLY=$TTHEME_STARTUP
  [[ -n $REPLY ]]
}

__tt_shown() {
  local dir=${TTHEME_CONFIG:h}/backgrounds was REPLY
  __tt_bg_shown
  was=$REPLY
  [[ $2 != force && $was == $1 ]] && return 1
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

__tt_bg_crop() {
  local img=$1 band
  local -i iw=$2 ih=$3 y=$4 h=$5 d=$(( 2 * $4 + $5 - $3 ))
  if (( d * d <= 1 || ! $+commands[sips] )); then
    __tt_bg_send $img
    REPLY="$REPLY $y"
    return 0
  fi
  [[ -n $bgcut ]] || bgcut=$(mktemp -d) || return 1
  band=$bgcut/${${img:t}%.png}-$y-$h.png
  if [[ ! -r $band ]]; then
    if (( y )); then
      sips -c $h $iw --cropOffset $y 0 $img --out $band >/dev/null 2>&1 || return 1
    else
      sips -p $(( ih + 2 )) $(( iw + 2 )) $img --out $bgcut/pad.png >/dev/null 2>&1 &&
        sips -c $h $iw --cropOffset 1 1 $bgcut/pad.png --out $band >/dev/null 2>&1 || return 1
    fi
  fi
  printf '\e_Ga=t,t=f,f=100,i=999997,q=2;%s\e\\' "$(print -rn -- $band | base64 | tr -d '\n')"
  REPLY="999997 0"
}
