typeset -g TTHEME_GHOSTTY_PID=""

__tt_reload() {
  local pid=$PPID ppid comm
  if [[ -z $TTHEME_GHOSTTY_PID ]]; then
    TTHEME_GHOSTTY_PID=0
    while (( pid > 1 )); do
      read -r ppid comm <<< "$(ps -o ppid=,comm= -p $pid)"
      if [[ ${comm:t} == ghostty ]]; then
        TTHEME_GHOSTTY_PID=$pid
        break
      fi
      pid=$ppid
    done
  fi
  (( TTHEME_GHOSTTY_PID )) && kill -USR2 $TTHEME_GHOSTTY_PID 2>/dev/null && return
  pkill -USR2 -x ghostty 2>/dev/null
}

source $TTHEME_HOME/adapters/_bg.zsh

__tt_bg_shown() {
  local f=${TTHEME_CONFIG:h}/backgrounds/shown.conf
  REPLY=""
  [[ -r $f ]] || return 1
  REPLY=${${"$(<$f)"}##*\?}
  REPLY=${REPLY%.conf}
}

__tt_shown() {
  local dir=${TTHEME_CONFIG:h}/backgrounds was REPLY
  __tt_bg_shown
  was=$REPLY
  [[ $was == $1 ]] && return 1
  [[ -r $dir/$1.conf || ( -n $was && -r $dir/$was.conf ) ]] || return 1
  [[ -d $dir ]] || mkdir -p $dir || return 1
  print -r -- "config-file = ?$1.conf" > $dir/shown.conf
}

__tt_bg_cells() {
  local fd saved resp="" line c v f
  local -i px=2 py=2 fs=0 sc=2
  for f in ${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/config ${TTHEME_CONFIG:h}/ttheme.conf; do
    [[ -r $f ]] || continue
    for line in "${(@f)$(<$f)}"; do
      v=${${line#*=}// /}
      case $line in
        window-padding-x*=*) [[ $v == <->(|,<->) ]] && px=$(( ${v%%,*} > ${v##*,} ? ${v%%,*} : ${v##*,} )) ;;
        window-padding-y*=*) [[ $v == <->(|,<->) ]] && py=$(( ${v%%,*} > ${v##*,} ? ${v%%,*} : ${v##*,} )) ;;
        font-size*=*) [[ $v == <->(|.<->) ]] && fs=${v%%.*} ;;
      esac
    done
  done
  exec {fd}<>/dev/tty 2>/dev/null || return 0
  saved=$(stty -g <&$fd 2>/dev/null)
  stty raw -echo min 0 time 3 <&$fd 2>/dev/null
  printf '\e_Ga=t,f=24,s=1,v=1,i=1,q=2;AAAA\e\\\e_Ga=p,i=1,p=9,P=999998,Q=1,C=1,q=1\e\\\e_Ga=d,d=i,i=1,p=9,q=2\e\\\e[16t' >&$fd
  while IFS= read -r -s -k 1 -t 1 -u $fd c 2>/dev/null; do
    resp+=$c
    [[ $resp == *'[6;'<1->';'<1->t ]] && break
  done
  stty "$saved" <&$fd 2>/dev/null
  exec {fd}>&-
  [[ $resp == *'[6;'<1->';'<1->t ]] || return 0
  [[ $resp == *$'\e_G'*';E'* ]] && bgrel=1
  resp=${${resp##*\[6;}%t}
  bgch=${resp%;*} bgcw=${resp#*;}
  (( fs && bgch * 10 < fs * 20 )) && sc=1
  (( bgrel )) || return 0
  bgmx=$(( (px * sc + bgcw - 1) / bgcw + 1 )) bgmy=$(( (py * sc + bgch - 1) / bgch + 1 ))
}

__tt_bg_saved() {
  (( ${@[(Ie)$bginc]} )) && __tt_reload
  return 0
}
