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

typeset -ga TTHEME_BG_POSITIONS=(top-left top-center top-right center-left center center-right bottom-left bottom-center bottom-right)

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

__tt_bg_frame() {
  local -i iw=$1 ih=$2 W=$3 H=$4 s=$5 ax=$(( ($6 - 1) % 3 )) ay=$(( ($6 - 1) / 3 )) f=${8:--1} wide dw dh ox oy
  wide=$(( W * ih >= H * iw ))
  [[ $7 == contain ]] && wide=$(( ! wide ))
  if (( wide )); then
    dw=$(( s * W / 100 )) dh=$(( s * W * ih / (100 * iw) ))
  else
    dh=$(( s * H / 100 )) dw=$(( s * H * iw / (100 * ih) ))
  fi
  ox=$(( ax * (W - dw) / 2 )) oy=$(( ay * (H - dh) / 2 ))
  if (( f >= 0 )); then
    (( dw > W )) && ox=$(( (W - dw) / 2 ))
    if (( dh > H )); then
      oy=$(( H / 2 - f * dh / 100 ))
      (( oy > 0 )) && oy=0
      (( oy < H - dh )) && oy=$(( H - dh ))
    fi
  fi
  REPLY="$dw $dh $ox $oy"
}

__tt_bg_place() {
  local -i cw=$5 ch=$6 W=$(( $3 * $5 )) H=$(( $4 * $6 )) dw dh sx sy c0 c1 r0 r1
  local -a fr
  __tt_bg_frame $1 $2 $W $H $7 $8 $9 ${10:--1}
  fr=(${=REPLY})
  dw=$fr[1] dh=$fr[2] sx=$fr[3] sy=$fr[4]
  c0=$(( ((sx > 0 ? sx : 0) + cw - 1) / cw )) c1=$(( (sx + dw < W ? sx + dw : W) / cw ))
  r0=$(( ((sy > 0 ? sy : 0) + ch - 1) / ch )) r1=$(( (sy + dh < H ? sy + dh : H) / ch ))
  (( c1 > c0 && r1 > r0 )) || return 1
  REPLY="$(( c0 + 1 )) $(( r0 + 1 )) $(( c1 - c0 )) $(( r1 - r0 )) $(( (c0 * cw - sx) * $1 / dw )) $(( (r0 * ch - sy) * $2 / dh )) $(( (c1 - c0) * cw * $1 / dw )) $(( (r1 - r0) * ch * $2 / dh ))"
}

