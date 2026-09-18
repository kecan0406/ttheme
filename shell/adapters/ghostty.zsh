__tt_reload() {
  local pid=$PPID ppid comm
  while (( pid > 1 )); do
    read -r ppid comm <<< "$(ps -o ppid=,comm= -p $pid)"
    if [[ ${comm:t} == ghostty ]]; then
      kill -USR2 $pid
      return
    fi
    pid=$ppid
  done
  pkill -USR2 -x ghostty 2>/dev/null
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

__tt_bg_at() {
  local src=""
  (( $# > 7 )) && src=",x=$8,y=$9,w=${10},h=${11}"
  if (( bgrel )); then
    printf '\e_Ga=p,i=%d,p=%d,P=999999,Q=1,H=%d,V=%d,c=%d,r=%d%s,C=1,z=%d,q=2\e\\' $1 $2 $(( $4 - bgmx )) $(( $5 - bgmy )) $6 $7 "$src" $3
  else
    printf '\e[%d;%dH\e_Ga=p,i=%d,p=%d,c=%d,r=%d%s,C=1,z=%d,q=2\e\\' $(( $5 + 1 )) $(( $4 + 1 )) $1 $2 $6 $7 "$src" $3
  fi
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
  local -i W=$(( (pw + 2 * bgmx) * bgcw )) H=$(( (ph + 2 * bgmy) * bgch ))
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
  bgcw=0 bgch=0 bginc="" bgrel=0 bgmx=0 bgmy=0 bganchor=0
  local -a confs=(${TTHEME_CONFIG:h}/backgrounds/*.conf(N))
  (( ${#confs} )) || return 0
  local fd saved resp="" line c v f
  local -i px=2 py=2 fs=0 sc=2
  for f in ${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/config ${TTHEME_CONFIG:h}/ttheme.conf; do
    [[ -r $f ]] || continue
    for line in "${(@f)$(<$f)}"; do
      v=${${line#*=}// /}
      case $line in
        'config-file = ?'*'/backgrounds/'*'.conf') bginc=${${line:t}%.conf} ;;
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

__tt_pv_bg_show() {
  (( bgcw )) || return 0
  local name=$1 img="" op size fit=contain focus=-1 REPLY
  local -a p=(${=TTHEME_PALETTE[$name]}) wh at
  local -i cols=$(( pw + 2 * bgmx )) rows=$(( ph + 2 * bgmy ))
  (( ${#p} >= 20 )) || return 0
  (( $2 )) && { bgsent=(); bgshown="" bganchor=0 }
  bgname=$name
  __tt_bg_load $name
  if (( ! bgrel )) && [[ $name == "$bginc" && "${bgsize[$name]} ${bgpos[$name]} ${bgop[$name]} ${bgoff[$name]}" == "${bgload[$name]}" ]]; then
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
  if (( bgrel && ! bganchor )); then
    printf '\e_Ga=t,f=32,s=1,v=1,i=999999,q=2;AAAAAA==\e\\\e[H\e_Ga=p,i=999999,p=1,c=1,r=1,C=1,z=-1073741828,q=2\e\\'
    bganchor=1
  fi
  __tt_b64 $r $g $b
  printf '\e_Ga=t,f=24,s=1,v=1,i=1,q=2;%s\e\\' "$REPLY"
  __tt_bg_at 1 1 -1073741827 0 0 $cols $rows
  __tt_b64 $r $g $b $a
  printf '\e_Ga=t,f=32,s=1,v=1,i=2,q=2;%s\e\\' "$REPLY"
  __tt_bg_at 2 1 -1073741825 0 0 $cols $rows
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
  if __tt_bg_place $wh[1] $wh[2] $cols $rows $bgcw $bgch $size ${bgpos[$name]} $fit $focus; then
    at=(${=REPLY})
    __tt_bg_at ${bgsent[$img]} 1 -1073741826 $(( at[1] - 1 )) $(( at[2] - 1 )) $at[3] $at[4] $at[5] $at[6] $at[7] $at[8]
  else
    printf '\e_Ga=d,d=i,i=%d,q=2\e\\' ${bgsent[$img]}
  fi
  bgshown=$img
}

__tt_pv_bg_fs() {
  local name=$1
  local -a wh fwh
  local -i W=$(( (pw + 2 * bgmx) * bgcw )) H=$(( (ph + 2 * bgmy) * bgch )) kw kh
  REPLY=0
  (( W && H )) || return 1
  __tt_bg_dim "${bgsrc[$name]}" && __tt_bg_dim "${bgfill[$name]}" || return 1
  wh=(${=bgdim[${bgsrc[$name]}]}) fwh=(${=bgdim[${bgfill[$name]}]})
  kw=$(( wh[1] < wh[2] * fwh[1] / fwh[2] ? wh[1] : wh[2] * fwh[1] / fwh[2] ))
  kh=$(( kw * fwh[2] / fwh[1] ))
  REPLY=$(( 100 * (W * kh > H * kw ? W * kh : H * kw) * wh[1] * wh[2] / (kw * kh * (W * wh[2] < H * wh[1] ? W * wh[2] : H * wh[1])) ))
}

__tt_pv_bg_adjust() {
  (( bgcw )) && [[ -n $tune ]] || return 0
  local name=$tune REPLY
  __tt_bg_load $name
  __tt_bg_image $name
  __tt_bg_dim "$REPLY" || return 0
  local size=${bgsize[$name]} op=${bgop[$name]}
  local -i n=${2:-0} at=${bgpos[$name]} off=${bgoff[$name]} o=$(( ${bgop[$name]} * 100 + 0.5 )) m fs=0 bake=$+commands[sips]
  local -a def=(${=bgdef[$name]})
  __tt_pv_bg_fs $name && fs=$REPLY
  case $1 in
    on) off=$(( ! off )) ;;
    def) size=$def[1] at=$def[2] op=$def[3] off=0 ;;
    *)
      (( off )) && return 0
      case $1 in
        size)
          if (( n < 0 )); then
            if [[ $size == fill ]]; then
              (( fs )) || return 0
              size=$(( bake && fs > 100 ? fs : 100 ))
              n=$(( n + 1 ))
            fi
            if (( bake && n )); then
              size=$(( size + n ))
              (( size < 20 )) && size=20
            fi
          elif [[ $size != fill ]]; then
            if (( ! bake || size + n > fs )); then
              size=fill
            else
              size=$(( size + n ))
            fi
          fi
          ;;
        pos) at=$(( ((at - 1 + n) % 9 + 9) % 9 + 1 )) ;;
        at) at=$n ;;
        op)
          m=$(( o + n ))
          (( m < 0 )) && m=0
          (( m > 100 )) && m=100
          (( m != o )) && printf -v op '%d.%02d' $(( m / 100 )) $(( m % 100 ))
          ;;
      esac
      ;;
  esac
  [[ $size == ${bgsize[$name]} && $at == ${bgpos[$name]} && $op == ${bgop[$name]} && $off == ${bgoff[$name]} ]] && return 0
  if [[ $size != ${bgsize[$name]} ]]; then
    osd=$size osdt=100
    [[ $size == fill ]] || osd+=%
  fi
  bgsize[$name]=$size bgpos[$name]=$at bgop[$name]=$op bgoff[$name]=$off bgname=""
}

__tt_pv_bg_state() {
  REPLY=""
  (( bgcw )) || return 1
  __tt_bg_load $1
  __tt_bg_image $1
  __tt_bg_dim "$REPLY" || { REPLY=""; return 1 }
  if (( bgoff[$1] )); then
    REPLY=off
  else
    __tt_bg_label $1
  fi
}

__tt_pv_bg_panel() {
  local name=$1 z=$'\e[0m' b=$'\e[1m' d=$'\e[2m' c=$ac val sty REPLY
  local -a labs=(size position opacity) at=(0 3 6)
  local -i r0=$2 col=$3 end=$4 off=${bgoff[$1]} T=$(( $4 - $3 - 19 )) lo=100 hi=100 k i r knob pos=${bgpos[$1]} o
  (( color )) || z= b= d= c=
  (( T < 8 )) && T=8
  (( $+commands[sips] )) && lo=20
  __tt_pv_bg_fs $name && (( REPLY > hi )) && hi=$REPLY
  for k in 1 2 3; do
    r=$(( r0 + at[k] ))
    sty=$d
    (( tf == k && ! off )) && sty=$b
    out+=$'\e['$r';'$col'H'
    if (( tf == k && ! off )); then
      out+=$c"▶"$z" "
    else
      out+="  "
    fi
    out+=$sty$labs[k]$z
    if (( k == 2 )); then
      for (( i = 1; i <= 9; i++ )); do
        out+=$'\e['$(( r0 + 2 + (i - 1) / 3 ))';'$(( col + 12 + (i - 1) % 3 * 3 ))'H'
        if (( ! color )); then
          if (( i == pos )); then out+="#"; else out+="."; fi
        elif (( i == pos && ! off )); then
          out+=$b$c"■"$z
        elif (( i == pos )); then
          out+=$d"■"$z
        else
          out+=$d"·"$z
        fi
      done
      val=${TTHEME_BG_POSITIONS[pos]}
    else
      if (( k == 1 )); then
        if [[ ${bgsize[$name]} == fill ]]; then
          knob=$(( T - 1 )) val=FILL
        else
          knob=$(( (${bgsize[$name]} - lo) * (T - 1) / (hi - lo + 1) )) val=${bgsize[$name]}%
        fi
      else
        o=$(( ${bgop[$name]} * 100 + 0.5 ))
        knob=$(( o * (T - 1) / 100 )) val=${bgop[$name]}
      fi
      (( knob < 0 )) && knob=0
      (( knob > T - 1 )) && knob=$(( T - 1 ))
      out+=$'\e['$r';'$(( col + 12 ))'H'
      if (( ! color )); then
        out+=${(l:knob::=:)}"O"${(l:$(( T - 1 - knob ))::-:)}
      elif (( off )); then
        out+=$d${(l:knob::━:)}"●"${(l:$(( T - 1 - knob ))::─:)}$z
      else
        out+=$c${(l:knob::━:)}$b"●"$z$d${(l:$(( T - 1 - knob ))::─:)}$z
      fi
    fi
    out+=$'\e['$r';'$(( end - ${#val} + 1 ))'H'$sty$val$z
  done
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
  (( reload )) && __tt_reload
  return 0
}
