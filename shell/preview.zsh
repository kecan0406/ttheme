__tt_pv_norm() { REPLY=${(L)1//[^[:alnum:]]/} }

__tt_pv_seek() {
  local t part key REPLY
  for t in ${(k)TTHEME_PALETTE}; do
    key=""
    for part in "$t" "${TTHEME_GROUP[$t]:-Other}" "${TTHEME_NATIVE[$t]}" "${TTHEME_CATALOG[$t]}" "${(@s:|:)TTHEME_NATIVE_NAMES[$t]}" "${TTHEME_CHARACTER[$t]}" "${(@s:|:)TTHEME_ALIASES[$t]}"; do
      [[ -n $part ]] || continue
      __tt_pv_norm "$part"
      key+="|$REPLY"
    done
    pvseek[$t]=$key
  done
}

__tt_pv_alias() {
  REPLY=""
  [[ -n $nflt && -n $2 ]] || return 0
  local main
  __tt_pv_norm "$1"
  main=$REPLY
  __tt_pv_norm "$2"
  [[ $main != *$nflt* && $REPLY == *$nflt* ]] && REPLY=$2 || REPLY=""
  return 0
}

__tt_pv_rows() {
  rtype=() rval=() rcnt=()
  local g t c ruled="" nflt="" REPLY
  local -a ts cs loose inside
  if [[ -n $flt ]]; then
    (( ${#pvseek} )) || __tt_pv_seek
    __tt_pv_norm "$flt"
    nflt=$REPLY
  fi
  for g in $groups; do
    ts=()
    for t in ${=gthemes[$g]}; do
      [[ -z $flt || ${pvseek[$t]} == *$nflt* ]] && ts+=($t)
    done
    [[ -n $flt ]] && (( ! ${#ts} )) && continue
    if [[ $g == *@* && -z $ruled ]]; then
      ruled=1
      (( ${#rtype} )) && { rtype+=(rule); rval+=(''); rcnt+=(0) }
    fi
    rtype+=(hdr); rval+=($g); rcnt+=(${#ts})
    [[ -n $flt || -n ${exp[$g]} ]] || continue
    cs=() loose=()
    for t in $ts; do
      c=${TTHEME_CATALOG[$t]}
      if [[ -n $c && $g == *@* ]]; then
        (( ${cs[(Ie)$c]} )) || cs+=($c)
      else
        loose+=($t)
      fi
    done
    for c in $cs; do
      inside=()
      for t in $ts; do
        [[ ${TTHEME_CATALOG[$t]} == "$c" ]] && inside+=($t)
      done
      rtype+=(cat); rval+=("$g/$c"); rcnt+=(${#inside})
      if [[ -n $flt || -n ${exp[$g/$c]} ]]; then
        for t in $inside; do rtype+=(thm); rval+=($t); rcnt+=(0); done
      fi
    done
    for t in $loose; do rtype+=(thm); rval+=($t); rcnt+=(0); done
  done
}

__tt_pv_at() {
  local i
  for (( i = 1; i <= ${#rval}; i++ )); do
    [[ ${rtype[i]} == (hdr|cat) && ${rval[i]} == "$1" ]] && { cur=$i; return 0 }
  done
  return 0
}

__tt_pv_first() {
  local name=$1 i
  cur=1 top=1
  if [[ -n $name ]]; then
    for (( i = 1; i <= ${#rval}; i++ )); do
      [[ ${rtype[i]} == thm && ${rval[i]} == $name ]] && { cur=$i; return 0 }
    done
  fi
  for (( i = 1; i <= ${#rtype}; i++ )); do
    [[ ${rtype[i]} == thm ]] && { cur=$i; return 0 }
  done
  return 0
}

__tt_pv_goto() {
  local name=$1 i g=${TTHEME_GROUP[$1]:-Other} c=${TTHEME_CATALOG[$1]}
  exp[$g]=1
  [[ -n $c && $g == *@* ]] && exp[$g/$c]=1
  __tt_pv_rows
  for (( i = 1; i <= ${#rval}; i++ )); do
    [[ ${rtype[i]} == thm && ${rval[i]} == $name ]] && { cur=$i; return 0 }
  done
  cur=1
}

__tt_pv_shows() {
  REPLY=${bgview[$1]:-$1}
  [[ -n $tune && $1 == "$tune" ]] && REPLY=$tpick
  return 0
}

__tt_pv_focus() {
  if (( te )); then
    __tt_pv_shows $tename
    if (( ! resized )) && [[ $REPLY != "$bgname" || "${tespec%% *} ${teframe[11]}" != "$telook" ]]; then
      __tt_pv_bg_show "$REPLY"
      telook="${tespec%% *} ${teframe[11]}"
    fi
    return 0
  fi
  [[ ${rtype[cur]} == thm ]] || return 0
  __tt_pv_shows ${rval[cur]}
  (( resized )) || [[ $REPLY == "$bgname" ]] || __tt_pv_bg_show "$REPLY"
  local spec=${TTHEME_PALETTE[${rval[cur]}]}
  [[ $spec == "$applied" ]] && return 0
  __tt_pv_paint "$spec"
  applied=$spec
}

__tt_pv_toggle() {
  [[ -n $flt ]] && return 0
  local g=${rval[cur]}
  if [[ -n ${exp[$g]} ]]; then
    exp[$g]=""
  else
    exp[$g]=1
  fi
  __tt_pv_rows
}

__tt_pv_left() {
  [[ -n $flt ]] && return 0
  if [[ ${rtype[cur]} == (hdr|cat) ]]; then
    if [[ -n ${exp[${rval[cur]}]} ]]; then
      __tt_pv_toggle
    elif [[ ${rtype[cur]} == cat ]]; then
      __tt_pv_at ${rval[cur]%%/*}
    fi
    return 0
  fi
  local g=${TTHEME_GROUP[${rval[cur]}]:-Other} c=${TTHEME_CATALOG[${rval[cur]}]}
  [[ -n $c && $g == *@* ]] && g=$g/$c
  exp[$g]=""
  __tt_pv_rows
  __tt_pv_at $g
}

typeset -gA TTHEME_GLYPHS=(
  0 111101101101111 1 010110010010111 2 111001111100111 3 111001111001111 4 101101111001001
  5 111100111001111 6 111100111101111 7 111001001001001 8 111101111101111 9 111101111001111
  '%' 101001010100101 F 111100110100100 I 111010010010111 L 100100100100111
)

__tt_pv_osd() {
  local text=${(U)osd} bits line oc=$'\e[1m' blank
  local -i s=2 n=${#text} w r c k i top left
  (( n * 16 + 4 <= pw && ph >= 14 )) || s=1
  w=$(( n * 8 * s - 2 * s + 4 ))
  top=$(( (ph - 5 * s) / 2 )) left=$(( (pw - w) / 2 + 1 ))
  (( top < 2 )) && top=2
  (( left < 1 )) && left=1
  if (( color )) && [[ ${rtype[cur]} == thm ]]; then
    local -a fp=(${=TTHEME_PALETTE[${rval[cur]}]})
    local fc=${fp[3]#\#}
    printf -v oc '\e[1;38;2;%d;%d;%dm' $((16#${fc:0:2})) $((16#${fc:2:2})) $((16#${fc:4:2}))
  fi
  blank=${(l:w:: :)}
  out+=$'\e['$(( top - 1 ))';'${left}H$blank
  for (( r = 0; r < 5; r++ )); do
    line="  "
    for (( k = 1; k <= n; k++ )); do
      bits=${TTHEME_GLYPHS[${text[k]}]}
      for (( c = 1; c <= 3; c++ )); do
        if [[ ${bits[r * 3 + c]} == 1 ]]; then
          line+=${(l:2*s::█:)}
        else
          line+=${(l:2*s:: :)}
        fi
      done
      (( k < n )) && line+=${(l:2*s:: :)}
    done
    line+="  "
    for (( i = 0; i < s; i++ )); do
      out+=$'\e['$(( top + r * s + i ))';'${left}H$oc$line$'\e[0m'
    done
  done
  out+=$'\e['$(( top + 5 * s ))';'${left}H$blank
}

__tt_pv_lw() {
  local -i lw=$(( pw - 2 < 48 ? pw - 2 : 48 )) l=$(( pw * 3 / 10 )) sw=$(( pw * 45 / 100 ))
  (( l < 38 )) && l=38
  (( l > 56 )) && l=56
  (( sw > 64 )) && sw=64
  if (( te && sw < 50 )); then
    sw=50
    (( pw - l - 6 < sw )) && l=$(( pw - sw - 6 ))
    (( l < 30 )) && l=30
  fi
  (( sw > pw - l - 6 )) && sw=$(( pw - l - 6 ))
  if (( color && sw >= 32 )); then
    lw=$l
  else
    sw=0
  fi
  reply=($lw $sw)
}

__tt_pv_hl() {
  local t=$1 lt=${(L)1} pre
  REPLY=$t
  (( color )) && [[ -n $flt && $lt == *$flt* ]] || return 0
  pre=${lt%%$flt*}
  REPLY=${t[1,${#pre}]}$'\e[1;4m'$ac${t[${#pre}+1,${#pre}+${#flt}]}$'\e[22;24;39m'$2${t[${#pre}+${#flt}+1,-1]}
}

__tt_pv_fit() {
  local extra=$1
  REPLY=""
  [[ -n $extra ]] || return 0
  while [[ -n $extra ]] && (( ${(m)#extra} + 3 > w )); do
    extra=${extra[1,-2]}
  done
  [[ -n $extra ]] || return 0
  (( w -= ${(m)#extra} + 2 ))
  REPLY="  "$d$extra$r
}

__tt_pv_row() {
  local t=${rval[$1]} b=$'\e[1m' d=$'\e[2m' r=$'\e[22;24;39m' z=$'\e[0m' on="" gut="  " base="" lead=$'\e[2m' mark=" " name arrow=▸ ind="   " hl extra part
  local -i w
  (( color )) || b= d= r= z= lead=
  if (( $1 == cur )); then
    gut=$ac"▌"$r" "
    (( color )) && on=$sb
  fi
  if [[ ${rtype[$1]} == rule ]]; then
    name='── Markets '
    REPLY="   "$d$name${(l:lw - 4 - ${#name}::─:)}$z
    return 0
  fi
  if [[ ${rtype[$1]} == hdr ]]; then
    [[ -n $flt || -n ${exp[$t]} ]] && arrow=▾
    name=$t
    (( ${(m)#name} > lw - 10 )) && name="${name[1,lw-11]}…"
    base=$b
    if (( color )) && [[ $t == "$ag" ]]; then
      base+=$ac lead=$ac
    elif (( $1 == cur )); then
      lead=""
    fi
    __tt_pv_hl "$name" "$base"
    hl=$REPLY
    w=$(( lw - 6 - ${(m)#name} - ${#rcnt[$1]} ))
    __tt_pv_alias "$t" "${TTHEME_NATIVE[${${=gthemes[$t]}[1]}]}"
    __tt_pv_fit "$REPLY"
    extra=$REPLY
    (( w < 1 )) && w=1
    REPLY=$gut$on" "$lead$arrow$r" "$base$hl$r$extra${(l:w:: :)}$d${rcnt[$1]}$r" "$z
    return 0
  fi
  if [[ ${rtype[$1]} == cat ]]; then
    [[ -n $flt || -n ${exp[$t]} ]] && arrow=▾
    name=${t#*/}
    (( ${(m)#name} > lw - 12 )) && name="${name[1,lw-13]}…"
    base=$b
    if (( color )) && [[ $t == "$acat" ]]; then
      base+=$ac lead=$ac
    elif (( $1 == cur )); then
      lead=""
    fi
    __tt_pv_hl "$name" "$base"
    w=$(( lw - 8 - ${(m)#name} - ${#rcnt[$1]} ))
    (( w < 1 )) && w=1
    REPLY=$gut$on"   "$lead$arrow$r" "$base$REPLY$r${(l:w:: :)}$d${rcnt[$1]}$r" "$z
    return 0
  fi
  if (( $1 == cur )); then
    mark=$ac"■"$r base=$b
  elif [[ -n $cdot && $t == "$cn" ]]; then
    mark=$cdot
  fi
  name=${t##*/}
  [[ -n ${TTHEME_CATALOG[$t]} && ${TTHEME_GROUP[$t]} == *@* ]] && ind="     "
  __tt_pv_hl "$name" "$base"
  hl=$REPLY
  extra=""
  for part in "${(@s:|:)TTHEME_NATIVE_NAMES[$t]}" "${TTHEME_CHARACTER[$t]}" "${(@s:|:)TTHEME_ALIASES[$t]}"; do
    __tt_pv_alias "$name" "$part"
    [[ -n $REPLY ]] && { extra=$REPLY; break }
  done
  if (( color )); then
    [[ -n ${tstrip[$t]} ]] || __tt_pv_strip $t
    w=$(( lw - 16 - ${#ind} - ${#name} ))
    __tt_pv_fit "$extra"
    (( w < 1 )) && w=1
    REPLY=$gut$on"$ind$mark $base$hl$r$REPLY${(l:w:: :)}${tstrip[$t]} "$z
  else
    REPLY="$gut$ind$mark $hl${extra:+  $extra}"
  fi
}

__tt_pv_bg_title() {
  local by=${bgby[$tpick]} ref=${bgfrom[$tpick]} url=${bgurl[$tpick]} mark="" sgr=""
  local -i room=$1
  [[ -n $ref && $url == http(s|)://* ]] && __tt_links && mark="⧉ "
  REPLY=Background${by:+ · $by}${ref:+ · $mark$ref}$2
  (( ${#REPLY} > room )) && REPLY=Background${by:+ · $by}
  (( ${#REPLY} > room )) && REPLY=Background
  [[ -n $mark && $REPLY == *"$mark$ref"* ]] || return 0
  (( color )) && [[ -n ${TTHEME_SITE_ANSI[${ref%% *}]} ]] && sgr=$'\e[3'${TTHEME_SITE_ANSI[${ref%% *}]}m
  REPLY=${REPLY/"$mark$ref"/$sgr⧉${sgr:+$'\e[39m'} $'\e]8;;'$url$'\e\\'$ref$'\e]8;;\e\\'}
  return 0
}

__tt_pv_bar() {
  local z=$'\e[0m' d=$'\e[2m' on=$'\e[7;1m'$ac line=" " title hint="tab next"
  local -i i at=${TTHEME_HUB_TABS[(Ie)preview]} len=${#TTHEME_HUB_TITLES}
  (( color )) || z= d= on=
  [[ ${rtype[cur]} == thm ]] && hint="⇧tab switch"
  for title in $TTHEME_HUB_TITLES; do
    (( len += ${#title} + 2 ))
  done
  local -i zc=2
  for (( i = 1; i <= ${#TTHEME_HUB_TITLES}; i++ )); do
    title=${TTHEME_HUB_TITLES[i]}
    (( i > 1 )) && { line+=" "; (( zc++ )) }
    pvz+=("1 $zc $(( zc + ${(m)#title} + 1 )) hub $i")
    (( zc += ${(m)#title} + 2 ))
    if (( i != at )); then
      line+=$d" $title "$z
    elif (( color )); then
      line+=$on" $title "$z
    else
      line+="[$title]"
    fi
  done
  (( len + ${#hint} + 2 <= $1 )) && line+="  "$d$hint$z
  REPLY=$line
}

__tt_pv_head() {
  local b=$'\e[1m' d=$'\e[2m' z=$'\e[0m' right=$6
  (( color )) || b= d= z=
  out+=$'\e['$1';'$2'H'$b$ac$4$z
  [[ -n $5 ]] && out+="  "$d$5$z
  [[ -n $right ]] && out+=$'\e['$(( $3 - ${(m)#right} + 1 ))'G'$d$right$z
  return 0
}

__tt_pv_foot() {
  setopt localoptions extendedglob
  local b=$'\e[1m' d=$'\e[2m' z=$'\e[0m' y=$'\e[33m' on=$'\e[7;1m'$ac badge="" lead="" note="" right="" text line plain hex tb=EDIT
  local -a kk=() kl=() seg=()
  local -i end=$1 i lwid rwid room
  (( color )) || b= d= z= y= on=
  if (( color )) && [[ -n $applied && $applied != "$painted" ]]; then
    hex=${${=applied}[8]#\#}
    printf -v y '\e[38;2;%d;%d;%dm' $((16#${hex:0:2})) $((16#${hex:2:2})) $((16#${hex:4:2}))
  fi
  if (( help )); then
    badge=HELP right=$b"? esc"$z$d" close"$z
  elif [[ -n $pick ]]; then
    badge='PREVIEW (APPLY)' lead="$pick →"
    (( te )) && badge="$tb (APPLY)"
    for (( i = 1; i <= ${#plabel}; i++ )); do
      if (( i != pk )); then
        lead+=" "$d${plabel[i]}$z
      elif (( color )); then
        lead+=" "$on${plabel[i]}$z
      else
        lead+=" [${${plabel[i]# }% }]"
      fi
    done
    if [[ $mode == pin ]]; then
      badge='PREVIEW (PIN)'
      (( te )) && badge="$tb (PIN)"
      __tt_pin_where "${pkeys[pk]}"
      note=$REPLY
    elif (( pk == 2 )); then
      note="Until this tab closes"
    else
      note="New tabs · the default palette"
    fi
    kk=(enter) kl=(confirm)
    right=$b"esc"$z$d" back"$z
  elif (( te && tfocus == 0 )); then
    badge=$tb
    kk=("${(@ps:\x1e:)teframe[6]}") kl=("${(@ps:\x1e:)teframe[7]}")
    i=${kk[(Ie)esc]}
    (( i )) && kk[i]=() kl[i]=()
    right=$b"esc"$z$d" cancel"$z
    if [[ $temode == list ]]; then
      kk=("${kk[1]}" s "${(@)kk[2,-1]}" ⇧enter) kl=("${kl[1]}" save "${(@)kl[2,-1]}" apply)
    elif [[ $temode == tune ]]; then
      badge="$tb (TUNE)" right=$b"esc"$z$d" undo"$z
    elif [[ $temode == type ]]; then
      badge="$tb (TYPE)" right=$b"esc"$z$d" back"$z
    elif [[ $temode == compare ]]; then
      badge="$tb (BEFORE)" right=$b"esc"$z$d" back"$z
    fi
  elif (( te && tfocus == 2 )); then
    badge=$tb kk=(enter ↑↓ s) kl=(apply move save)
    right=$b"esc"$z$d" cancel"$z
  elif (( te )); then
    badge=$tb
    kk=(↑↓ ←→ s) kl=(field step save)
    if [[ -n $tune ]] && (( tf == 5 )); then
      __tt_pv_bg_images $tune
      kl[2]="image ×$REPLY"
      (( REPLY > 1 )) || { kk[2]=() kl[2]=() }
      __tt_pv_bg_findable $tune && { kk+=(f); kl+=(find) }
      kk+=(D) kl+=(remove)
    elif [[ -n $tune ]]; then
      __tt_pv_bg_findable $tune && { kk+=(f); kl+=(find) }
      if (( tf == 2 )); then
        kl[2]=move kk+=(1-9 '=' +) kl+=(place reset "reset all")
      elif (( tf == 4 )); then
        kl[2]=switch kk+=(+) kl+=("reset all")
      else
        kk+=('=' + ⇧←→) kl+=(reset "reset all" ×10)
      fi
      (( bgoff[$tpick] )) && { kk+=(space); kl+=(show) } || { kk+=(c space); kl+=(colors hide) }
      __tt_pv_bg_images $tune
      (( REPLY > 1 )) && { kk+=(', .' D); kl+=("image ×$REPLY" remove) }
    else
      kk=(enter ↑↓ s) kl=(find move save)
    fi
    kk+=(⇧enter) kl+=(apply)
    right=$b"esc"$z$d" cancel"$z
  elif (( conf )); then
    badge=CONFIG kk=(↑↓ ←→ enter) kl=(setting value save)
    right=$b"esc"$z$d" undo"$z
  else
    badge=PREVIEW
    [[ -n $flt ]] && badge='PREVIEW (FILTER)'
    if (( ! ${#rval} )); then
      kk=(bksp) kl=(edit)
    elif [[ ${rtype[cur]} == (hdr|cat) ]]; then
      if [[ -z $flt && -n ${exp[${rval[cur]}]} ]]; then
        kk=(←) kl=(close)
      elif [[ -z $flt ]]; then
        kk=(→) kl=(open)
      fi
    else
      kk=(enter tab) kl=(apply edit)
      (( split )) && { kk+=(⇧←→); kl+=(example) }
      [[ -n $flt ]] && { kk+=(bksp); kl+=(edit) }
    fi
    kk+=('?') kl+=(keys)
    if [[ -n $flt ]]; then
      right=$b"esc"$z$d" clear filter"$z
    else
      right=$b"esc"$z$d" restore"$z
      [[ -n $cdot ]] && right+=" $cdot$z $cn"
    fi
  fi
  if (( msgt > 0 )) && [[ -z $pick ]]; then
    text=$msg
    room=$(( end - (${#badge} ? ${#badge} + 4 : 0) ))
    if (( ${(m)#text} > room )); then
      while [[ -n $text ]] && (( ${(m)#text} > room - 1 )); do text=${text[1,-2]}; done
      text+=…
    fi
    lead=$y$text$z note="" kk=() kl=()
  fi
  while :; do
    seg=()
    [[ -n $lead ]] && seg+=("$lead")
    [[ -n $note ]] && seg+=("$d$note$z")
    for (( i = 1; i <= ${#kk}; i++ )); do
      seg+=("$b${kk[i]}$z$d ${kl[i]}$z")
    done
    line=${(j:   :)seg}
    if [[ -n $badge ]]; then
      if (( color )); then
        line=$'\e[7;1m'$ac" $badge "$z"  "$line
      else
        line="[$badge] $line"
      fi
    fi
    plain=${line//$'\e'\[[0-9;]##m/}
    lwid=${(m)#plain}
    plain=${right//$'\e'\[[0-9;]##m/}
    rwid=${(m)#plain}
    (( lwid <= end && (! rwid || lwid + 3 + rwid <= end) )) && break
    if [[ -n $note ]]; then
      note=""
    elif (( ${#kk} > 2 )); then
      kk[-2]=() kl[-2]=()
    elif [[ -n $right ]]; then
      right=""
    elif (( ${#kk} > 1 )); then
      kk[-2]=() kl[-2]=()
    else
      break
    fi
  done
  out+=$line$'\e[K'
  [[ -n $right ]] && out+=$'\e['$(( end - rwid + 1 ))'G'$right
  local -i zc=1 zw
  [[ -n $badge ]] && (( zc += ${(m)#badge} + (color ? 4 : 3) ))
  if [[ -n $lead ]]; then
    if [[ -n $pick ]]; then
      zw=$(( zc + ${(m)#pick} + 2 ))
      for (( i = 1; i <= ${#plabel}; i++ )); do
        pvz+=("$ph $(( zw + 1 )) $(( zw + ${(m)#plabel[i]} )) pick $i")
        (( zw += ${(m)#plabel[i]} + 1 ))
      done
    fi
    plain=${lead//$'\e'\[[0-9;]##m/}
    (( zc += ${(m)#plain} + 3 ))
  fi
  [[ -n $note ]] && (( zc += ${(m)#note} + 3 ))
  for (( i = 1; i <= ${#kk}; i++ )); do
    zw=$(( ${(m)#kk[i]} + 1 + ${(m)#kl[i]} ))
    pvz+=("$ph $zc $(( zc + zw - 1 )) key ${kk[i]}")
    (( zc += zw + 3 ))
  done
  if [[ -n $right ]]; then
    plain=${right//$'\e'\[[0-9;]##m/}
    pvz+=("$ph $(( end - rwid + 1 )) $end key ${plain%% *}")
  fi
  return 0
}

__tt_pv_help() {
  local back="the tab" z=$'\e[0m' b=$'\e[1m' blank
  [[ -n ${TTHEME_PALETTE[$cn]} ]] && back=$cn
  local -a hk=() hv=()
  if (( te )); then
    hk=(Move Image "" "" "" Palette "" "" "" "" "" Apply Save Cancel)
    hv=(
      "↑↓ j k  the image, the palette, then Apply  ·  home  end"
      "Images  ←→  , .  pick one  ·  D removes it  ·  f  finds one"
      "enter on the empty frame  ·  finds the first one"
      "←→ step  ⇧←→ ×10  1-9 place  ·  =  resets  ·  +  all"
      "space  hides  ·  c  colors"
      "←→  normal or bright  ·  enter tab  tune it  ·  #  a color"
      "tuning: ↑↓ L C H ◐  ·  ◐ home  the floor  ·  a  scope"
      "g  relations  ·  n N  the next and last miss"
      "r  resets a slot  ·  R  all  ·  space  the colors before"
      "c  copies  ·  v  pastes  ·  =  bright follows normal"
      "f  moves the colors the gate misses  ·  u  undo"
      "enter on Apply, or ⇧enter anywhere  ·  saves, asks where"
      "s  ·  keeps the picture and the palette"
      "esc  ·  back to the list, dropping what changed since s"
    )
  else
    hk=(Move Series Filter "" Example Apply Edit)
    hv=(
      "↑↓  home  end  pgup  pgdn"
      "←→  ·  enter or space on a series"
      "Any text  ·  bksp  ·  ctrl-u clears"
      "Names and titles, in Japanese too"
      "⇧←→  ${(Lj:, :)TTHEME_SCENES}"
      "enter  applies  ·  esc restores $back"
      "tab  →  ctrl+e  ·  its colors and picture"
    )
    hk+=(Config "")
    hv+=("alt-c  ·  ↑↓ setting  ←→ value" "enter saves  ·  esc undoes")
    (( hub )) && { hk+=(Screens); hv+=("shift+tab  ·  tab on a series") }
  fi
  hk+=(Close)
  hv+=("?  esc")
  (( color )) || z= b=
  local -i i r x y w hh
  if (( split && sw >= 48 )); then
    for (( i = 1; i <= ${#hk}; i++ )); do
      r=$(( i + 3 ))
      (( r < ph )) || break
      out+=$'\e['$r';'$sc'H'$b${hk[i]}$z$'\e['$r';'$(( sc + 10 ))'H'${hv[i][1,se-sc-9]}
    done
    return 0
  fi
  w=$(( pw - 2 < 58 ? pw - 2 : 58 )) hh=$(( ${#hk} + 4 ))
  (( te )) && w=$(( pw - 2 < 76 ? pw - 2 : 76 ))
  x=$(( (pw - w) / 2 + 1 )) y=$(( (ph - hh) / 2 ))
  (( y < 4 )) && y=4
  blank=${(l:w:: :)}
  out+=$'\e['$y';'$x'H'"╭─ Help ${(l:$(( w - 9 ))::─:)}╮"
  for (( r = y + 1; r < y + hh - 1; r++ )); do
    out+=$'\e['$r';'$x'H'$blank$'\e['$r';'$x'H│'$'\e['$r';'$(( x + w - 1 ))'H│'
  done
  for (( i = 1; i <= ${#hk}; i++ )); do
    r=$(( y + 1 + i ))
    out+=$'\e['$r';'$(( x + 3 ))'H'$b${hk[i]}$z$'\e['$r';'$(( x + 13 ))'H'${hv[i][1,w-16]}
  done
  out+=$'\e['$(( y + hh - 1 ))';'$x'H'"╰${(l:$(( w - 2 ))::─:)}╯"
}

__tt_pv_specimen() {
  local -a sp=(${=applied}) lines parts
  (( ${#sp} >= 20 )) || return 0
  local z=$'\e[0m' d=$'\e[2m' cell hex fore line text piece role tabs="" built="" key="$applied|$painted|$scene|$sw|$sc|$ph"
  local -A rs=(p "" d $'\e[2m' b $'\e[1m')
  local -i i r=6 cw=4 k n=${#TTHEME_SCENES} at
  (( n )) || return 0
  if [[ $key == "$pvscene" ]]; then
    out+=$pvscenes
    return 0
  fi
  at=$(( (scene % n + n) % n + 1 ))
  if [[ $applied == "$painted" ]]; then
    for (( i = 0; i < 16; i++ )); do
      k=$(( i < 8 ? 30 + i : 82 + i ))
      rs[$i]=$'\e['$k'm' rs[B$i]=$'\e[1;'$k'm' rs[K$i]=$'\e[30;'$(( k + 10 ))'m'
    done
  else
    fore=${sp[5]#\#}
    for (( i = 0; i < 16; i++ )); do
      hex=${sp[i+5]#\#}
      printf -v cell '\e[38;2;%d;%d;%dm' $((16#${hex:0:2})) $((16#${hex:2:2})) $((16#${hex:4:2}))
      rs[$i]=$cell
      printf -v cell '\e[38;2;%d;%d;%d;48;2;%d;%d;%dm' $((16#${fore:0:2})) $((16#${fore:2:2})) $((16#${fore:4:2})) \
        $((16#${hex:0:2})) $((16#${hex:2:2})) $((16#${hex:4:2}))
      rs[K$i]=$cell
      hex=${sp[(i < 8 ? i + 13 : i + 5)]#\#}
      printf -v cell '\e[1;38;2;%d;%d;%dm' $((16#${hex:0:2})) $((16#${hex:2:2})) $((16#${hex:4:2}))
      rs[B$i]=$cell
    done
  fi
  printf -v cell '\e[48;2;%d;%d;%dm' $((16#${sp[4]:1:2})) $((16#${sp[4]:3:2})) $((16#${sp[4]:5:2}))
  rs[s]=$cell
  printf -v cell '\e[48;2;%d;%d;%dm' $((16#${sp[3]:1:2})) $((16#${sp[3]:3:2})) $((16#${sp[3]:5:2}))
  rs[c]=$cell
  if (( ${#${(j:  :)TTHEME_SCENES}} <= sw )); then
    for (( k = 1; k <= n; k++ )); do
      (( k > 1 )) && tabs+="  "
      if (( k == at )); then
        tabs+=$'\e[1m'$ac$TTHEME_SCENES[k]$z
      else
        tabs+=$d$TTHEME_SCENES[k]$z
      fi
    done
  else
    tabs=$'\e[1m'$ac$TTHEME_SCENES[at]$z"  "$d"$at/$n"$z
  fi
  built+=$'\e[2;'$sc'H'$tabs
  (( sw < 44 )) && cw=3
  (( sw >= 56 )) && cw=$(( (sw + 1) / 8 - 1 ))
  (( cw > 7 )) && cw=7
  line=""
  for (( i = 0; i < 8; i++ )); do
    fore=${sp[i+5]#\#} hex=${sp[i+13]#\#}
    printf -v cell '\e[38;2;%d;%d;%d;48;2;%d;%d;%dm%s\e[0m ' \
      $((16#${fore:0:2})) $((16#${fore:2:2})) $((16#${fore:4:2})) \
      $((16#${hex:0:2})) $((16#${hex:2:2})) $((16#${hex:4:2})) "${(l:cw::▀:)}"
    line+=$cell
  done
  built+=$'\e[4;'$sc'H'$line
  lines=("${(@P)${:-TTHEME_SCENE_$at}}")
  for line in "${lines[@]}"; do
    [[ $line == «w»* ]] && (( sw < 44 )) && continue
    [[ $line == «n»* ]] && (( sw >= 44 )) && continue
    (( r < ph )) || break
    parts=("${(@s:«:)line}")
    text=$parts[1]
    for piece in "${(@)parts[2,-1]}"; do
      role=${piece%%»*}
      [[ $role == [wn] ]] && role=p
      text+=$z${rs[${role:-p}]}${piece#*»}
    done
    built+=$'\e['$r';'$sc'H'$text$z
    (( ++r ))
  done
  pvscene=$key pvscenes=$built
  out+=$built
}

__tt_pv_tune() {
  local -a fields=(size pos op)
  local -i n=1
  local name
  case $key in
    $'\x03') return 1 ;;
    up) tf=$(( tf > 1 ? tf - 1 : 4 )) ;;
    down) tf=$(( tf < 4 ? tf + 1 : 1 )) ;;
    c) (( bgoff[$tpick] )) || __tt_pv_bg_recolor ;;
    left|right|sleft|sright)
      if (( tf == 4 )); then
        (( bgoff[$tpick] )) || __tt_pv_bg_recolor
        return 0
      fi
      [[ $key == *left ]] && n=-1
      [[ $key == s* ]] && (( tf != 2 )) && n=$(( n * 10 ))
      __tt_pv_bg_adjust ${fields[tf]} $n
      ;;
    [1-9])
      tf=2
      __tt_pv_bg_adjust at $key
      ;;
    ' ') __tt_pv_bg_adjust on ;;
    '=') (( tf == 4 )) || __tt_pv_bg_adjust def $tf ;;
    '+') __tt_pv_bg_adjust def ;;
    ',') __tt_pv_bg_pick -1 ;;
    '.') __tt_pv_bg_pick 1 ;;
    D) __tt_pv_bg_drop ;;
  esac
  return 0
}

__tt_pv_tune_stage() {
  local img was=${bgview[$tune]:-$tune}
  local -i changed=0
  for img in ${(k)tsnaps}; do
    [[ "${bgsize[$img]} ${bgpos[$img]} ${bgop[$img]} ${bgoff[$img]}" == "${tsnaps[$img]}" ]] && continue
    bgedit[$img]=1 changed=1
  done
  if [[ $tpick != "$was" ]]; then
    changed=1
    if [[ $tpick == "$tune" ]]; then
      unset "bgview[$tune]" "bgswap[$tune]"
    else
      bgview[$tune]=$tpick bgswap[$tune]=${tpick##*:}
    fi
  fi
  (( changed )) && msg="Kept · saved when preview closes" msgt=200
  tune="" tpick="" tsnaps=() bgname=""
}

__tt_pv_tune_keep() {
  __tt_pv_bg_strip_off
  __tt_pv_tune_stage
}

__tt_pv_untune() {
  local img
  local -a s
  for img in ${(k)tsnaps}; do
    s=(${=tsnaps[$img]})
    bgsize[$img]=$s[1] bgpos[$img]=$s[2] bgop[$img]=$s[3] bgoff[$img]=$s[4]
  done
  __tt_pv_bg_strip_off
  tune="" tpick="" tsnaps=() bgname=""
}

__tt_pv_regroup() {
  local ty=${rtype[cur]} v=${rval[cur]} i
  __tt_pv_group
  __tt_pv_rows
  for (( i = 1; i <= ${#rval}; i++ )); do
    [[ ${rtype[i]} == "$ty" && ${rval[i]} == "$v" ]] && { cur=$i; return 0 }
  done
  cur=1
}

__tt_pv_conf() {
  case $key in
    $'\x03') return 1 ;;
    up|k) cf=$(( cf > 1 ? cf - 1 : ${#cvars} )) ;;
    down|j) cf=$(( cf < ${#cvars} ? cf + 1 : 1 )) ;;
    left|sleft) __tt_pv_conf_step -1 ;;
    right|sright) __tt_pv_conf_step 1 ;;
    $'\r'|$'\n') __tt_pv_conf_save ;;
    esc) __tt_pv_unconf ;;
    '?') help=1 ;;
  esac
  return 0
}

__tt_pv_conf_step() {
  local var=${cvars[cf]}
  local -a ch=(${=cchoice[cf]})
  local -i i=${ch[(Ie)${(P)var}]}
  (( i += $1 ))
  (( i >= 1 && i <= ${#ch} )) || return 0
  __tt_pv_conf_put $var ${ch[i]}
}

__tt_pv_conf_put() {
  [[ ${(P)1} == "$2" ]] && return 0
  typeset -g "$1=$2"
  case $1 in
    TTHEME_SORT) __tt_pv_regroup ;;
    TTHEME_FX) [[ -n $flt ]] || { __tt_pv_roll; gstep=8 } ;;
    TTHEME_TAB_PALETTE) __tt_pv_canpick ;;
    TTHEME_MOUSE) __tt_pv_pointer ;;
  esac
}

__tt_pv_pointer() {
  if [[ $1 == off || $TTHEME_MOUSE == off ]]; then
    [[ -n $pvmouse ]] && printf '\e[?1006l\e[?1002l\e[?1000l'
    pvmouse="" mzone=""
  else
    pvmouse=$'\e[?1000h\e[?1002h\e[?1006h'
    printf %s "$pvmouse"
  fi
}

__tt_pv_unconf() {
  local -i i
  for (( i = 1; i <= ${#cvars}; i++ )); do
    __tt_pv_conf_put ${cvars[i]} "${csnap[i]}"
  done
  conf=0
}

__tt_pv_conf_save() {
  local var REPLY
  local -a pairs=()
  local -i i
  for (( i = 1; i <= ${#cvars}; i++ )); do
    var=${cvars[i]}
    [[ ${(P)var} == "${csnap[i]}" ]] || pairs+=($var "${(P)var}")
  done
  if (( ! ${#pairs} )); then
    conf=0
    return 0
  fi
  __tt_tilde "$TTHEME_CONFIG"
  if __tt_config_write "${pairs[@]}"; then
    conf=0 msg="Saved · $REPLY" msgt=200
    (( ${pairs[(Ie)TTHEME_BG_BLUR]} )) && __tt_pv_redraw
  else
    __tt_pv_unconf
    msg="Could not write $REPLY" msgt=200
  fi
}

__tt_pv_redraw() {
  local name out
  if (( $+functions[__tt_bg_write] )); then
    for name in ${(k)bgedit}; do
      __tt_bg_write $name
    done
  fi
  bgedit=()
  msg="Drawing the background pictures again" msgt=300
  printf '\e[?2026h'
  __tt_pv_draw
  out=$(__tt_cli redraw 2>&1)
  bgsrc=() resized=1 bgname="" bgshown="" bgdim=()
  __tt_reload
  (( $+functions[__tt_bg_refresh] )) && __tt_bg_refresh $TTHEME_ORDER
  msg=${${out//$'\n'/ }:-"Saved · no background pictures to draw"} msgt=300
}

__tt_pv_conf_panel() {
  local z=$'\e[0m' b=$'\e[1m' d=$'\e[2m' c=$ac on=$'\e[7;1m'$ac var v note
  local -a ch sh
  local -i r0=$1 col=$2 end=$3 k i j fit=1
  (( color )) || z= b= d= c= on=
  for (( k = 1; k <= ${#cvars}; k++ )); do
    sh=(${=cshow[k]})
    (( 13 + ${#${(j: :)sh}} + 2 * ${#sh} > end - col + 1 )) && fit=0
  done
  for (( k = 1; k <= ${#cvars}; k++ )); do
    var=${cvars[k]} ch=(${=cchoice[k]}) sh=(${=cshow[k]})
    i=${ch[(Ie)${(P)var}]}
    out+=$'\e['$(( r0 + k - 1 ))';'$col'H'
    pvz+=("$(( r0 + k - 1 )) $col $end conf $k")
    if (( k == cf )); then
      out+=$c"▶"$z" "$b
    else
      out+="  "$d
    fi
    out+=${(r:11:)clabel[k]}$z
    if (( ! fit )); then
      v=${(P)var}
      (( i )) && v=${sh[i]}
      if (( k == cf )); then
        out+=$c"‹ "$z$b$v$z$c" ›"$z
        pvz+=("$(( r0 + k - 1 )) $(( col + 13 )) $(( col + 14 )) confs $k -1")
        pvz+=("$(( r0 + k - 1 )) $(( col + 15 + ${(m)#v} )) $(( col + 17 + ${(m)#v} )) confs $k 1")
      else
        out+="  "$v
      fi
      continue
    fi
    local -i zc=$(( col + 13 ))
    for (( j = 1; j <= ${#sh}; j++ )); do
      (( j > 1 )) && (( zc++ ))
      pvz+=("$(( r0 + k - 1 )) $zc $(( zc + ${(m)#sh[j]} + 1 )) confv $k $j")
      (( zc += ${(m)#sh[j]} + 2 ))
      (( j > 1 )) && out+=" "
      if (( j != i )); then
        out+=$d" ${sh[j]} "$z
      elif (( ! color )); then
        out+="[${sh[j]}]"
      elif (( k == cf )); then
        out+=$on" ${sh[j]} "$z
      else
        out+=" ${sh[j]} "
      fi
    done
  done
  var=${cvars[cf]}
  note=${cnote[$var:${(P)var}]}
  [[ -n $note ]] && out+=$'\e['$(( r0 + ${#cvars} + 1 ))';'$col'H'$d${note[1,end-col+1]}$z
  return 0
}

__tt_pv_flush() {
  local REPLY
  print -rn -- "$out"
  if (( wiped )); then
    local bn=$bgname
    if [[ ${rtype[cur]} == thm ]]; then
      __tt_pv_shows ${rval[cur]}
      bn=$REPLY
    fi
    [[ -n $bn ]] && __tt_pv_bg_show "$bn" 1
  fi
  if [[ -n $bgstrip ]]; then
    __tt_pv_bg_strip ${=bgstrip}
  elif (( ${#bgthumb} )); then
    __tt_pv_bg_strip_off
  fi
  printf '\e[1;%dH\e[?2026l' $(( 4 + ${(m)#flt} ))
}

__tt_pv_reach() {
  local key=${pkeys[pk]} base top k home=${HOME:a} here=${PWD:a} htip="" d=$'\e[2m' z=$'\e[0m' REPLY
  local -A own=() below=() parent=() mark=() tstrip=()
  local -a roots=() lp=() lpw=() ll=() lat=() lpal=() lnote=() lflag=() reply was=()
  local -A TTHEME_PINS=("${(@kv)TTHEME_PINS}")
  local -i room=$2
  (( color )) || d= z=
  (( room < 2 )) && room=2
  if [[ $key == ssh:* ]]; then
    __tt_pin_scope "$key"
    [[ -n ${TTHEME_PINS[$key]} && $TTHEME_PINS[$key] != "$pick" ]] && was+=("${TTHEME_PINS[$key]} · $REPLY")
    TTHEME_PINS[$key]=$pick
    mark[$key]=new
    __tt_map_ssh
  else
    __tt_pin_base "$key"
    base=$REPLY
    for k in ${(k)TTHEME_PINS}; do
      [[ $k == /* ]] || continue
      __tt_pin_base "$k"
      [[ $REPLY == "$base" ]] || continue
      if [[ $k != "$key" || $TTHEME_PINS[$k] != "$pick" ]]; then
        __tt_pin_scope "$k"
        was+=("${TTHEME_PINS[$k]} · $REPLY")
      fi
      unset "TTHEME_PINS[$k]"
    done
    TTHEME_PINS[$key]=$pick
    top=$base
    [[ $base != / ]] && __tt_pin_cover "${base:h}" && __tt_pin_base "$REPLY" && top=$REPLY
    mark[$base]=new
    __tt_map_build "$top"
  fi
  __tt_map_fit $1
  (( ${#reply} > room )) && reply=("${(@)reply[1,room-1]}" "   …")
  reach=("${reply[@]}")
  [[ $key == /* || ${#was} -gt 0 ]] && reach+=("")
  __tt_pin_where "$key"
  base=$REPLY
  for k in $was; do
    __tt_clip "${d}Replaces ${k% · *} on $base · ${k##* · }$z" $1
    reach+=("$REPLY")
  done
  __tt_pin_scope "$key"
  __tt_clip "→ $base · $REPLY" $(( $1 - ${(m)#pick} - 2 ))
  rsub=$REPLY
  [[ $key == /* ]] || return 0
  __tt_here_fit "Then here" $1
  reach+=("${reply[@]}")
}

__tt_pv_draw() {
  local out line cnt ex ag="" acat="" ac="" sb="" dd="" zz="" state=on src="" nflt="" rsub="" REPLY
  local -i lw sw split sc se=$(( pw - 2 )) h k i N=${#rval} mt=${#TTHEME_ORDER} wiped=0
  local -a held
  bgstrip=""
  if [[ -n $flt ]]; then
    __tt_pv_norm "$flt"
    nflt=$REPLY
  fi
  if (( te )) && [[ -n $tespec && $tespec != "$applied" ]]; then
    __tt_pv_paint "$tespec"
    applied=$tespec
  fi
  __tt_pv_lw
  lw=$reply[1] sw=$reply[2]
  split=$(( sw > 0 )) sc=$(( pw - 1 - sw ))
  h=$(( ph - 5 ))
  (( conf && ! split )) && h=$(( ph - 6 - ${#cvars} ))
  reach=()
  if [[ -n $pick && $mode == pin ]]; then
    if (( split )); then
      __tt_pv_reach $sw $(( ph - 6 ))
    else
      __tt_pv_reach $se $(( ph - 13 ))
      h=$(( ph - 6 - ${#reach} ))
    fi
  fi
  (( h < 1 )) && h=1
  (( cur < top )) && top=$cur
  (( cur >= top + h )) && top=$(( cur - h + 1 ))
  (( top < 1 )) && top=1
  (( N > h && top > N - h + 1 )) && top=$(( N - h + 1 ))
  if (( color )); then
    dd=$'\e[2m' zz=$'\e[0m'
    if [[ -n $applied ]]; then
      local -a ap=(${=applied})
      local acx=${ap[3]#\#} sbx=${ap[4]#\#}
      printf -v ac '\e[38;2;%d;%d;%dm' $((16#${acx:0:2})) $((16#${acx:2:2})) $((16#${acx:4:2}))
      printf -v sb '\e[48;2;%d;%d;%dm' $((16#${sbx:0:2})) $((16#${sbx:2:2})) $((16#${sbx:4:2}))
    fi
    if [[ ${rtype[cur]} == thm ]]; then
      ag=${TTHEME_GROUP[${rval[cur]}]:-Other}
      [[ -n ${TTHEME_CATALOG[${rval[cur]}]} ]] && acat=$ag/${TTHEME_CATALOG[${rval[cur]}]}
    fi
  fi
  if [[ -n $flt ]]; then
    local -a mm=(${(M)rtype:#thm})
    mt=${#mm}
  fi
  cnt="$mt/${#TTHEME_ORDER}"
  out=$'\e[H'
  if (( resized )); then
    out+=$'\e[K\e[2H\e[J\e[H'
    (( bgcw )) && { __tt_bg_wipe; out+=$REPLY }
    resized=0 wiped=1
  fi
  [[ $1 == hint ]] && (( ! wiped )) || pvz=()
  if (( pw < 40 || ph < 12 )); then
    line="ttheme preview"
    (( color )) && line=$'\e[1m'$ac$line$'\e[0m'
    out+=$line$'\e[K\n'"Needs 40×12 — now ${pw}×${ph}"$'\e[K\n'
    line="esc quits"
    (( color )) && line=$'\e[2m'$line$'\e[0m'
    out+=$line$'\e[K\e[J'
    __tt_pv_flush
    return 0
  fi
  if (( te && ! split )); then
    __tt_pv_te_draw
    return 0
  fi
  if [[ -n $flt ]]; then
    if (( color )); then
      line="   "$'\e[1m'$flt$zz$ac$'\e[7m \e[0m'
    else
      line="   ${flt}_"
    fi
  else
    ex="$expal | $exgrp"
    (( ${#ex} > lw - 19 - ${#cnt} )) && ex="${ex[1,lw-20-${#cnt}]}…"
    if (( gstep > 0 )); then
      local gkeep=$(( ${#ex} * (8 - gstep) / 8 ))
      if [[ $TTHEME_FX == (decode|glitch) ]]; then
        local gpool='▓▒░#*+=<>?/-_' gstill=' ' gout="" gi
        [[ $TTHEME_FX == decode ]] && gpool='abcdefghijklmnopqrstuvwxyz' gstill='[^[:alnum:]]'
        for (( gi = 1; gi <= ${#ex}; gi++ )); do
          if (( gi + (gi * 7 + gseed) % 3 <= gkeep )) || [[ ${ex[gi]} == $~gstill ]]; then
            gout+=${ex[gi]}
          else
            gout+=${gpool[RANDOM % ${#gpool} + 1]}
          fi
        done
        ex=$gout
      else
        ex="${ex[1,gkeep]}▏"
      fi
    fi
    line="   "$dd"Search… e.g. $ex"$zz
  fi
  local tail=$'\e['$(( lw - ${#cnt} ))'G'$dd$cnt$zz
  [[ -n $flt ]] && tail=$'\e['$(( lw - ${#cnt} ))'G'$cnt
  if [[ $1 == hint ]] && (( ! wiped )); then
    print -rn -- $'\e['$(( 1 + hub ))$'H\e[0m\e['$lw'X'$line$tail
    printf '\e[%d;%dH\e[?2026l' $(( 1 + hub )) $(( 4 + ${(m)#flt} ))
    return 0
  fi
  if (( hub )); then
    __tt_pv_bar $(( split ? sc - 2 : pw - 1 ))
    out+=$REPLY$'\e[K\n'$line$'\e[K'$tail$'\n'
  else
    out+=$line$'\e[K'$tail$'\n\e[K\n'
  fi
  if (( N > h && top > 1 )); then
    out+="   "$dd"…"$zz
    pvz+=("3 1 $lw more -1")
  fi
  out+=$'\e[K\n'
  for (( k = 0; k < ph - 4; k++ )); do
    i=$(( top + k ))
    line=""
    if (( k < h )); then
      if (( ! N )); then
        (( k == 0 )) && line="   ${dd}No palettes match '$flt'$zz"
      elif (( i <= N )); then
        __tt_pv_row $i
        line=$REPLY
        pvz+=("$(( 4 + k )) 1 $lw row $i")
        case ${rtype[i]} in
          hdr) pvz+=("$(( 4 + k )) 3 5 fold $i") ;;
          cat) pvz+=("$(( 4 + k )) 5 7 fold $i") ;;
        esac
      fi
    elif (( k == h && N > h && top + h <= N )); then
      line="   "$dd"…"$zz
      pvz+=("$(( 4 + k )) 1 $lw more 1")
    fi
    out+=$line$'\e[K\n'
  done
  __tt_pv_foot $(( split ? se : pw ))
  if (( split )); then
    if (( help && sw >= 48 )); then
      __tt_pv_head 1 $sc $se Help
      __tt_pv_help
    elif (( ${#reach} )); then
      __tt_pv_head 1 $sc $se "$pick" "$rsub"
      for (( k = 1; k <= ${#reach} && k + 2 < ph; k++ )); do
        out+=$'\e['$(( k + 2 ))';'$sc'H'${reach[k]}
      done
    elif (( conf )); then
      __tt_tilde "$TTHEME_CONFIG"
      src=$REPLY
      (( 8 + ${#src} > sw )) && src=""
      __tt_pv_head 1 $sc $se Config "" "$src"
      __tt_pv_conf_panel 4 $sc $se
    elif (( te )); then
      __tt_pv_te_head $sc $se
      __tt_pv_te_panel $sc $se 3 $(( ph - 1 ))
    else
      [[ -n $an ]] && src=${TTHEME_SRC[$an]}
      (( ${#an} + 2 + ${#src} > sw )) && src=""
      __tt_pv_head 1 $sc $se ${an:-custom} "" "$src"
      __tt_pv_specimen
    fi
    (( help && sw < 48 )) && __tt_pv_help
  else
    if (( ${#reach} )); then
      __tt_pv_head $(( ph - 1 - ${#reach} )) 1 $se "$pick" "$rsub"
      for (( k = 1; k <= ${#reach}; k++ )); do
        out+=$'\e['$(( ph - 1 - ${#reach} + k ))';1H'${reach[k]}
      done
    elif (( conf )); then
      __tt_pv_head $(( ph - 2 - ${#cvars} )) 1 $lw Config
      __tt_pv_conf_panel $(( ph - 1 - ${#cvars} )) 1 $lw
    fi
    (( help )) && __tt_pv_help
  fi
  (( osdt > 0 )) && __tt_pv_osd
  __tt_pv_flush
}

__tt_pv_group() {
  local k g
  groups=() gthemes=()
  __tt_order
  for k in $reply; do
    g=${TTHEME_GROUP[$k]:-Other}
    [[ -n ${gthemes[$g]} ]] || groups+=($g)
    gthemes[$g]+=" $k"
  done
}

__tt_pv_canpick() {
  canpick=0
  if [[ $mode == pin ]]; then
    canpick=1
  elif __tt_keepable && [[ $TTHEME_TAB_PALETTE == off ]]; then
    canpick=1
  fi
}

__tt_pv_strip() {
  local hex cell=""
  local -a sw=(${=TTHEME_SWATCH[$1]})
  local -i j
  for (( j = 1; j <= 6; j++ )); do
    hex=${sw[j]#\#}
    (( j > 1 )) && cell+=" "
    if [[ -n $hex ]]; then
      cell+=$'\e[38;2;'$((16#${hex:0:2}))';'$((16#${hex:2:2}))';'$((16#${hex:4:2}))'m■'
    else
      cell+=" "
    fi
  done
  tstrip[$1]=$cell$'\e[39m'
}

__tt_pv_init() {
  local lo
  local -a tp
  __tt_pv_group
  [[ -n $orig ]] && __tt_name_of "$orig" && cn=$REPLY
  [[ -n ${TTHEME_PALETTE[$cn]} ]] || return 0
  cdot="◆"
  (( color )) || return 0
  tp=(${=TTHEME_PALETTE[$cn]})
  lo=${tp[3]#\#}
  printf -v cdot '\e[38;2;%d;%d;%dm◆\e[39m' $((16#${lo:0:2})) $((16#${lo:2:2})) $((16#${lo:4:2}))
}

__tt_pv_roll() {
  expal=${TTHEME_ORDER[RANDOM % ${#TTHEME_ORDER} + 1]}
  exgrp=${groups[RANDOM % ${#groups} + 1]}
  gseed=$RANDOM
  exnext=$(( SECONDS + 3 ))
}

__tt_pv_size() {
  local sz=$(stty size 2>/dev/null)
  [[ $sz == <1->" "<1-> ]] || return 1
  [[ $sz == "$ph $pw" ]] && return 1
  ph=${sz%% *} pw=${sz##* } resized=1
  return 0
}

__tt_pv_getch() {
  if (( $# )); then
    read -sk 1 -t $1 2>/dev/null
    return
  fi
  local -F t=0.2 at
  local -i quick=0
  (( gstep )) && t=0.06
  while :; do
    at=$EPOCHREALTIME
    read -sk 1 -t $t 2>/dev/null && return 0
    if (( EPOCHREALTIME - at < t / 4 )); then
      (( ++quick >= 5 )) && { pvgone=1; return 1 }
    else
      quick=0
    fi
    [[ -t 0 ]] || return 1
    __tt_pv_size && return 1
    if (( osdt > 0 )); then
      (( osdt -= gstep ? 6 : 20 ))
      (( osdt > 0 )) || return 1
    fi
    if (( msgt > 0 )); then
      (( msgt -= gstep ? 6 : 20 ))
      (( msgt > 0 )) || return 1
    fi
    (( gstep )) && { gstep=$(( gstep - 1 )); tick=1; return 1 }
    (( ! te && SECONDS >= exnext )) && { __tt_pv_roll; gstep=8; tick=1; return 1 }
  done
}

__tt_pv_read() {
  key=""
  if (( $# )); then
    __tt_pv_getch 0 || return 1
  else
    __tt_pv_getch || return 1
  fi
  key=$REPLY
  [[ $key == ç ]] && key=altc
  [[ $key == $'\e' ]] || return 0
  local seq=""
  if ! __tt_pv_getch 0.05; then
    key=esc
    return 0
  fi
  if [[ $REPLY != '[' && $REPLY != O ]]; then
    key=nop
    [[ $REPLY == c ]] && key=altc
    return 0
  fi
  while __tt_pv_getch 0.05; do
    seq+=$REPLY
    [[ $REPLY == [A-Za-z~] ]] && break
  done
  case $seq in
    A) key=up ;;
    B) key=down ;;
    C) key=right ;;
    D) key=left ;;
    H|"1~"|"7~") key=home ;;
    F|"4~"|"8~") key=end ;;
    "5~") key=pgup ;;
    "6~") key=pgdn ;;
    "1;2C") key=sright ;;
    "1;2D") key=sleft ;;
    "27;2;13~"|"13;2u") key=senter ;;
    Z) key=stab ;;
    '<'<->';'<->';'<->[Mm]) __tt_pv_sgr $seq ;;
    M) __tt_pv_x10 ;;
    *) key=nop ;;
  esac
}

__tt_pv_sgr() {
  local -a p=(${(s:;:)${${1#<}%[Mm]}})
  local -i b=$p[1]
  key=mouse mrow=$p[3] mcol=$p[2] mwheel=0
  if (( b & 128 || mrow < 1 || mcol < 1 )); then
    key=nop
  elif (( b & 64 )); then
    mact=wheel mwheel=$(( b & 1 ? 1 : -1 ))
    (( b & 2 || mwheel == mlwheel )) && key=nop
    mlwheel=$mwheel
  elif (( b & 32 )); then
    mact=drag
    (( b & 3 )) && key=nop
  elif [[ $1 == *m ]] || (( (b & 3) == 3 )); then
    mact=release
  elif (( b & 3 )); then
    key=nop
  else
    mact=press
    if (( mrow == mlrow && mcol - mlcol <= 1 && mlcol - mcol <= 1 && EPOCHREALTIME - mlast <= 0.5 )); then
      (( ++mclick ))
    else
      mclick=1
    fi
    mlast=$EPOCHREALTIME mlrow=$mrow mlcol=$mcol
  fi
  return 0
}

__tt_pv_x10() {
  local a b c
  key=nop
  __tt_pv_getch 0.05 && a=$REPLY || return 0
  __tt_pv_getch 0.05 && b=$REPLY || return 0
  __tt_pv_getch 0.05 && c=$REPLY || return 0
  (( #a < 128 && #b > 32 && #b < 128 && #c > 32 && #c < 128 )) || return 0
  __tt_pv_sgr "<$(( #a - 32 ));$(( #b - 32 ));$(( #c - 32 ))M"
}

__tt_pv_spot() {
  local z
  local -a f
  for z in "${(@Oa)pvz}"; do
    f=(${=z})
    (( f[1] == $1 && $2 >= f[2] && $2 <= f[3] )) || continue
    REPLY=$z
    return 0
  done
  REPLY=""
  return 1
}

__tt_pv_word() {
  case $1 in
    enter) REPLY=$'\r' ;;
    esc) REPLY=esc ;;
    tab) REPLY=$'\t' ;;
    bksp) REPLY=$'\x7f' ;;
    space) REPLY=' ' ;;
    ⇧enter) REPLY=senter ;;
    ←) REPLY=left ;;
    →) REPLY=right ;;
    '?'|'#'|[a-zA-Z]|'='|'+') REPLY=$1 ;;
    *) REPLY="" ;;
  esac
  [[ -n $REPLY ]]
}

__tt_pv_mouse() {
  local REPLY
  local -a z
  if [[ $mact == wheel ]]; then
    __tt_pv_wheel
    return
  fi
  if [[ $mact == press ]]; then
    if (( help )); then
      help=0 mzone=""
      return 0
    fi
    __tt_pv_spot $mrow $mcol
    mzone=$REPLY
  fi
  z=(${=mzone})
  (( ${#z} )) || return 0
  [[ $mact == release ]] && mzone=""
  if [[ $z[4] == tone ]]; then
    __tt_pv_te_mouse $z
    return
  fi
  case $mact in
    press) __tt_pv_press $z ;;
    drag) [[ $z[4] == track ]] && __tt_pv_bg_track $z[5] $(( mcol - z[2] )) $(( z[3] - z[2] )) ;;
    release) (( mrow == z[1] && mcol >= z[2] && mcol <= z[3] )) && __tt_pv_release $z ;;
  esac
}

__tt_pv_free() {
  (( ! conf && ! te && ! help )) && [[ -z $pick && -z $tune ]]
}

__tt_pv_press() {
  case $4 in
    row|fold) __tt_pv_free && [[ ${rtype[$5]} != rule ]] && cur=$5 ;;
    pick) pk=$5 ;;
    conf) cf=$5 ;;
    teimg) (( tfocus == 1 )) || __tt_te_to_image ;;
    tefield|track|place|colors)
      (( tfocus == 1 )) || __tt_te_to_image
      case $4 in
        place) tf=2 ;;
        colors) tf=4 ;;
        *) tf=$5 ;;
      esac
      [[ $4 == track ]] && __tt_pv_bg_track $5 $(( mcol - $2 )) $(( $3 - $2 ))
      ;;
  esac
  return 0
}

__tt_pv_release() {
  case $4 in
    key)
      __tt_pv_word $5 || return 0
      key=$REPLY
      __tt_pv_handle
      return
      ;;
    row|pick)
      (( mclick == 2 )) || return 0
      if [[ $4 == row ]]; then
        __tt_pv_free || return 0
      else
        [[ -n $pick ]] || return 0
      fi
      key=$'\r'
      __tt_pv_handle
      return
      ;;
    fold) __tt_pv_free && [[ ${rtype[cur]} == (hdr|cat) ]] && __tt_pv_toggle ;;
    more)
      __tt_pv_free || return 0
      key=pgdn
      (( $5 < 0 )) && key=pgup
      __tt_pv_handle
      return
      ;;
    hub)
      local -i at=${TTHEME_HUB_TABS[(Ie)preview]}
      __tt_pv_free && (( $5 != at )) || return 0
      __tt_pv_screen $(( $5 - at )) || return 1
      ;;
    confv)
      cf=$5
      local -a ch=(${=cchoice[$5]})
      __tt_pv_conf_put ${cvars[$5]} ${ch[$6]}
      ;;
    confs)
      cf=$5
      __tt_pv_conf_step $6
      ;;
    tefind) __tt_te_find ;;
    teapply) __tt_te_apply || return 1 ;;
    place) __tt_pv_bg_adjust at $5 ;;
    colors)
      __tt_bg_coloring $tpick
      [[ $5 == "$REPLY" ]] || __tt_pv_bg_recolor
      ;;
  esac
  return 0
}

__tt_pv_te_mouse() {
  local -i li=$(( $5 + mrow - $1 )) ci=$(( mcol - $2 ))
  if [[ $mact == press ]] && (( tfocus != 0 )); then
    tfocus=0
    __tt_te_ask "focus 1" || return 0
  fi
  (( li < 0 )) && li=0
  (( ci < 0 )) && ci=0
  __tt_te_ask "mouse $mact $li $ci $mclick" || { __tt_te_close; return 0 }
  __tt_te_act
}

__tt_pv_bg_track() {
  local -i x=$2 w=$3
  (( x < 0 )) && x=0
  (( x > w )) && x=$w
  (( w > 0 )) || return 0
  if (( $1 == 3 )); then
    __tt_pv_bg_adjust opto $(( (x * 100 + w / 2) / w ))
  else
    __tt_pv_bg_adjust sizeat $(( x * 1000 / w ))
  fi
}

__tt_pv_wheel() {
  local -i i
  if (( help )); then
    return 0
  elif (( conf )); then
    (( cf += mwheel ))
    (( cf < 1 )) && cf=1
    (( cf > ${#cvars} )) && cf=${#cvars}
  elif (( te )); then
    if (( tfocus == 0 )); then
      __tt_te_ask "mouse wheel 0 0 $mwheel"
    else
      key=down
      (( mwheel < 0 )) && key=up
      __tt_pv_te
      return
    fi
  elif [[ -z $pick && -z $tune ]] && (( ${#rval} )); then
    i=$(( cur + mwheel ))
    [[ ${rtype[i]} == rule ]] && (( i += mwheel ))
    (( i >= 1 && i <= ${#rval} )) && cur=$i
  fi
  return 0
}

__tt_pv_pick() {
  case $key in
    $'\x03') return 1 ;;
    esc) pick="" ;;
    left|stab) pk=$(( (pk + ${#plabel} - 2) % ${#plabel} + 1 )) ;;
    right|$'\t') pk=$(( pk % ${#plabel} + 1 )) ;;
    $'\r'|$'\n'|senter)
      sel=$pick picked=$pk
      return 1
      ;;
  esac
  return 0
}

__tt_pv_screen() {
  local err
  local -i at=${TTHEME_HUB_TABS[(Ie)preview]} n=${#TTHEME_HUB_TABS} rc
  local -i to=$(( (at - 1 + $1 + n) % n + 1 ))
  __tt_pv_bg_close
  __tt_pv_leave
  while (( to != at )); do
    hubwas="$TTHEME_STARTUP ${TTHEME_PALETTE[$TTHEME_STARTUP]}"
    err=$(TTHEME_HUB=${TTHEME_HUB_TABS[to]} __tt_cli ${TTHEME_HUB_TABS[to]} 2>&1 >/dev/tty)
    rc=$?
    if (( rc == TTHEME_HUB_CLOSED )); then
      hubleft=1
      return 1
    elif (( rc > TTHEME_HUB_SWITCH && rc <= TTHEME_HUB_SWITCH + n )); then
      to=$(( rc - TTHEME_HUB_SWITCH ))
    else
      err=${${err//$'\n'/ }## #}
      msg=${err:-"${TTHEME_HUB_TITLES[to]} failed"} msgt=300
      to=$at
    fi
  done
  printf '\e[?2026h\e[?25l%s' "$pvmouse"
  if [[ -n $applied ]]; then
    __tt_pv_paint "$applied"
  else
    __tt_osc_reset
    painted=""
  fi
  resized=1 bgname="" bgshown="" bgdim=()
  return 0
}

__tt_te_stop() {
  setopt localoptions nomonitor nonotify
  (( TE_IN )) && { print -r -u $TE_IN -- quit 2>/dev/null; exec {TE_IN}>&- }
  (( TE_OUT )) && exec {TE_OUT}<&-
  TE_IN=0 TE_OUT=0
  (( TE_PID )) && { kill $TE_PID 2>/dev/null; wait $TE_PID 2>/dev/null }
  TE_PID=0
  return 0
}

__tt_te_ask() {
  local line
  (( TE_IN && TE_OUT )) || return 1
  print -r -u $TE_IN -- "$1" 2>/dev/null || { __tt_te_stop; return 1 }
  if ! IFS= read -r -u $TE_OUT -t 5 line 2>/dev/null; then
    __tt_te_stop
    msg="The palette panel stopped" msgt=300
    return 1
  fi
  teframe=("${(@ps:\x1f:)line}")
  temode=${teframe[3]:-list}
  tedirty=${teframe[4]:-0}
  [[ ${teframe[1]} == error ]] && { msg=${teframe[8]:-"Could not save the tone"} msgt=300 }
  [[ -n ${teframe[5]} ]] && tespec=${teframe[5]}
  return 0
}

__tt_te_unsaved_image() {
  local img
  for img in ${(k)tsnaps}; do
    [[ "${bgsize[$img]} ${bgpos[$img]} ${bgop[$img]} ${bgoff[$img]}" == "${tsnaps[$img]}" ]] || return 0
  done
  [[ -n $tune && $tpick != "${bgview[$tune]:-$tune}" ]] && return 0
  return 1
}

__tt_te_unsaved() {
  (( tedirty )) && return 0
  __tt_te_unsaved_image
}

__tt_te_save_image() {
  __tt_te_unsaved_image || return 0
  __tt_pv_tune_keep
  __tt_pv_bg_save > /dev/null 2>&1
  bgedit=() bgswap=() bgview=()
  __tt_pv_bg_reset $tename
  bgload[$tename]=""
  __tt_pv_tune_open $tename
}

__tt_te_open() {
  local name=$1
  local -i rfd wfd
  setopt localoptions nomonitor nonotify
  coproc __tt_cli tone $name 2>/dev/null
  exec {rfd}<&p {wfd}>&p
  TE_OUT=$rfd TE_IN=$wfd TE_PID=$!
  tename=$name tfocus=0 tespec="" tesz="" teframe=() tedirty=0 temode=list tetop=0 msgt=0 teshown="" telook=""
  if ! __tt_te_ask "focus 1"; then
    msg="Could not start the palette panel for $name" msgt=300
    __tt_te_stop
    return 0
  fi
  te=1
  (( bgcw )) && __tt_pv_bg_state $name && __tt_pv_tune_open $name
  __tt_te_image && __tt_te_to_image 1
  resized=1
  return 0
}

__tt_te_close() {
  [[ -n $tune ]] && __tt_pv_untune
  __tt_te_stop
  te=0 tfocus=0 tename="" tespec="" tesz="" teframe=() tetop=0 help=0 pick="" teshown="" telook=""
  resized=1 bgname=""
  return 0
}

__tt_te_save() {
  __tt_te_save_image
  if (( tedirty )); then
    __tt_te_ask save || return 1
    if [[ ${teframe[1]} == saved ]]; then
      __tt_palettes_load && __tt_reloaded
      __tt_reload
      applied=${TTHEME_PALETTE[$tename]:-$applied}
      tespec=$applied
    else
      return 1
    fi
  fi
  msg="Saved" msgt=200
  return 0
}

__tt_te_apply() {
  if __tt_te_unsaved; then
    __tt_te_save || return 0
  fi
  if (( canpick )); then
    pick=$tename pk=$pkdef
    return 0
  fi
  sel=$tename
  return 1
}

__tt_te_image() {
  [[ -n $tune ]] || __tt_pv_bg_findable $tename
}

__tt_te_to_image() {
  tfocus=1 tf=5
  [[ $1 == last && -n $tune ]] && tf=3
  __tt_te_ask "focus 0"
}

__tt_te_to_palette() {
  tfocus=0
  __tt_te_ask "focus 1" && __tt_te_ask "key $1"
}

__tt_te_to_apply() {
  tfocus=2
  __tt_te_ask "focus 0"
}

__tt_te_to_top() {
  if __tt_te_image; then
    __tt_te_to_image first
  else
    __tt_te_to_palette home
  fi
}

__tt_te_find() {
  local name=$tename
  __tt_pv_bg_findable $name || return 0
  __tt_te_save_image
  __tt_pv_untune
  __tt_pv_bg_find $name
  __tt_pv_bg_state $name && __tt_pv_tune_open $name
  tf=5
  return 0
}

__tt_te_key() {
  local m
  if [[ $temode == list ]]; then
    case $key in
      home) __tt_te_to_top; return 0 ;;
      end) __tt_te_to_apply; return 0 ;;
    esac
  fi
  case $key in
    up|down|left|right|home|end|pgup|pgdn|esc) m="key $key" ;;
    sleft) m="key shift-left" ;;
    sright) m="key shift-right" ;;
    stab) m="key shift-tab" ;;
    $'\t') m="key tab" ;;
    $'\r'|$'\n') m="key enter" ;;
    $'\x7f'|$'\x08') m="key backspace" ;;
    $'\x03') m="key ctrl-c" ;;
    nop|altc) return 0 ;;
    *)
      (( ${#key} == 1 )) || return 0
      m="ch $(( #key ))"
      ;;
  esac
  __tt_te_ask "$m" || { __tt_te_close; return 0 }
  __tt_te_act
}

__tt_te_act() {
  case ${teframe[2]} in
    save) __tt_te_save ;;
    cancel) __tt_te_close ;;
    below) __tt_te_to_apply ;;
    above)
      if __tt_te_image; then
        __tt_te_to_image last
      else
        __tt_te_to_apply
      fi
      ;;
  esac
  return 0
}

__tt_pv_te_image() {
  local -a order=(5)
  local -i i
  [[ -n $tune ]] && order=(5 4 1 2 3)
  i=${order[(Ie)$tf]}
  (( i )) || { tf=5; i=1 }
  case $key in
    s) __tt_te_save ;;
    esc) __tt_te_close ;;
    up|k)
      if (( i > 1 )); then
        tf=${order[i-1]}
      else
        __tt_te_to_apply
      fi
      ;;
    down|j)
      if (( i < ${#order} )); then
        tf=${order[i+1]}
      else
        __tt_te_to_palette home
      fi
      ;;
    home) tf=5 ;;
    end) __tt_te_to_apply ;;
    $'\r'|$'\n') [[ -n $tune ]] || __tt_te_find ;;
    f) __tt_te_find ;;
    left|right|sleft|sright)
      if (( tf == 5 )); then
        if [[ -z $tune ]]; then
          :
        elif [[ $key == *left ]]; then
          __tt_pv_bg_pick -1
        else
          __tt_pv_bg_pick 1
        fi
      elif [[ -n $tune ]]; then
        __tt_pv_tune
      fi
      ;;
    '=') [[ -n $tune ]] && (( tf != 5 )) && __tt_pv_tune ;;
    *) [[ -n $tune ]] && __tt_pv_tune ;;
  esac
  [[ -n $tune ]] || tf=5
  return 0
}

__tt_te_button() {
  case $key in
    $'\r'|$'\n') __tt_te_apply; return $? ;;
    s) __tt_te_save ;;
    esc) __tt_te_close ;;
    up|k) __tt_te_to_palette end ;;
    down|j|home) __tt_te_to_top ;;
  esac
  return 0
}

__tt_pv_te() {
  case $key in
    $'\x03') return 1 ;;
    $'\x05') return 0 ;;
    senter) __tt_te_apply; return $? ;;
    '?') help=1; return 0 ;;
  esac
  case $tfocus in
    0) __tt_te_key ;;
    1) __tt_pv_te_image ;;
    *) __tt_te_button ;;
  esac
  return $?
}

__tt_pv_te_head() {
  local z=$'\e[0m' d=$'\e[2m' b=$'\e[1m' y=$'\e[33m' line REPLY
  local -i col=$1 end=$2 room=$(( $2 - $1 + 1 ))
  (( color )) || z= d= b= y=
  __tt_te_unsaved && (( room -= 11 ))
  line=$b$ac"◆"$z" "$b$tename$z
  [[ -n ${TTHEME_GROUP[$tename]} ]] && line+=" "$d"· ${TTHEME_GROUP[$tename]}"$z
  __tt_clip "$line" $room
  out+=$'\e[1;'$col'H'$REPLY$z
  __tt_te_unsaved && out+=$'\e[1;'$(( end - 8 ))'H'$y"●"$z" "$d"unsaved"$z
  return 0
}

__tt_pv_te_tile() {
  local z=$'\e[0m' d=$'\e[2m' b=$'\e[1m' sty top side bot
  local -i y=$1 col=$2 r tc=10
  (( color )) || z= d= b=
  if (( tfocus == 1 && tf == 5 )); then
    sty=$b$ac top="┏${(l:tc::━:)}┓" side="┃" bot="┗${(l:tc::━:)}┛"
  else
    sty=$d top="╭${(l:tc::─:)}╮" side="│" bot="╰${(l:tc::─:)}╯"
  fi
  out+=$'\e['$y';'$col'H'$sty$top$z
  for (( r = 1; r <= 3; r++ )); do
    out+=$'\e['$(( y + r ))';'$col'H'$sty$side${(l:tc::░:)}$side$z
  done
  out+=$'\e['$(( y + 4 ))';'$col'H'$sty$bot$z$'\e['$(( y + 2 ))';'$(( col + tc + 4 ))'H'
  if (( tfocus == 1 && tf == 5 )); then
    out+=$b"enter"$z$d" finds one"$z
  else
    out+=$d"enter finds one"$z
  fi
  return 0
}

__tt_pv_te_ghost() {
  local z=$'\e[0m' d=$'\e[2m'
  local -i r0=$1 col=$2 T=$(( $3 - $2 - 21 )) i
  (( color )) || z= d=
  (( T < 8 )) && T=8
  out+=$'\e['$r0';'$col'H  '$d"Colors"$'\e['$r0';'$(( col + 12 ))'H'" tone   original "$z
  out+=$'\e['$(( r0 + 1 ))';'$col'H  '$d"Size"$'\e['$(( r0 + 1 ))';'$(( col + 12 ))'H'${(l:T::─:)}$z
  for (( i = 1; i <= 9; i++ )); do
    out+=$'\e['$(( r0 + 3 + (i - 1) / 3 ))';'$(( col + 12 + (i - 1) % 3 * 3 ))'H'$d"·"$z
  done
  out+=$'\e['$(( r0 + 4 ))';'$col'H  '$d"Position"$z
  out+=$'\e['$(( r0 + 7 ))';'$col'H  '$d"Opacity"$'\e['$(( r0 + 7 ))';'$(( col + 12 ))'H'${(l:T::─:)}$z
  return 0
}

__tt_pv_te_panel() {
  local z=$'\e[0m' d=$'\e[2m' b=$'\e[1m' tt st note REPLY
  local -a held
  local -i col=$1 end=$2 r0=$3 r1=$4 R W T I=3 V at i n y tfs=$tf
  (( color )) || z= d= b=
  R=$(( r1 - r0 + 1 )) W=$(( end - col + 1 ))
  [[ -n $tune ]] || __tt_pv_bg_findable $tename && I=17
  T=$(( R - I - 3 ))
  (( T > 26 )) && T=26
  (( T < 21 )) && T=15
  if [[ "$W $T" != "$tesz" ]]; then
    tesz="$W $T"
    __tt_te_ask "size $W $T"
  fi
  V=$(( I + T + 3 ))
  if (( V <= R || tfocus == 1 )); then
    tetop=0
  elif (( tfocus == 2 )); then
    tetop=$(( V - R ))
  else
    at=$(( I + 1 + ${teframe[9]:-2} ))
    (( at - 2 < tetop )) && tetop=$(( at > 2 ? at - 2 : 0 ))
    (( at > tetop + R )) && tetop=$(( at - R ))
    (( tetop > V - R )) && tetop=$(( V - R ))
  fi
  if (( tetop == 0 && I <= R )); then
    y=$r0
    tt=$d
    (( tfocus == 1 )) && tt=$b$ac
    out+=$'\e['$y';'$(( col + 2 ))'H'$tt"Image"$z
    pvz+=("$y $col $end teimg")
    if [[ -n $tune ]]; then
      (( bgoff[$tpick] )) && st=off || st=on
      [[ ${teframe[10]} == 1 ]] && ! __tt_bg_tints && st="recolors on save  $st"
      __tt_pv_bg_title $(( W - 12 - ${#st} ))
      out+="  "$d$REPLY$z$'\e['$y';'$(( end - ${#st} + 1 ))'H'$d$st$z
    fi
    if (( I == 17 )); then
      held=() n=0 note="0/0"
      if [[ -n $tune ]]; then
        held=(${=bgpics[$tune]})
        n=${held[(Ie)${${tpick#$tune}#:}]}
        (( n )) || n=${held[(Ie)${bgact[$tune]}]}
        (( n )) || n=1
        note="$n/$(( ${#held} ? ${#held} : 1 ))"
      fi
      st="  " tt=$d
      (( tfocus == 1 && tf == 5 )) && st=$ac"▶"$z" " tt=$b
      out+=$'\e['$(( y + 2 ))';'$col'H'$st$tt"Images"$z$'\e['$(( y + 2 ))';'$(( end - ${#note} + 1 ))'H'$d$note$z
      pvz+=("$(( y + 2 )) $col $end teimg")
      if [[ -n $tune ]]; then
        bgstrip="$(( y + 2 )) $col $end"
        (( tfocus == 1 )) || tf=0
        __tt_pv_bg_panel $tpick $(( y + 9 )) $col $end
        tf=$tfs
      else
        __tt_pv_te_tile $(( y + 3 )) $col
        for (( i = 3; i <= 7; i++ )); do
          pvz+=("$(( y + i )) $col $(( col + 30 )) tefind")
        done
        __tt_pv_te_ghost $(( y + 9 )) $col $end
      fi
    elif (( bgcw )); then
      out+=$'\e['$(( y + 2 ))';'$(( col + 2 ))'H'$d"No picture yet"$z
    else
      out+=$'\e['$(( y + 2 ))';'$(( col + 2 ))'H'$d"This terminal shows no pictures"$z
    fi
  fi
  for (( i = 1; i <= T; i++ )); do
    y=$(( r0 + I + i - tetop ))
    (( y >= r0 && y <= r1 )) || continue
    out+=$'\e['$y';'$col'H'${teframe[11 + i]}$z
    pvz+=("$y $col $end tone $(( i - 1 ))")
  done
  y=$(( r0 + V - 1 - tetop ))
  (( y >= r0 && y <= r1 )) || return 0
  pvz+=("$y $col $end teapply")
  if [[ $mode == pin ]]; then
    note="saves, then asks how far it reaches"
  elif (( canpick )); then
    note="saves, then asks where"
  else
    note="saves and wears it in this tab"
  fi
  out+=$'\e['$y';'$col'H'
  if (( tfocus == 2 )); then
    (( color )) && out+=$ac"▶"$z" "$'\e[7;1m'$ac" Apply "$z || out+="▶ [Apply]"
  else
    (( color )) && out+="  "$b" Apply "$z || out+="   Apply "
  fi
  out+="  "$d$note$z
  return 0
}

__tt_pv_te_draw() {
  local -i i end=$(( pw - 2 < 66 ? pw - 2 : 66 ))
  for (( i = 1; i < ph; i++ )); do
    out+=$'\e['$i$';1H\e[K'
  done
  __tt_pv_te_head 2 $end
  __tt_pv_te_panel 2 $end 3 $(( ph - 1 ))
  reach=()
  if [[ -n $pick && $mode == pin ]]; then
    __tt_pv_reach $se $(( ph - 13 ))
    if (( ${#reach} )); then
      __tt_pv_head $(( ph - 1 - ${#reach} )) 1 $se "$pick" "$rsub"
      for (( i = 1; i <= ${#reach}; i++ )); do
        out+=$'\e['$(( ph - 1 - ${#reach} + i ))$';1H\e[K'${reach[i]}
      done
    fi
  fi
  (( help )) && __tt_pv_help
  out+=$'\e['$ph';1H'
  __tt_pv_foot $pw
  (( osdt > 0 )) && __tt_pv_osd
  __tt_pv_flush
}

__tt_pv_handle() {
  local name
  if [[ $key == mouse ]]; then
    __tt_pv_mouse
    return
  fi
  if (( help )); then
    case $key in
      $'\x03') return 1 ;;
      '?'|esc) help=0 ;;
    esac
    return 0
  fi
  if [[ -n $pick ]]; then
    __tt_pv_pick
    return
  fi
  if (( te )); then
    __tt_pv_te
    return
  fi
  if [[ -n $tune ]]; then
    __tt_pv_tune
    return
  fi
  if (( conf )); then
    __tt_pv_conf
    return
  fi
  case $key in
    $'\x03') return 1 ;;
    esc|$'\x15')
      if [[ -z $flt ]]; then
        [[ $key == esc ]] && return 1
      else
        name=""
        [[ ${rtype[cur]} == thm ]] && name=${rval[cur]}
        flt=""
        if [[ -n $name ]]; then
          __tt_pv_goto "$name"
        else
          __tt_pv_rows
          (( cur > ${#rval} )) && cur=${#rval}
          (( cur < 1 )) && cur=1
        fi
      fi
      ;;
    $'\r'|$'\n'|senter)
      if [[ ${rtype[cur]} == thm ]]; then
        if (( canpick )); then
          pick=${rval[cur]} pk=$pkdef
        else
          sel=${rval[cur]}
          return 1
        fi
      elif [[ ${rtype[cur]} == (hdr|cat) ]]; then
        __tt_pv_toggle
      fi
      ;;
    up)
      if (( cur > 1 )); then
        cur=$(( cur - 1 ))
        [[ ${rtype[cur]} == rule ]] && cur=$(( cur - 1 ))
      elif (( ${#rval} )); then
        cur=${#rval}
      fi
      ;;
    down)
      if (( cur < ${#rval} )); then
        cur=$(( cur + 1 ))
        [[ ${rtype[cur]} == rule ]] && cur=$(( cur + 1 ))
      elif (( ${#rval} )); then
        cur=1
      fi
      ;;
    right)
      if [[ ${rtype[cur]} == thm ]]; then
        __tt_te_open ${rval[cur]}
      elif [[ ${rtype[cur]} == (hdr|cat) && -z ${exp[${rval[cur]}]} ]]; then
        __tt_pv_toggle
      fi
      ;;
    $'\x05') [[ ${rtype[cur]} == thm ]] && __tt_te_open ${rval[cur]} ;;
    left) __tt_pv_left ;;
    home) cur=1 ;;
    end) (( ${#rval} )) && cur=${#rval} ;;
    pgup)
      if (( cur <= 1 )); then
        (( ${#rval} )) && cur=${#rval}
      else
        cur=$(( cur - ph + 5 ))
        (( cur < 1 )) && cur=1
        [[ ${rtype[cur]} == rule ]] && cur=$(( cur - 1 ))
      fi
      ;;
    pgdn)
      if (( cur >= ${#rval} )); then
        cur=1
      else
        cur=$(( cur + ph - 5 ))
        (( cur > ${#rval} )) && cur=${#rval}
        [[ ${rtype[cur]} == rule ]] && cur=$(( cur + 1 ))
      fi
      ;;
    ' ') [[ ${rtype[cur]} == (hdr|cat) ]] && __tt_pv_toggle ;;
    $'\t')
      if [[ ${rtype[cur]} == thm ]]; then
        __tt_te_open ${rval[cur]}
      elif (( hub )); then
        __tt_pv_screen 1 || return 1
      fi
      ;;
    stab) (( hub )) && { __tt_pv_screen -1 || return 1 } ;;
    altc)
      conf=1 cf=1 csnap=()
      for name in $cvars; do
        csnap+=("${(P)name}")
      done
      ;;
    '?') help=1 ;;
    sleft) (( --scene )) ;;
    sright) (( ++scene )) ;;
    $'\x7f'|$'\x08')
      if [[ -n $flt ]]; then
        name=""
        [[ ${rtype[cur]} == thm ]] && name=${rval[cur]}
        flt=${flt%?}
        __tt_pv_rows
        __tt_pv_first "$name"
      fi
      ;;
    [[:print:]])
      __tt_pv_lw
      (( ${(m)#flt} + ${(m)#key} > reply[1] - 12 )) && return 0
      name=""
      [[ ${rtype[cur]} == thm ]] && name=${rval[cur]}
      flt+=${(L)key}
      __tt_pv_rows
      __tt_pv_first "$name"
      ;;
  esac
  return 0
}

__tt_preview() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  zmodload -F zsh/datetime p:EPOCHREALTIME 2>/dev/null
  local mode=$1 pdir=${2:-$PWD} hubwas=""
  local -i hub=0 hubleft=0
  [[ $mode == hub ]] && hub=1
  if [[ ! -t 0 || ! -t 1 ]]; then
    print -u2 "ttheme ${mode:-preview}: needs a terminal"
    return 1
  fi
  local orig=$TTHEME_SPEC applied=$TTHEME_SPEC painted=$TTHEME_SPEC flt="" sel="" cn="" cdot="" key="" REPLY="" cur=1 top=1 color=0 pw=80 ph=24 resized=1 expal="" exgrp="" exnext=0 gstep=0 gseed=0 tick=0
  local pick="" pk=1 pkdef=1 picked=0 canpick=0 bgcw=0 bgch=0 bgname="" bgshown="" bginc="" osd="" osdt=0
  local tune="" tpick="" tf=1 help=0 msg="" msgt=0 an="" bgrel=0 bgmx=0 bgmy=0 bganchor=0 bgcut="" bgnext=0 bgbytes=0 bgstrip="" pvscene="" pvscenes=""
  local -i scene=0
  local -a bgorder=()
  local -A bgfrom=() bgurl=() bgby=() bgsent=() bgcost=() bgdim=() bgsrc=() bgfill=() bgfocus=() bgsize=() bgpos=() bgop=() bgdef=() bgoff=() bgbase=() bgload=() bgshot=() bgshotkey=() bgedit=() bgtunef=() bgofff=() bgimages=()
  local -A bgpic=() bgpics=() bgact=() bgview=() bgswap=() bgthumb=() tsnaps=() pvseek=() bgcolors=() bgprep=() TTHEME_ALIASES=()
  local conf=0 cf=1
  local -a plabel=(" Default " " This tab ") pkeys=() reach=() csnap=() teframe=()
  local te=0 tfocus=0 tetop=0 tename="" tedirty=0 temode=list tespec="" tesz="" teshown="" telook=""
  local -i TE_IN=0 TE_OUT=0 TE_PID=0 pvgone=0 bgprepid=0 mrow=0 mcol=0 mclick=0 mwheel=0 mlwheel=0 mlrow=0 mlcol=0
  local -F mlast=0
  local mact="" mzone="" pvmouse=""
  local -a pvz=()
  local -a cvars=(TTHEME_TAB_PALETTE TTHEME_ANNOUNCE TTHEME_FX TTHEME_SORT TTHEME_MOUSE TTHEME_BG_BLUR TTHEME_BG_COLORS) clabel=("New tabs" Announce "Search fx" Sort Mouse Blur Colors)
  local -a cchoice=("off seq" "1 0" "typewriter decode glitch" "abc series" "on off" "0 1 2 3 4" "tone original") cshow=("off seq" "on off" "typewriter decode glitch" "abc series" "on off" "off 1px 2px 3px 4px" "tone original")
  local -A cnote=(
    TTHEME_TAB_PALETTE:seq "New tabs rotate through palettes" TTHEME_TAB_PALETTE:off "New tabs keep the terminal theme"
    TTHEME_ANNOUNCE:1 "Shows the palette notice" TTHEME_ANNOUNCE:0 "Silences the palette notice"
    TTHEME_FX:typewriter "The search hint types itself" TTHEME_FX:decode "The search hint decodes" TTHEME_FX:glitch "The search hint glitches in"
    TTHEME_SORT:abc "Series and palettes by name" TTHEME_SORT:series "Series in the order added"
    TTHEME_MOUSE:on "Clicks, the wheel and drags work in ttheme's screens" TTHEME_MOUSE:off "The terminal keeps the mouse, so a drag selects text"
    TTHEME_BG_BLUR:0 "Pictures stay sharp" TTHEME_BG_BLUR:1 "Pictures soften a little behind the text"
    TTHEME_BG_BLUR:2 "Pictures soften behind the text" TTHEME_BG_BLUR:3 "Pictures blur behind the text"
    TTHEME_BG_BLUR:4 "Pictures blur well behind the text"
    TTHEME_BG_COLORS:tone "New pictures are tinted in one color of the palette"
    TTHEME_BG_COLORS:original "New pictures keep their own colors"
  )
  [[ -r $TTHEME_HOME/aliases.zsh ]] && source $TTHEME_HOME/aliases.zsh
  [[ $mode == pin ]] && __tt_pin_scopes "$pdir"
  __tt_pv_canpick
  __tt_pv_size
  local -a groups=() rtype=() rval=() rcnt=() reply=()
  local -A gthemes=() exp=() tstrip=()
  __tt_color && color=1
  __tt_pv_init
  __tt_pv_roll
  __tt_pv_rows
  [[ -n ${TTHEME_PALETTE[$cn]} ]] && __tt_pv_goto "$cn"
  local tty=""
  local -i TTHEME_RAW=0
  {
    tty=$(stty -g 2>/dev/null) && stty -echo -icanon min 1 time 0 2>/dev/null || tty=""
    TTHEME_RAW=$(( ${#tty} > 0 ))
    __tt_pv_bg_open
    printf '\e[?2026h\e[?1049h\e[?7l\e[?25l'
    __tt_pv_pointer
    while :; do
      printf '\e[?2026h'
      if (( tick && ! te )); then
        __tt_pv_draw hint
      else
        __tt_pv_focus
        [[ ${rtype[cur]} == thm ]] && an=${rval[cur]}
        __tt_pv_draw
      fi
      tick=0 mlwheel=0
      if ! __tt_pv_read; then
        (( pvgone )) && break
        [[ -t 0 ]] && continue
        break
      fi
      while :; do
        __tt_pv_handle || break 2
        __tt_pv_read drain || break
      done
    done
  } always {
    local spec=${sel:+${TTHEME_PALETTE[$sel]}}
    [[ -n $spec && $mode != pin ]] && (( ! ${#bgedit} && ! ${#bgswap} )) && __tt_pv_claim "$sel"
    printf '\e[?2026h'
    __tt_pv_bg_close
    if [[ -n $spec ]]; then
      [[ $spec == "$painted" ]] || __tt_apply "$spec"
    elif [[ $painted != "$orig" ]]; then
      if [[ -z $orig ]]; then
        __tt_osc_reset
      else
        __tt_apply "$orig"
      fi
    elif [[ $applied != "$orig" ]]; then
      __tt_pv_paint "${TTHEME_PAINTED:+$orig}"
    fi
    __tt_pv_pointer off
    printf '\e[?7h'
    (( hubleft )) || printf '\e[?1049l'
    printf '\e[?25h\e[?2026l'
    [[ -n $tty ]] && stty "$tty" 2>/dev/null
    TTHEME_RAW=0
    [[ -n $tune ]] && __tt_pv_untune
    (( TE_IN )) && __tt_te_stop
    (( conf )) && __tt_pv_unconf
    __tt_pv_bg_save
    if [[ -n $spec ]]; then
      TTHEME_SPEC=$spec
      if [[ $mode == pin ]]; then
        __tt_pin_save "$sel" "${pkeys[picked]}" "$orig"
        [[ $TTHEME_SPEC == "$orig" ]] || __tt_announce
        __tt_sync
      elif (( picked == 1 )); then
        __tt_announce
        __tt_keep "$sel" force
      else
        __tt_announce
        __tt_shown "$sel" force && __tt_reload
      fi
    else
      (( ${#bgedit} + ${#bgswap} )) && [[ -n ${TTHEME_PALETTE[$cn]} ]] && { __tt_shown "$cn" && __tt_reload }
    fi
    (( hubleft )) && __tt_catalog_done "$hubwas"
  }
  return 0
}