__tt_bg_path() {
  local p=${${1#\"}%\"}
  p=${p/#\~\//$HOME/}
  [[ -z $p || $p == /* ]] || p=${TTHEME_CONFIG:h}/backgrounds/$p
  REPLY=$p
}

__tt_bg_load() {
  local name=$1 dir=${TTHEME_CONFIG:h}/backgrounds img="" fit=contain op=1 pos=center f line stem="" size=100 REPLY
  local -i at=5
  local -a fills
  (( ${+bgsrc[$name]} )) && return 0
  for f in $dir/$name.conf $dir/$name.tune.conf; do
    if [[ -r $f ]]; then
      for line in "${(@f)$(<$f)}"; do
        case $line in
          'background-image = '*|'background-image='*) img=${${line#*=}# } ;;
          'background-image-fit = '*|'background-image-fit='*) fit=${${line#*=}# } ;;
          'background-image-opacity = '*|'background-image-opacity='*) op=${${line#*=}# } ;;
          'background-image-position = '*|'background-image-position='*) pos=${${line#*=}# } ;;
        esac
      done
    fi
    [[ $op == <->(|.<->) ]] || op=1
    [[ $pos == center-center ]] && pos=center
    at=${TTHEME_BG_POSITIONS[(Ie)$pos]}
    (( at )) || at=5
    __tt_bg_path "$img"
    size=100 stem=""
    case $REPLY in
      *@fill-<0-100>.png) stem=${REPLY%@fill-*} size=fill ;;
      *@<101-999>-*-<->x<->.png|*@<20-99>-*.png) stem=${REPLY%@*} size=${${REPLY##*@}%%-*} ;;
      *.png) stem=${REPLY%.png}; [[ $fit == cover ]] && size=fill ;;
    esac
    [[ $f == *.tune.conf ]] || bgdef[$name]="$size $at $op" bgbase[$name]=$REPLY
  done
  bgsize[$name]=$size bgpos[$name]=$at bgop[$name]=$op bgoff[$name]=0 bgshot[$name]="" bgshotkey[$name]="" bgfocus[$name]=50
  [[ -e $dir/$name.off.conf ]] && bgoff[$name]=1
  bgload[$name]="$size $at $op ${bgoff[$name]}"
  [[ $size == <101-> ]] && bgshot[$name]=$REPLY bgshotkey[$name]="$size $at"
  if [[ -n $stem ]]; then
    bgsrc[$name]=$stem.png bgfill[$name]=$stem.png
    fills=($stem@fill-<0-100>.png(N))
    (( ${#fills} )) && bgfill[$name]=$fills[1] bgfocus[$name]=${${fills[1]##*@fill-}%.png}
  else
    bgsrc[$name]=$REPLY bgfill[$name]=$REPLY
  fi
}

__tt_bg_image() {
  REPLY=${bgsrc[$1]}
  [[ ${bgsize[$1]} == fill ]] && REPLY=${bgfill[$1]}
}

__tt_bg_label() {
  local size=${bgsize[$1]}
  [[ $size == fill ]] || size+=%
  REPLY="$size · ${TTHEME_BG_POSITIONS[${bgpos[$1]}]} · ${bgop[$1]}"
}

__tt_bg_dim() {
  local img=$1
  local -a d
  [[ -n $img && -r $img ]] || return 1
  if [[ -z ${bgdim[$img]} ]]; then
    d=($(od -An -N24 -tu1 -- $img 2>/dev/null))
    if (( ${#d} == 24 && d[1] == 137 && d[2] == 80 && d[3] == 78 && d[4] == 71 )); then
      bgdim[$img]="$(( (d[17] << 24) | (d[18] << 16) | (d[19] << 8) | d[20] )) $(( (d[21] << 24) | (d[22] << 16) | (d[23] << 8) | d[24] ))"
    else
      bgdim[$img]=-
    fi
  fi
  [[ ${bgdim[$img]} != - ]]
}

__tt_bg_bake() {
  local src=$1 out=$2 tmp
  local -i W=$3 H=$4 dw=$5 dh=$6 ox=$7 oy=$8 vx vy vw vh px py rc
  vx=$(( ox < 0 ? -ox : 0 )) vy=$(( oy < 0 ? -oy : 0 ))
  vw=$(( (dw < W - ox ? dw : W - ox) - vx )) vh=$(( (dh < H - oy ? dh : H - oy) - vy ))
  px=$(( ox > 0 ? ox : 0 )) py=$(( oy > 0 ? oy : 0 ))
  (( vw > 0 && vh > 0 )) || return 1
  tmp=$(mktemp -d) || return 1
  sips -z $dh $dw $src --out $tmp/a.png >/dev/null 2>&1 &&
    sips -p $(( dh + 2 )) $(( dw + 2 )) $tmp/a.png --out $tmp/b.png >/dev/null 2>&1 &&
    sips -c $vh $vw --cropOffset $(( vy + 1 )) $(( vx + 1 )) $tmp/b.png --out $tmp/c.png >/dev/null 2>&1 &&
    sips -p $(( 2 * H - vh + 2 )) $(( 2 * W - vw + 2 )) $tmp/c.png --out $tmp/d.png >/dev/null 2>&1 &&
    sips -c $H $W --cropOffset $(( H - vh + 1 - py )) $(( W - vw + 1 - px )) $tmp/d.png --out $tmp/e.png >/dev/null 2>&1 &&
    mv -f $tmp/e.png $out
  rc=$?
  rm -rf $tmp
  return $rc
}

__tt_bg_include() {
  local conf=${TTHEME_CONFIG:h}/backgrounds/$1.conf line
  local -a lines=() add=()
  [[ -r $conf ]] && lines=("${(@f)$(<$conf)}")
  for line in "config-file = ?$1.tune.conf" "config-file = ?$1.off.conf"; do
    (( ${lines[(Ie)$line]} )) || add+=("$line")
  done
  (( ${#add} )) || return 0
  mkdir -p ${conf:h} && print -rl -- "${lines[@]}" "${add[@]}" > $conf
}

__tt_bg_write() {
  local name=$1 dir=${TTHEME_CONFIG:h}/backgrounds src=${bgsrc[$1]} size=${bgsize[$1]} img="" fit=contain f REPLY
  local pos=${TTHEME_BG_POSITIONS[${bgpos[$1]}]}
  local -i W=$(( pw * bgcw )) H=$(( ph * bgch ))
  local -a wh fr
  __tt_bg_include $name || return 1
  if [[ "$size ${bgpos[$1]} ${bgop[$1]}" == "${bgdef[$1]}" ]]; then
    rm -f -- $dir/$name.tune.conf
  else
    case $size in
      fill) img=${bgfill[$1]} fit=cover ;;
      100) img=$src ;;
      <20-99>)
        __tt_bg_dim "$src" || return 1
        wh=(${=bgdim[$src]})
        img=${src%.png}@$size-$pos.png
        __tt_bg_frame $wh[1] $wh[2] $wh[1] $wh[2] $size ${bgpos[$1]} contain
        fr=(${=REPLY})
        [[ $img -nt $src ]] || __tt_bg_bake "$src" "$img" $wh[1] $wh[2] $fr || return 1
        ;;
      *)
        fit=cover
        if [[ "$size ${bgpos[$1]}" == "${bgshotkey[$1]}" && -r ${bgshot[$1]} ]]; then
          img=${bgshot[$1]}
        else
          __tt_bg_dim "$src" && (( W && H )) || return 1
          wh=(${=bgdim[$src]})
          img=${src%.png}@$size-$pos-${W}x$H.png
          __tt_bg_frame $wh[1] $wh[2] $W $H $size ${bgpos[$1]} contain ${bgfocus[$1]}
          fr=(${=REPLY})
          [[ $img -nt $src ]] || __tt_bg_bake "$src" "$img" $W $H $fr || return 1
        fi
        ;;
    esac
    __tt_tilde "$img"
    print -rl -- "background-image = $REPLY" "background-image-fit = $fit" "background-image-position = $pos" "background-image-opacity = ${bgop[$1]}" > $dir/$name.tune.conf || return 1
  fi
  if (( bgoff[$1] )); then
    print -r -- "background-image =" > $dir/$name.off.conf || return 1
  else
    rm -f -- $dir/$name.off.conf
  fi
  if [[ $src == /*.png ]]; then
    for f in ${src%.png}@<20-999>-*.png(N); do
      [[ $f == "$img" || $f == "${bgbase[$1]}" ]] || rm -f -- $f
    done
  fi
  return 0
}

__tt_pv_bg_open() {
  bgcw=0 bgch=0 bginc=""
  local -a confs=(${TTHEME_CONFIG:h}/backgrounds/*.conf(N))
  (( ${#confs} )) || return 0
  local fd saved resp="" line f=${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/config
  if [[ -r $f ]]; then
    for line in "${(@f)$(<$f)}"; do
      [[ $line == 'config-file = ?'*'/backgrounds/'*'.conf' ]] && bginc=${${line:t}%.conf}
    done
  fi
  exec {fd}<>/dev/tty 2>/dev/null || return 0
  saved=$(stty -g <&$fd 2>/dev/null)
  stty raw -echo min 0 time 3 <&$fd 2>/dev/null
  printf '\e[16t' >&$fd
  IFS= read -r -s -t 1 -d t -u $fd resp 2>/dev/null
  stty "$saved" <&$fd 2>/dev/null
  exec {fd}>&-
  [[ $resp == *'[6;'<1->';'<1-> ]] || return 0
  resp=${resp##*\[6;}
  bgch=${resp%;*} bgcw=${resp#*;} bgrow=1
}

__tt_pv_bg_show() {
  (( bgcw )) || return 0
  local name=$1 img="" op size fit=contain focus=-1 REPLY
  local -a p=(${=TTHEME_PALETTE[$name]}) wh at
  (( ${#p} >= 20 )) || return 0
  (( $2 )) && { bgsent=(); bgshown="" }
  bgname=$name
  __tt_bg_load $name
  if [[ $name == "$bginc" && "${bgsize[$name]} ${bgpos[$name]} ${bgop[$name]} ${bgoff[$name]}" == "${bgload[$name]}" ]]; then
    printf '\e_Ga=d,d=i,i=1,q=2\e\\\e_Ga=d,d=i,i=2,q=2\e\\'
    [[ -n $bgshown ]] && printf '\e_Ga=d,d=i,i=%d,q=2\e\\' ${bgsent[$bgshown]}
    bgshown=""
    return 0
  fi
  op=${bgop[$name]} size=${bgsize[$name]}
  if [[ $size == fill ]]; then
    img=${bgfill[$name]} size=100 fit=cover
  elif [[ $size == <101-> && "$size ${bgpos[$name]}" == "${bgshotkey[$name]}" && -r ${bgshot[$name]} ]]; then
    img=${bgshot[$name]} size=100 fit=cover
  else
    img=${bgsrc[$name]} focus=${bgfocus[$name]}
  fi
  (( bgoff[$name] )) && img=""
  local bg=${p[1]#\#}
  local -i r=$(( 16#${bg:0:2} )) g=$(( 16#${bg:2:2} )) b=$(( 16#${bg:4:2} )) a=$(( (1.0 - op) * 255 + 0.5 ))
  (( a < 0 )) && a=0
  __tt_b64 $r $g $b
  printf '\e_Ga=t,f=24,s=1,v=1,i=1,q=2;%s\e\\\e[H\e_Ga=p,i=1,p=1,c=%d,r=%d,C=1,z=-1073741827,q=2\e\\' "$REPLY" $pw $ph
  __tt_b64 $r $g $b $a
  printf '\e_Ga=t,f=32,s=1,v=1,i=2,q=2;%s\e\\\e[H\e_Ga=p,i=2,p=1,c=%d,r=%d,C=1,z=-1073741825,q=2\e\\' "$REPLY" $pw $ph
  __tt_bg_dim "$img" || img=""
  if [[ -n $bgshown && $bgshown != "$img" ]]; then
    printf '\e_Ga=d,d=i,i=%d,q=2\e\\' ${bgsent[$bgshown]}
    bgshown=""
  fi
  [[ -n $img ]] || return 0
  if [[ -z ${bgsent[$img]} ]]; then
    bgsent[$img]=$(( ${#bgsent} + 3 ))
    printf '\e_Ga=t,t=f,f=100,i=%d,q=2;%s\e\\' ${bgsent[$img]} "$(print -rn -- $img | base64 | tr -d '\n')"
  fi
  wh=(${=bgdim[$img]})
  if __tt_bg_place $wh[1] $wh[2] $pw $ph $bgcw $bgch $size ${bgpos[$name]} $fit $focus; then
    at=(${=REPLY})
    printf '\e[%d;%dH\e_Ga=p,i=%d,p=1,x=%d,y=%d,w=%d,h=%d,c=%d,r=%d,C=1,z=-1073741826,q=2\e\\' \
      $at[2] $at[1] ${bgsent[$img]} $at[5] $at[6] $at[7] $at[8] $at[3] $at[4]
  else
    printf '\e_Ga=d,d=i,i=%d,q=2\e\\' ${bgsent[$img]}
  fi
  bgshown=$img
}

__tt_pv_bg_adjust() {
  (( bgcw )) && [[ ${rtype[cur]} == thm ]] || return 0
  local name=${rval[cur]} REPLY
  __tt_bg_load $name
  __tt_bg_image $name
  __tt_bg_dim "$REPLY" || return 0
  local size=${bgsize[$name]} op=${bgop[$name]}
  local -i at=${bgpos[$name]} off=${bgoff[$name]} o=$(( ${bgop[$name]} * 100 + 0.5 )) fs=0 bake=$+commands[sips]
  local -a def=(${=bgdef[$name]}) wh fwh
  if __tt_bg_dim "${bgsrc[$name]}" && __tt_bg_dim "${bgfill[$name]}"; then
    wh=(${=bgdim[${bgsrc[$name]}]}) fwh=(${=bgdim[${bgfill[$name]}]})
    local -i W=$(( pw * bgcw )) H=$(( ph * bgch )) kw kh
    kw=$(( wh[1] < wh[2] * fwh[1] / fwh[2] ? wh[1] : wh[2] * fwh[1] / fwh[2] ))
    kh=$(( kw * fwh[2] / fwh[1] ))
    fs=$(( 100 * (W * kh > H * kw ? W * kh : H * kw) * wh[1] * wh[2] / (kw * kh * (W * wh[2] < H * wh[1] ? W * wh[2] : H * wh[1])) ))
  fi
  case $1 in
    ' ') off=$(( ! off )) ;;
    '=') size=$def[1] at=$def[2] op=$def[3] off=0 ;;
    *)
      (( off )) && return 0
      case $1 in
        '[')
          if [[ $size == fill ]]; then
            (( fs )) && size=$(( bake && fs > 100 ? fs : 100 ))
          elif (( bake && size > 20 )); then
            size=$(( size - 1 ))
          fi
          ;;
        ']')
          if [[ $size != fill ]]; then
            if (( ! bake || size + 1 > fs )); then
              size=fill
            else
              size=$(( size + 1 ))
            fi
          fi
          ;;
        '{') at=$(( (at + 7) % 9 + 1 )) ;;
        '}') at=$(( at % 9 + 1 )) ;;
        '<') (( o > 0 )) && printf -v op '%d.%02d' $(( (o - 1) / 100 )) $(( (o - 1) % 100 )) ;;
        '>') (( o < 100 )) && printf -v op '%d.%02d' $(( (o + 1) / 100 )) $(( (o + 1) % 100 )) ;;
      esac
      ;;
  esac
  [[ $size == ${bgsize[$name]} && $at == ${bgpos[$name]} && $op == ${bgop[$name]} && $off == ${bgoff[$name]} ]] && return 0
  if [[ $size != ${bgsize[$name]} ]]; then
    osd=$size osdt=100
    [[ $size == fill ]] || osd+=%
  fi
  bgsize[$name]=$size bgpos[$name]=$at bgop[$name]=$op bgoff[$name]=$off bgedit[$name]=1 bgname=""
}

__tt_pv_bg_line() {
  REPLY=""
  [[ ${rtype[cur]} == thm ]] || return 0
  local name=${rval[cur]} vals keys
  __tt_bg_load $name
  __tt_bg_image $name
  __tt_bg_dim "$REPLY" || { REPLY=""; return 0 }
  if (( bgoff[$name] )); then
    vals="bg off" keys="space on"
  else
    __tt_bg_label $name
    vals="bg $REPLY" keys="{ } position · < > opacity · space off"
    __tt_bg_dim "${bgsrc[$name]}" && keys="[ ] size · $keys"
  fi
  [[ "${bgsize[$name]} ${bgpos[$name]} ${bgop[$name]}" == "${bgdef[$name]}" ]] && (( ! bgoff[$name] )) || keys+=" · = default"
  if (( color )); then
    REPLY=$vals$'\e[2m'" · $keys"$'\e[0m'
  else
    REPLY="$vals · $keys"
  fi
}

__tt_pv_bg_close() {
  (( bgcw )) && printf '\e_Ga=d,d=A,q=2\e\\'
}

__tt_pv_bg_save() {
  local name msg reload=0 REPLY
  (( ${#bgedit} )) || return 0
  for name in ${(ok)bgedit}; do
    if ! __tt_bg_write $name; then
      print -u2 "ttheme: could not save the background of $name"
      continue
    fi
    [[ $name == "$bginc" ]] && reload=1
    if (( bgoff[$name] )); then
      msg="background · $name off"
    else
      __tt_bg_label $name
      msg="background · $name $REPLY"
    fi
    if __tt_color; then
      printf '\033[2m%s\033[0m\n' "$msg"
    else
      print -r -- "$msg"
    fi
  done
  (( reload )) && { killall -USR2 ghostty 2>/dev/null || pkill -USR2 -x ghostty 2>/dev/null }
  return 0
}
