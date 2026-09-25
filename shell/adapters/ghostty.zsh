source $TTHEME_HOME/adapters/_bg.zsh

__tt_keepable() { return 0 }

__tt_bg_shown() { __tt_ghostty_shown }

__tt_reset_reloaded() {
  local REPLY
  integer i
  __tt_osc_reset
  [[ -n $1 ]] && (( ${TTHEME_TERMINALS[(Ie)ghostty]} && ! TTHEME_TMUX )) || return 0
  for (( i = 0; i < 20; i++ )); do
    __tt_query_bg || return 0
    [[ ${(L)REPLY} == ${(L)1} ]] || return 0
    sleep 0.05
    __tt_osc_reset
  done
}

__tt_shown() {
  local dir=${TTHEME_CONFIG:h}/backgrounds was REPLY
  __tt_bg_shown
  was=$REPLY
  [[ $was == $1 ]] && return 1
  [[ -r $dir/${${1/@/--}/\//--}.conf || ( -n $was && -r $dir/${${was/@/--}/\//--}.conf ) ]] || return 1
  [[ -d $dir ]] || mkdir -p $dir || return 1
  __tt_put $dir/shown.conf "config-file = ?${${1/@/--}/\//--}.conf"
}

__tt_bg_cells() {
  local REPLY resp line v f
  local -i px=2 py=2 fs=0 sc=2
  for f in ${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/config; do
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
  __tt_ask $'\e_Ga=t,f=24,s=1,v=1,i=1,q=2;AAAA\e\\\e_Ga=p,i=1,p=9,P=999998,Q=1,C=1,q=1\e\\\e_Ga=d,d=i,i=1,p=9,q=2\e\\\e[16t' || return 0
  resp=$REPLY
  [[ $resp == *'[6;'<1->';'<1->t ]] || return 0
  [[ $resp == *$'\e_G'*';E'* ]] && bgrel=1
  resp=${${resp##*\[6;}%t}
  bgch=${resp%;*} bgcw=${resp#*;}
  (( fs && bgch * 10 < fs * 20 )) && sc=1
  (( bgrel )) || return 0
  bgmx=$(( (px * sc + bgcw - 1) / bgcw + 1 )) bgmy=$(( (py * sc + bgch - 1) / bgch + 1 ))
}

__tt_bg_crop() {
  __tt_bg_send $1
  REPLY="$REPLY $4"
}
