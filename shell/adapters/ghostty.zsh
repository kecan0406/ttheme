__tt_persist() {
  local f=${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/config name=$1
  [[ -r $f && -w $f ]] || return 1
  local -a lines=("${(@f)$(<$f)}")
  local i in=0 hit=0
  for (( i = 1; i <= ${#lines}; i++ )); do
    case ${lines[i]} in
      '# ttheme begin') in=1 ;;
      '# ttheme end') in=0 ;;
      'theme = '*|'theme='*) (( in )) && { lines[i]="theme = $name"; hit=1 } ;;
      'config-file = ?'*'/backgrounds/'*'.conf') (( in )) && lines[i]="${lines[i]%/*}/$name.conf" ;;
    esac
  done
  (( hit )) || return 1
  print -rl -- "${lines[@]}" > $f || return 1
  killall -USR2 ghostty 2>/dev/null || pkill -USR2 -x ghostty 2>/dev/null
  return 0
}

__tt_b64() {
  local t=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/ out="" i n
  local -a b=("$@")
  for (( i = 1; i <= ${#b}; i += 3 )); do
    n=$(( (b[i] << 16) | (${b[i+1]:-0} << 8) | ${b[i+2]:-0} ))
    out+=${t:$(( (n >> 18) & 63 )):1}${t:$(( (n >> 12) & 63 )):1}
    if (( i + 1 <= ${#b} )); then out+=${t:$(( (n >> 6) & 63 )):1}; else out+='='; fi
    if (( i + 2 <= ${#b} )); then out+=${t:$(( n & 63 )):1}; else out+='='; fi
  done
  REPLY=$out
}

__tt_bg_crop() {
  local -i iw=$1 ih=$2 W=$3 H=$4 sw=$1 sh=$2
  if (( W * ih >= H * iw )); then
    sh=$(( iw * H / W ))
  else
    sw=$(( ih * W / H ))
  fi
  REPLY="$(( (iw - sw) / 2 )) $(( (ih - sh) / 2 )) $sw $sh"
}

__tt_pv_bg_open() {
  bgcw=0 bgch=0
  local -a confs=(${TTHEME_CONFIG:h}/backgrounds/*.conf(N))
  (( ${#confs} )) || return 0
  local fd saved resp=""
  exec {fd}<>/dev/tty 2>/dev/null || return 0
  saved=$(stty -g <&$fd 2>/dev/null)
  stty raw -echo min 0 time 3 <&$fd 2>/dev/null
  printf '\e[16t' >&$fd
  IFS= read -r -s -t 1 -d t -u $fd resp 2>/dev/null
  stty "$saved" <&$fd 2>/dev/null
  exec {fd}>&-
  [[ $resp == *'[6;'<1->';'<1-> ]] || return 0
  resp=${resp##*\[6;}
  bgch=${resp%;*} bgcw=${resp#*;}
}

__tt_pv_bg_show() {
  (( bgcw )) || return 0
  local name=$1 conf=${TTHEME_CONFIG:h}/backgrounds/$1.conf img="" op=1 line REPLY
  local -a p=(${=TTHEME_PALETTE[$name]}) d wh xy
  (( ${#p} >= 20 )) || return 0
  (( $2 )) && { bgsent=(); bgshown="" }
  bgname=$name
  if [[ -r $conf ]]; then
    for line in "${(@f)$(<$conf)}"; do
      case $line in
        'background-image = '*|'background-image='*) img=${${line#*=}# } ;;
        'background-image-opacity = '*|'background-image-opacity='*) op=${${line#*=}# } ;;
      esac
    done
  fi
  img=${${img#\"}%\"}
  img=${img/#\~\//$HOME/}
  [[ -z $img || $img == /* ]] || img=${conf:h}/$img
  [[ $op == <->(|.<->) ]] || op=1
  local bg=${p[1]#\#}
  local -i r=$(( 16#${bg:0:2} )) g=$(( 16#${bg:2:2} )) b=$(( 16#${bg:4:2} )) a=$(( (1.0 - op) * 255 + 0.5 ))
  (( a < 0 )) && a=0
  __tt_b64 $r $g $b
  printf '\e_Ga=t,f=24,s=1,v=1,i=1,q=2;%s\e\\\e[H\e_Ga=p,i=1,p=1,c=%d,r=%d,C=1,z=-1073741827,q=2\e\\' "$REPLY" $pw $ph
  if [[ -r $img && -z ${bgdim[$img]} ]]; then
    d=($(od -An -N24 -tu1 -- $img 2>/dev/null))
    if (( ${#d} == 24 && d[1] == 137 && d[2] == 80 && d[3] == 78 && d[4] == 71 )); then
      bgdim[$img]="$(( (d[17] << 24) | (d[18] << 16) | (d[19] << 8) | d[20] )) $(( (d[21] << 24) | (d[22] << 16) | (d[23] << 8) | d[24] ))"
    else
      bgdim[$img]=-
    fi
  fi
  [[ -r $img && ${bgdim[$img]} != - ]] || img=""
  if [[ -n $bgshown && $bgshown != "$img" ]]; then
    printf '\e_Ga=d,d=i,i=%d,q=2\e\\' ${bgsent[$bgshown]}
    bgshown=""
  fi
  if [[ -n $img ]]; then
    if [[ -z ${bgsent[$img]} ]]; then
      bgsent[$img]=$(( ${#bgsent} + 3 ))
      printf '\e_Ga=t,t=f,f=100,i=%d,q=2;%s\e\\' ${bgsent[$img]} "$(print -rn -- $img | base64 | tr -d '\n')"
    fi
    wh=(${=bgdim[$img]})
    __tt_bg_crop $wh[1] $wh[2] $(( pw * bgcw )) $(( ph * bgch ))
    xy=(${=REPLY})
    printf '\e[H\e_Ga=p,i=%d,p=1,x=%d,y=%d,w=%d,h=%d,c=%d,r=%d,C=1,z=-1073741826,q=2\e\\' \
      ${bgsent[$img]} $xy[1] $xy[2] $xy[3] $xy[4] $pw $ph
    bgshown=$img
  fi
  __tt_b64 $r $g $b $a
  printf '\e_Ga=t,f=32,s=1,v=1,i=2,q=2;%s\e\\\e[H\e_Ga=p,i=2,p=1,c=%d,r=%d,C=1,z=-1073741825,q=2\e\\' "$REPLY" $pw $ph
}

__tt_pv_bg_close() {
  (( bgcw )) && printf '\e_Ga=d,d=A,q=2\e\\'
}
