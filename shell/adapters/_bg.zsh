typeset -ga TTHEME_BG_POSITIONS=(top-left top-center top-right center-left center center-right bottom-left bottom-center bottom-right)

__tt_bg_saved() {
  __tt_pictured "$@"
  __tt_bg_refresh "$@"
  return 0
}

__tt_bg_refresh() { : }

__tt_bg_hide() { : }

__tt_bg_lasting() { : }

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
  (( $# > 6 )) && src=",x=$7,y=$8,w=$9,h=${10}"
  if (( bgrel )); then
    printf '\e_Ga=p,i=%d,p=%d,P=999999,Q=999999,H=%d,V=%d,c=%d,r=%d%s,C=1,z=%d,q=2\e\\' $1 $1 $(( $3 - bgmx )) $(( $4 - bgmy )) $5 $6 "$src" $2
  else
    printf '\e[%d;%dH\e_Ga=p,i=%d,p=%d,c=%d,r=%d%s,C=1,z=%d,q=2\e\\' $(( $4 + 1 )) $(( $3 + 1 )) $1 $1 $5 $6 "$src" $2
  fi
}

__tt_bg_path() {
  local p=${${1#\"}%\"}
  p=${p/#\~\//$HOME/}
  [[ -z $p || $p == /* ]] || p=${TTHEME_CONFIG:h}/backgrounds/$p
  REPLY=$p
}

__tt_bg_load() {
  local name=$1 pal=${1%:*} key="" file dir=${TTHEME_CONFIG:h}/backgrounds img="" fit=contain op=1 pos=center line stem="" size=100 REPLY
  local -i at=5 pass
  local -a fills lines src pics pd
  (( ${+bgsrc[$name]} )) && return 0
  [[ $name == *:* ]] && key=${name##*:}
  file=${${pal/@/--}/\//--}
  bgfrom[$name]="" bgurl[$name]="" bgby[$name]="" bgtunef[$name]=$file.tune.conf bgofff[$name]=$file.off.conf bgimages[$name]=1
  if [[ -n $key ]]; then
    pd=(${=bgpic[$pal:$key]})
    lines=("# from ${pd[5,-1]}" "background-image = $pd[2]" "background-image-fit = cover" "background-image-position = top-right" "background-image-opacity = $pd[3]" "config-file = ?$pd[1].tune.conf" "config-file = ?$pd[1].off.conf")
    [[ $pd[4] == - ]] || lines+=("# by $pd[4]")
    bgimages[$name]=${bgimages[$pal]:-1}
  elif [[ -r $dir/$file.conf ]]; then
    lines=("${(@f)$(<$dir/$file.conf)}")
    for line in ${(k)bgcolors[(I)${(b)pal}:*]}; do
      unset "bgcolors[$line]"
    done
  fi
  for line in $lines; do
    case $line in
      'config-file = ?'*.tune.conf) bgtunef[$name]=${line#config-file = \?} ;;
      'config-file = ?'*.off.conf) bgofff[$name]=${line#config-file = \?} ;;
      '# image '*/<->) bgimages[$name]=${line##*/} bgact[$pal]=${${line#\# image }%% *} ;;
      '# colors '*) pd=(${=line#\# colors }); [[ -n $key ]] || bgcolors[$pal:$pd[1]]=$pd[2] ;;
      '# picture '*)
        pd=(${=line#\# picture })
        bgpic[$pal:$pd[1]]=${(j: :)pd[2,-1]}
        pics+=($pd[1])
        ;;
    esac
  done
  [[ -n $key ]] || bgpics[$pal]=${(j: :)pics}
  for pass in 1 2; do
    src=("${lines[@]}")
    if (( pass == 2 )); then
      src=()
      [[ -r $dir/${bgtunef[$name]} ]] && src=("${(@f)$(<$dir/${bgtunef[$name]})}")
    fi
    for line in "${src[@]}"; do
      case $line in
        '# from '*) (( pass == 1 )) && bgfrom[$name]=${(j: :)${${=line#\# from }[1,2]}} bgurl[$name]=${${=line#\# from }[3]} ;;
        '# by '*) (( pass == 1 )) && bgby[$name]=${${line#\# by }//,/, } ;;
        'background-image = '*|'background-image='*) img=${${line#*=}# } ;;
        'background-image-fit = '*|'background-image-fit='*) fit=${${line#*=}# } ;;
        'background-image-opacity = '*|'background-image-opacity='*) op=${${line#*=}# } ;;
        'background-image-position = '*|'background-image-position='*) pos=${${line#*=}# } ;;
      esac
    done
    [[ $op == <->(|.<->) ]] || op=1
    [[ $pos == center-center ]] && pos=center
    at=${TTHEME_BG_POSITIONS[(Ie)$pos]}
    (( at )) || at=5
    __tt_bg_path "$img"
    size=100 stem=""
    case $REPLY in
      *@fill-<0-100>.png) stem=${REPLY%@fill-*} size=fill ;;
      *@<20-999>-*-<->x<->.png|*@<20-99>-*.png) stem=${REPLY%@*} size=${${REPLY##*@}%%-*} ;;
      *.png) stem=${REPLY%.png}; [[ $fit == cover ]] && size=fill ;;
    esac
    (( pass == 1 )) && bgdef[$name]="$size $at $op" bgbase[$name]=$REPLY
  done
  bgsize[$name]=$size bgpos[$name]=$at bgop[$name]=$op bgoff[$name]=0 bgshot[$name]="" bgshotkey[$name]="" bgfocus[$name]=50
  [[ -e $dir/${bgofff[$name]} ]] && bgoff[$name]=1
  bgload[$name]="$size $at $op ${bgoff[$name]}"
  [[ $REPLY == *@<20-999>-*-<->x<->.png ]] && bgshot[$name]=$REPLY bgshotkey[$name]="$size $at"
  if [[ -n $stem ]]; then
    bgsrc[$name]=$stem.png bgfill[$name]=$stem.png
    fills=($stem@fill-<0-100>.png(N))
    (( ${#fills} )) && bgfill[$name]=$fills[1] bgfocus[$name]=${${fills[1]##*@fill-}%.png}
  else
    bgsrc[$name]=$REPLY bgfill[$name]=$REPLY
  fi
}

__tt_bg_coloring() {
  local key=${1##*:}
  [[ $1 == *:* ]] || key=${bgact[$1]}
  REPLY=${bgcolors[${1%:*}:$key]:-tone}
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
  setopt localoptions nomultibyte
  local img=$1 fd hdr="" c
  local -a d=()
  local -i i n
  [[ -n $img && -r $img ]] || return 1
  if [[ -z ${bgdim[$img]} ]]; then
    if { exec {fd}<$img } 2>/dev/null; then
      sysread -s 24 -i $fd hdr
      exec {fd}<&-
    fi
    for (( i = 1; i <= ${#hdr}; i++ )); do
      c=${hdr[i]}
      n=$(( #c ))
      (( n < 0 )) && (( n += 256 ))
      d+=($n)
    done
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
  local file=${${1/@/--}/\//--}
  local conf=${TTHEME_CONFIG:h}/backgrounds/$file.conf line
  local -a lines=() add=()
  [[ -r $conf ]] && lines=("${(@f)$(<$conf)}")
  for line in "config-file = ?${bgtunef[$1]:-$file.tune.conf}" "config-file = ?${bgofff[$1]:-$file.off.conf}"; do
    (( ${lines[(Ie)$line]} )) || add+=("$line")
  done
  (( ${#add} )) || return 0
  mkdir -p ${conf:h} && __tt_put $conf "${lines[@]}" "${add[@]}"
}

__tt_bg_write() {
  local name=$1 pal=${1%:*} dir=${TTHEME_CONFIG:h}/backgrounds src=${bgsrc[$1]} size=${bgsize[$1]} shape img="" fit=contain f REPLY
  local pos=${TTHEME_BG_POSITIONS[${bgpos[$1]}]}
  local -i W=$(( (pw + 2 * bgmx) * bgcw )) H=$(( (ph + 2 * bgmy) * bgch ))
  local -a wh fr
  [[ -r $dir/${${pal/@/--}/\//--}.conf ]] || return 0
  [[ $name == *:* ]] || __tt_bg_include $name || return 1
  if [[ "$size ${bgpos[$1]} ${bgop[$1]}" == "${bgdef[$1]}" ]]; then
    rm -f -- $dir/${bgtunef[$1]}
  else
    shape=$size
    [[ $size == <20-100> ]] && { [[ $pos != center ]] || __tt_bg_covers } && ! __tt_bg_aligns && shape=window
    case $shape in
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
    __tt_put $dir/${bgtunef[$1]} "background-image = $REPLY" "background-image-fit = $fit" "background-image-position = $pos" "background-image-opacity = ${bgop[$1]}" || return 1
  fi
  if (( bgoff[$1] )); then
    __tt_put $dir/${bgofff[$1]} "background-image =" || return 1
  else
    rm -f -- $dir/${bgofff[$1]}
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
  local REPLY
  __tt_bg_shown && bginc=$REPLY
  (( TTHEME_TMUX )) || { __tt_bg_cells; TTHEME_TYPED= }
}

__tt_pv_bg_show() {
  (( bgcw )) || return 0
  local name=$1 img="" op size fit=contain focus=-1 REPLY
  local -a p=(${=TTHEME_PALETTE[${name%:*}]}) wh at
  local -i cols=$(( pw + 2 * bgmx )) rows=$(( ph + 2 * bgmy ))
  (( ${#p} >= 20 )) || return 0
  (( $2 )) && { __tt_bg_forget; bgshown="" bganchor=0 }
  bgname=$name
  __tt_bg_load $name
  if (( ! bgrel )) && [[ $name == "$bginc" && "${bgsize[$name]} ${bgpos[$name]} ${bgop[$name]} ${bgoff[$name]}" == "${bgload[$name]}" ]]; then
    printf '\e_Ga=d,d=i,i=1,q=2\e\\\e_Ga=d,d=i,i=2,q=2\e\\'
    [[ -n $bgshown ]] && printf '\e_Ga=d,d=i,i=%d,p=%d,q=2\e\\' $bgshown $bgshown
    bgshown=""
    return 0
  fi
  op=${bgop[$name]} size=${bgsize[$name]}
  if [[ $size == fill ]]; then
    img=${bgfill[$name]} size=100 fit=cover
  elif [[ "$size ${bgpos[$name]}" == "${bgshotkey[$name]}" && -r ${bgshot[$name]} ]]; then
    img=${bgshot[$name]} size=100 fit=cover
  else
    img=${bgsrc[$name]} focus=${bgfocus[$name]}
  fi
  (( bgoff[$name] )) && img=""
  local bg=${p[1]#\#}
  local -i r=$(( 16#${bg:0:2} )) g=$(( 16#${bg:2:2} )) b=$(( 16#${bg:4:2} )) a=$(( (1.0 - op) * 255 + 0.5 ))
  (( a < 0 )) && a=0
  if (( bgrel && ! bganchor )); then
    printf '\e_Ga=t,f=32,s=1,v=1,i=999999,q=2;AAAAAA==\e\\\e[H\e_Ga=p,i=999999,p=999999,c=1,r=1,C=1,z=-1073741828,q=2\e\\'
    bganchor=1
  fi
  __tt_b64 $r $g $b
  printf '\e_Ga=t,f=24,s=1,v=1,i=1,q=2;%s\e\\' "$REPLY"
  __tt_bg_at 1 -1073741827 0 0 $cols $rows
  __tt_b64 $r $g $b $a
  printf '\e_Ga=t,f=32,s=1,v=1,i=2,q=2;%s\e\\' "$REPLY"
  __tt_bg_at 2 -1073741825 0 0 $cols $rows
  local id=""
  if __tt_bg_dim "$img"; then
    wh=(${=bgdim[$img]})
    if __tt_bg_place $wh[1] $wh[2] $cols $rows $bgcw $bgch $size ${bgpos[$name]} $fit $focus; then
      at=(${=REPLY})
      __tt_bg_crop $img $wh[1] $wh[2] $at[6] $at[8] && id=${REPLY% *} at[6]=${REPLY##* }
    fi
  fi
  [[ -n $bgshown && $bgshown != "$id" ]] && printf '\e_Ga=d,d=i,i=%d,p=%d,q=2\e\\' $bgshown $bgshown
  bgshown=$id
  [[ -n $id ]] || return 0
  __tt_bg_at $id -1073741826 $(( at[1] - 1 )) $(( at[2] - 1 )) $at[3] $at[4] $at[5] $at[6] $at[7] $at[8]
}

__tt_bg_transmit() {
  local REPLY
  __tt_b64s "$2"
  printf '\e_Ga=t,t=f,f=100,i=%d,q=2;%s\e\\' $1 "$REPLY"
}

__tt_bg_send() {
  local -i cost=0
  if [[ -n ${bgsent[$1]} ]]; then
    bgorder=("${(@)bgorder:#${(b)1}}" "$1")
  else
    __tt_bg_dim "$1" && cost=$(( ${bgdim[$1]% *} * ${bgdim[$1]#* } * 4 ))
    bgsent[$1]=$(( ++bgnext + 2 )) bgcost[$1]=$cost
    (( bgbytes += cost ))
    bgorder+=("$1")
    __tt_bg_transmit ${bgsent[$1]} "$1"
    while (( ${#bgorder} > 1 && bgbytes > 134217728 )); do
      printf '\e_Ga=d,d=I,i=%d,q=2\e\\' ${bgsent[$bgorder[1]]}
      (( bgbytes -= bgcost[$bgorder[1]] ))
      unset "bgsent[$bgorder[1]]" "bgcost[$bgorder[1]]"
      shift bgorder
    done
  fi
  REPLY=${bgsent[$1]}
}

__tt_bg_forget() {
  local id
  for id in $bgsent; do
    printf '\e_Ga=d,d=I,i=%d,q=2\e\\' $id
  done
  bgsent=() bgcost=() bgorder=() bgbytes=0 bgthumb=()
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
  (( bgcw )) && [[ -n $tpick ]] || return 0
  local name=$tpick REPLY
  __tt_bg_load $name
  __tt_bg_image $name
  __tt_bg_dim "$REPLY" || return 0
  local size=${bgsize[$name]} op=${bgop[$name]}
  local -i n=${2:-0} at=${bgpos[$name]} off=${bgoff[$name]} o=$(( ${bgop[$name]} * 100 + 0.5 )) m fs=0 bake=$+commands[sips]
  local -a def=(${=bgdef[$name]})
  __tt_pv_bg_fs $name && fs=$REPLY
  case $1 in
    on) off=$(( ! off )) ;;
    def)
      case $n in
        1) size=$def[1] ;;
        2) at=$def[2] ;;
        3) op=$def[3] ;;
        *) size=$def[1] at=$def[2] op=$def[3] off=0 ;;
      esac
      ;;
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

__tt_pv_bg_findable() {
  (( bgcw ))
}

__tt_pv_bg_find() {
  local name=$1 err var
  local -i rc n=${#TTHEME_SCENES}
  local -x TTHEME_SCENE="" TTHEME_BG_MARGIN=""
  (( n )) && TTHEME_SCENE=${(L)TTHEME_SCENES[(scene % n + n) % n + 1]}
  (( bgrel )) && TTHEME_BG_MARGIN="$bgmx $bgmy"
  [[ $applied == "$painted" ]] || { __tt_apply "$applied" && painted=$applied }
  __tt_pv_bg_commit $name
  __tt_pv_bg_close
  __tt_bg_hide $name
  err=$(__tt_cli find $name 2>&1 >/dev/tty)
  rc=$?
  for var in ${(k)parameters[(I)TTHEME_FIND_*]}; do
    [[ ${parameters[$var]} == *export* ]] || unset $var
  done
  [[ -r $TTHEME_CONFIG ]] && source $TTHEME_CONFIG
  err=${${err//$'\n'/ }## #}
  resized=1 bgname="" bgshown="" bgdim=()
  if (( rc == 1 )); then
    msg=${err:-"Find failed for $name"} msgt=300
  fi
  (( rc == 0 )) || return 1
  __tt_pv_bg_reset $name
  __tt_bg_load $name
  bgload[$name]="" bgedit[$name]=1
  msg=${err:-"Background · $name"} msgt=200
  return 0
}

__tt_pv_bg_commit() {
  local img
  for img in ${(k)bgedit[(I)${(b)1}(|:*)]}; do
    __tt_bg_write $img
    unset "bgedit[$img]"
  done
  unset "bgview[$1]" "bgswap[$1]"
}

__tt_pv_bg_reset() {
  local img
  for img in ${(k)bgsrc[(I)${(b)1}(|:*)]}; do
    unset "bgsrc[$img]"
  done
  for img in ${(k)bgcolors[(I)${(b)1}:*]}; do
    unset "bgcolors[$img]"
  done
  unset "bgview[$1]" "bgswap[$1]"
}

__tt_pv_bg_images() {
  __tt_bg_load $1
  REPLY=${bgimages[$1]:-1}
}

__tt_pv_img() {
  REPLY=$1
  [[ -z $2 || $2 == "${bgact[$1]}" ]] || REPLY=$1:$2
}

__tt_pv_tune_open() {
  local REPLY
  __tt_bg_load $1
  __tt_pv_shows $1
  tpick=$REPLY tune=$1 tf=1 tsnaps=()
  __tt_bg_load $tpick
  tsnaps[$tpick]="${bgsize[$tpick]} ${bgpos[$tpick]} ${bgop[$tpick]} ${bgoff[$tpick]}"
}

__tt_pv_bg_pick() {
  local -a keys=(${=bgpics[$tune]})
  local cur=${tpick##*:} REPLY
  local -i n=${#keys} at
  if (( n < 2 )); then
    msg="$tune has one image" msgt=200
    return 0
  fi
  [[ $tpick == *:* ]] || cur=${bgact[$tune]}
  at=${keys[(Ie)$cur]}
  (( at )) || at=1
  at=$(( (at - 1 + $1 + n) % n + 1 ))
  __tt_pv_img $tune $keys[at]
  tpick=$REPLY
  __tt_bg_load $tpick
  (( ${+tsnaps[$tpick]} )) || tsnaps[$tpick]="${bgsize[$tpick]} ${bgpos[$tpick]} ${bgop[$tpick]} ${bgoff[$tpick]}"
  bgname=""
}

__tt_pv_bg_drop() {
  local name=$tune key=${tpick##*:} err
  local -i rc
  [[ $tpick == *:* ]] || key=${bgact[$name]}
  __tt_pv_untune
  __tt_pv_bg_commit $name
  __tt_pv_bg_close
  err=$(__tt_cli image $name drop ${key:+$key} 2>&1)
  rc=$?
  err=${${err//$'\n'/ }## #}
  resized=1 bgname="" bgshown="" bgdim=()
  __tt_pv_bg_reset $name
  __tt_bg_load $name
  bgload[$name]="" bgedit[$name]=1
  msg=${err:-"Background · $name"} msgt=$(( rc ? 300 : 200 ))
  [[ -r ${TTHEME_CONFIG:h}/backgrounds/${${name/@/--}/\//--}.conf ]] || return 0
  __tt_pv_tune_open $name
}

__tt_pv_bg_recolor() {
  local name=$tune was=$tpick key=${tpick##*:} want err REPLY
  local -i rc row=$tf
  [[ $tpick == *:* ]] || key=${bgact[$name]}
  __tt_bg_coloring $tpick
  want=original
  [[ $REPLY == original ]] && want=tone
  msg="Drawing in its own colors"
  [[ $want == tone ]] && msg="Drawing in the palette's tone"
  msgt=300
  printf '\e[?2026h'
  __tt_pv_draw
  __tt_pv_tune_stage
  __tt_pv_bg_commit $name
  err=$(__tt_cli image $name $want $key 2>&1)
  rc=$?
  err=${${err//$'\n'/ }## #}
  resized=1 bgname="" bgshown="" bgdim=()
  __tt_pv_bg_reset $name
  __tt_bg_load $name
  bgload[$name]="" bgedit[$name]=1
  msg=${err:-"Background · $name"} msgt=$(( rc ? 300 : 200 ))
  [[ -r ${TTHEME_CONFIG:h}/backgrounds/${${name/@/--}/\//--}.conf ]] || return 0
  __tt_pv_tune_open $name
  if [[ $was != "$tpick" ]]; then
    tpick=$was
    __tt_bg_load $tpick
    tsnaps[$tpick]="${bgsize[$tpick]} ${bgpos[$tpick]} ${bgop[$tpick]} ${bgoff[$tpick]}"
  fi
  tf=$row
}

__tt_pv_bg_panel() {
  local name=$1 z=$'\e[0m' b=$'\e[1m' d=$'\e[2m' c=$ac val sty mark choice REPLY
  local -a labs=(Size Position Opacity Colors) at=(1 4 7 0) def=(${=bgdef[$1]})
  local -i r0=$2 col=$3 end=$4 off=${bgoff[$1]} T=$(( $4 - $3 - 21 )) lo=100 hi=100 k i r knob pos=${bgpos[$1]} o tuned
  (( color )) || z= b= d= c=
  (( T < 8 )) && T=8
  (( $+commands[sips] )) && lo=20
  __tt_pv_bg_fs $name && (( REPLY > hi )) && hi=$REPLY
  for k in 1 2 3 4; do
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
    if (( k == 4 )); then
      __tt_bg_coloring $name
      val=$REPLY
      out+=$'\e['$r';'$(( col + 12 ))'H'
      for choice in tone original; do
        if (( ! color )); then
          if [[ $choice == $val ]]; then out+="[$choice] "; else out+=" $choice  "; fi
        elif [[ $choice != $val ]]; then
          out+=$d" $choice "$z" "
        elif (( tf == k && ! off )); then
          out+=$'\e[7;1m'$c" $choice "$z" "
        else
          out+=$sty" $choice "$z" "
        fi
      done
      continue
    fi
    if (( k == 2 )); then
      for (( i = 1; i <= 9; i++ )); do
        out+=$'\e['$(( r0 + at[2] - 1 + (i - 1) / 3 ))';'$(( col + 12 + (i - 1) % 3 * 3 ))'H'
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
      tuned=$(( pos != def[2] ))
    else
      if (( k == 1 )); then
        if [[ ${bgsize[$name]} == fill ]]; then
          knob=$(( T - 1 )) val=fill
        else
          knob=$(( (${bgsize[$name]} - lo) * (T - 1) / (hi - lo + 1) )) val=${bgsize[$name]}%
        fi
        tuned=0
        [[ ${bgsize[$name]} == "$def[1]" ]] || tuned=1
      else
        o=$(( ${bgop[$name]} * 100 + 0.5 ))
        knob=$(( o * (T - 1) / 100 )) val=${bgop[$name]}
        tuned=$(( ${bgop[$name]} * 1000 + 0.5 != ${def[3]:-1} * 1000 + 0.5 ))
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
    out+=$'\e['$r';'$(( end - ${#val} - 1 ))'H'$sty$val$z
    if (( tuned )); then
      mark=$d
      (( tf == k )) && mark=$b$c
      out+=$'\e['$r';'$end'H'$mark"↺"$z
    fi
  done
}

__tt_pv_bg_strip() {
  local pal=$tune dir=${TTHEME_CONFIG:h}/backgrounds cur fill want sty top side bot cmd buf="" z=$'\e[0m' d=$'\e[2m' REPLY
  local -a keys=(${=bgpics[$tune]}) wh pd
  local -i r0=$1 col=$2 end=$3 n=${#keys} at show tc tr=3 i k x r id slot first
  if (( n < 1 )); then
    __tt_pv_bg_strip_off
    return 0
  fi
  cur=${tpick##*:}
  [[ $tpick == *:* ]] || cur=${bgact[$pal]}
  at=${keys[(Ie)$cur]}
  (( at )) || at=1
  pd=(${=bgpic[$pal:$keys[at]]})
  if (( r0 + tr + 3 >= ph )) || ! __tt_bg_dim $dir/$pd[2]; then
    __tt_pv_bg_strip_off
    return 0
  fi
  wh=(${=bgdim[$dir/$pd[2]]})
  tc=$(( (2 * tr * bgch * wh[1] + wh[2] * bgcw) / (2 * wh[2] * bgcw) ))
  (( tc < 4 )) && tc=4
  (( tc > 16 )) && tc=16
  show=$(( n < 5 ? n : 5 ))
  while (( show > 1 && show * (tc + 3) - 1 > end - col )); do
    (( show-- ))
  done
  first=1
  (( n > show )) && first=$(( ((at - 1 - show / 2) % n + n) % n + 1 ))
  for (( i = 0; i < show; i++ )); do
    k=$(( (first - 1 + i) % n + 1 ))
    x=$(( col + i * (tc + 3) ))
    slot=$(( i + 1 ))
    if (( k == at )); then
      sty=$'\e[1m'$ac top="┏${(l:tc::━:)}┓" side="┃" bot="┗${(l:tc::━:)}┛"
    else
      sty=$d top="╭${(l:tc::─:)}╮" side="│" bot="╰${(l:tc::─:)}╯"
    fi
    buf+=$'\e['$(( r0 + 1 ))';'$x'H'$sty$top$z$'\e['$(( r0 + tr + 2 ))';'$x'H'$sty$bot$z
    for (( r = 0; r < tr; r++ )); do
      buf+=$'\e['$(( r0 + 2 + r ))';'$x'H'$sty$side$z$'\e['$(( r0 + 2 + r ))';'$(( x + tc + 1 ))'H'$sty$side$z
    done
    pd=(${=bgpic[$pal:$keys[k]]})
    fill=$dir/$pd[2]
    [[ -r $fill ]] || continue
    __tt_bg_send $fill
    id=$REPLY
    want="$id $(( r0 + 2 )) $(( x + 1 )) $tc $tr"
    __tt_bg_lasting && [[ ${bgthumb[$slot]} == "$want" ]] && continue
    if [[ -n ${bgthumb[$slot]} ]]; then
      printf -v cmd '\e_Ga=d,d=i,i=%d,p=%d,q=2\e\\' ${${=bgthumb[$slot]}[1]} $(( 700000 + slot ))
      buf+=$cmd
    fi
    printf -v cmd '\e[%d;%dH\e_Ga=p,i=%d,p=%d,c=%d,r=%d,C=1,z=-1,q=2\e\\' $(( r0 + 2 )) $(( x + 1 )) $id $(( 700000 + slot )) $tc $tr
    buf+=$cmd
    bgthumb[$slot]=$want
  done
  for slot in ${(k)bgthumb}; do
    (( slot > show )) || continue
    printf -v cmd '\e_Ga=d,d=i,i=%d,p=%d,q=2\e\\' ${${=bgthumb[$slot]}[1]} $(( 700000 + slot ))
    buf+=$cmd
    unset "bgthumb[$slot]"
  done
  print -rn -- "$buf"
}

__tt_pv_bg_strip_off() {
  local slot
  for slot in ${(k)bgthumb}; do
    printf '\e_Ga=d,d=i,i=%d,p=%d,q=2\e\\' ${${=bgthumb[$slot]}[1]} $(( 700000 + slot ))
  done
  bgthumb=()
}

__tt_pv_bg_close() {
  (( bgcw )) && { printf '\e_Ga=d,d=A,q=2\e\\'; __tt_bg_forget }
  [[ -z $bgcut ]] || { rm -rf -- $bgcut; bgcut="" }
}

__tt_pv_bg_save() {
  local img name note err REPLY
  local -a saved=()
  (( ${#bgedit} + ${#bgswap} )) || return 0
  for img in ${(ok)bgedit}; do
    if ! __tt_bg_write $img; then
      print -u2 "ttheme: could not save the background of ${img%:*}"
      continue
    fi
    (( ${saved[(Ie)${img%:*}]} )) || saved+=(${img%:*})
  done
  for name in ${(ok)bgswap}; do
    if ! err=$(__tt_cli image $name show ${bgswap[$name]} 2>&1); then
      print -u2 -r -- "$err"
      continue
    fi
    (( ${saved[(Ie)$name]} )) || saved+=($name)
  done
  for name in $saved; do
    __tt_pv_shows $name
    img=$REPLY
    if [[ ! -r ${TTHEME_CONFIG:h}/backgrounds/${${name/@/--}/\//--}.conf ]]; then
      note="Background · $name none"
    elif (( bgoff[$img] )); then
      note="Background · $name off"
    else
      __tt_bg_label $img
      note="Background · $name $REPLY"
    fi
    if __tt_color; then
      printf '\033[2m%s\033[0m\n' "$note"
    else
      print -r -- "$note"
    fi
  done
  (( ${#saved} )) && __tt_bg_saved $saved
  return 0
}
