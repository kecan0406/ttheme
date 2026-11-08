__tt_pv_norm() { REPLY=${(L)1//[^[:alnum:]]/} }

__tt_pv_seek() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  local t s w part key REPLY
  for t in ${(k)TTHEME_PALETTE}; do
    key="" s=${TTHEME_SUBJECT[$t]}
    w=${s%%/*}
    for part in "$t" "${t##*/}" "${t%%/*}" "${TTHEME_WORK_NAME[$w]}" "${TTHEME_WORK_NATIVE[$w]}" "${${(M)s:#*/*}#*/}" "${(@s:|:)TTHEME_NATIVE_NAMES[$t]}" "${TTHEME_CHARACTER[$t]}"; do
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
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  rtype=() rval=() rcnt=() rtop=()
  local g t w ruled="" nflt="" REPLY
  local -a ts inside
  if [[ -n $flt ]]; then
    (( ${#pvseek} )) || __tt_pv_seek
    __tt_pv_norm "$flt"
    nflt=$REPLY
  fi
  for g in $tops; do
    ts=()
    for t in ${=tmembers[$g]}; do
      [[ -z $flt || ${pvseek[$t]} == *$nflt* ]] && ts+=($t)
    done
    [[ -n $flt ]] && (( ! ${#ts} )) && continue
    if [[ -z $ruled && $TTHEME_GROUP != marketplace ]] && (( ! ${+TTHEME_WORK_NAME[$g]} )); then
      ruled=1
      (( ${#rtype} )) && { rtype+=(rule); rval+=(''); rcnt+=(0); rtop+=('') }
    fi
    rtype+=(hdr); rval+=($g); rcnt+=(${#ts}); rtop+=($g)
    [[ -n $flt || -n ${exp[$g]} ]] || continue
    if [[ $TTHEME_GROUP == marketplace ]]; then
      for w in $TTHEME_WORKS ''; do
        inside=()
        for t in ${=tmembers[$g/$w]}; do
          [[ -z $flt || ${pvseek[$t]} == *$nflt* ]] && inside+=($t)
        done
        (( ${#inside} )) || continue
        if [[ -n $w ]]; then
          rtype+=(cat); rval+=($g/$w); rcnt+=(${#inside}); rtop+=($g)
          [[ -n $flt || -n ${exp[$g/$w]} ]] || continue
        fi
        for t in $inside; do rtype+=(thm); rval+=($t); rcnt+=(0); rtop+=($g${w:+/$w}); done
      done
      continue
    fi
    for t in $ts; do rtype+=(thm); rval+=($t); rcnt+=(0); rtop+=($g); done
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

__tt_pv_home() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  local w=${TTHEME_SUBJECT[$1]%%/*}
  case $TTHEME_GROUP in
    marketplace) REPLY=${1%%/*}${w:+/$w} ;;
    *) REPLY=${w:-${1%%/*}} ;;
  esac
}

__tt_pv_goto() {
  local name=$1 home i REPLY
  __tt_pv_home $1
  home=$REPLY
  exp[$home]=1 exp[${home%%/*}]=1
  __tt_pv_rows
  for (( i = 1; i <= ${#rval}; i++ )); do
    [[ ${rtype[i]} == thm && ${rval[i]} == $name && ${rtop[i]} == "$home" ]] && { cur=$i; return 0 }
  done
  cur=1
}

__tt_pv_shows() {
  REPLY=${bgview[$1]:-$1}
  [[ -n $tune && $1 == "$tune" ]] && REPLY=$tpick
  return 0
}

__tt_pv_want() {
  REPLY=""
  if (( te )); then
    __tt_pv_shows $tename
  elif [[ -n $an ]]; then
    __tt_pv_shows $an
  fi
  return 0
}

__tt_pv_focus() {
  local spec=""
  if (( ! te )) && [[ ${rtype[cur]} == thm ]]; then
    an=${rval[cur]} spec=${TTHEME_PALETTE[${rval[cur]}]}
  fi
  if (( ! resized )); then
    __tt_pv_want
    [[ -z $REPLY || $REPLY == "$bgname" ]] || __tt_pv_bg_show "$REPLY"
  fi
  [[ -n $spec && $spec != "$applied" ]] || return 0
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
  local g=${rtop[cur]}
  [[ -n $g ]] || return 0
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
  local text=${(U)osd} bits line oc=$TTHEME_SGR[bold] blank
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
      out+=$'\e['$(( top + r * s + i ))';'${left}H$oc$line$TTHEME_SGR[reset]
    done
  done
  out+=$'\e['$(( top + 5 * s ))';'${left}H$blank
}

__tt_pv_lw() {
  local -i lw=$(( pw - 1 < 48 ? pw - 1 : 48 )) l=$(( pw * 3 / 10 )) sw=$(( pw * 45 / 100 ))
  (( l < 38 )) && l=38
  (( l > 56 )) && l=56
  (( sw > 64 )) && sw=64
  if (( sw < 50 )); then
    sw=50
    (( pw - l - 6 < sw )) && l=$(( pw - sw - 6 ))
    (( l < 30 )) && l=30
  fi
  (( sw > pw - l - 6 )) && sw=$(( pw - l - 6 ))
  (( sw < 50 )) && sw=0
  if (( color && sw )); then
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
  REPLY=${t[1,${#pre}]}$hm${t[${#pre}+1,${#pre}+${#flt}]}$TTHEME_SGR[/match]$2${t[${#pre}+${#flt}+1,-1]}
}

__tt_pv_fit() {
  local extra=$1 cut=""
  REPLY=""
  [[ -n $extra ]] || return 0
  [[ -n $2 ]] && (( ${(m)#extra} + 3 > w )) && cut=$TTHEME_MARKS[cut]
  while [[ -n $extra ]] && (( ${(m)#extra} + ${#cut} + 3 > w )); do
    extra=${extra[1,-2]}
  done
  [[ -n $extra ]] || return 0
  extra+=$cut
  (( w -= ${(m)#extra} + 2 ))
  REPLY="  "$d$extra$r
}

__tt_pv_row() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  local t=${rval[$1]} b=$TTHEME_SGR[bold] d=$TTHEME_SGR[dim] r=$TTHEME_SGR[/match] z=$TTHEME_SGR[reset] on="" gut="  " base="" lead=$TTHEME_SGR[dim] mark=" " name arrow=$TTHEME_MARKS[closed] hl by="" extra part ind
  local -i w
  (( color )) || b= d= r= z= lead=
  if (( $1 == cur )); then
    gut=$gc$TTHEME_MARKS[gutter]$r" "
    (( color )) && on=$sb
  elif (( $1 == mhi && color )); then
    gut=$d$TTHEME_MARKS[gutter]$r" "
    d="" lead=""
  fi
  if [[ ${rtype[$1]} == rule ]]; then
    name='── Originals '
    REPLY="   "$d$name${(l:lw - 4 - ${#name}::─:)}$z
    return 0
  fi
  if [[ ${rtype[$1]} == hdr ]]; then
    [[ -n $flt || -n ${exp[$t]} ]] && arrow=$TTHEME_MARKS[opened]
    name=${TTHEME_WORK_NAME[$t]:-$t}
    (( ${(m)#name} > lw - 10 )) && name="${name[1,lw-11]}…"
    base=$b
    if (( color )) && [[ $t == "$ag" || $ag == "$t"/* ]]; then
      base+=$ac lead=$ac
    elif (( $1 == cur )); then
      lead=""
    fi
    [[ $mhov == "fold $1" ]] && lead=$ac
    __tt_pv_hl "$name" "$base"
    hl=$REPLY
    w=$(( lw - 6 - ${(m)#name} - ${#rcnt[$1]} ))
    __tt_pv_fit "${TTHEME_WORK_NATIVE[$t]}" cut
    extra=$REPLY
    (( w < 1 )) && w=1
    REPLY=$gut$on" "$lead$arrow$r" "$base$hl$r$extra${(l:w:: :)}$d${rcnt[$1]}$r" "$z
    return 0
  fi
  if [[ ${rtype[$1]} == cat ]]; then
    [[ -n $flt || -n ${exp[$t]} ]] && arrow=$TTHEME_MARKS[opened]
    part=${t#*/}
    name=${TTHEME_WORK_NAME[$part]:-$part}
    (( ${(m)#name} > lw - 12 )) && name="${name[1,lw-13]}…"
    base=$b
    if (( color )) && [[ $t == "$ag" ]]; then
      base+=$ac lead=$ac
    elif (( $1 == cur )); then
      lead=""
    fi
    [[ $mhov == "fold $1" ]] && lead=$ac
    __tt_pv_hl "$name" "$base"
    hl=$REPLY
    w=$(( lw - 8 - ${(m)#name} - ${#rcnt[$1]} ))
    __tt_pv_fit "${TTHEME_WORK_NATIVE[$part]}" cut
    extra=$REPLY
    (( w < 1 )) && w=1
    REPLY=$gut$on"   "$lead$arrow$r" "$base$hl$r$extra${(l:w:: :)}$d${rcnt[$1]}$r" "$z
    return 0
  fi
  if (( $1 == cur )); then
    mark=$gc"■"$r base=$b
  elif [[ -n $cdot && $t == "$cn" ]]; then
    mark=$ac$cdot$r
  fi
  name=${t##*/} ind="   "
  [[ ${rtop[$1]} == */* ]] && ind="     "
  [[ ${t%%/*} != ttheme ]] && (( ${+TTHEME_WORK_NAME[${rtop[$1]}]} )) && by=${t%%/*}
  (( ${TTHEME_TUNED[(Ie)$t]} )) && w=-2
  (( ${(m)#name} > lw - 17 - ${#ind} + w )) && name="${name[1,lw-18-${#ind}+w]}…"
  __tt_pv_hl "$name" "$base"
  hl=$REPLY
  if (( w )); then
    (( color )) && hl+=" "$TTHEME_SGR[warn]$TTHEME_MARKS[on]$TTHEME_SGR[/warn] || hl+=" "$TTHEME_MARKS[on]
  fi
  extra=""
  for part in "${(@s:|:)TTHEME_NATIVE_NAMES[$t]}" "${TTHEME_CHARACTER[$t]}"; do
    __tt_pv_alias "${t##*/}" "$part"
    [[ -n $REPLY ]] && { extra=$REPLY; break }
  done
  if (( color )); then
    [[ -n ${tstrip[$t]} ]] || __tt_pv_strip $t
    w=$(( w + lw - 16 - ${#ind} - ${#name} ))
  else
    w=$(( w + lw - 4 - ${#ind} - ${#name} ))
  fi
  __tt_pv_fit "$by" cut
  by=$REPLY
  __tt_pv_fit "$extra"
  extra=$REPLY
  if (( $1 == mhi && color )); then
    by=${by//"$TTHEME_SGR[dim]"/} extra=${extra//"$TTHEME_SGR[dim]"/}
  fi
  if (( color )); then
    (( w < 1 )) && w=1
    REPLY=$gut$on"$ind$mark $base$hl$r$by$extra${(l:w:: :)}${tstrip[$t]} "$z
  else
    REPLY="$gut$ind$mark $hl$by$extra"
  fi
}

__tt_pv_bg_pickkey() {
  REPLY=${tpick#*:}
  [[ $tpick == *:* ]] || REPLY=${bgact[$tune]}
}

__tt_pv_bg_credit() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  local by=${bgby[$tpick]} ref=${bgfrom[$tpick]} url=${bgurl[$tpick]} page lab pu pmark="" smark="" sgr="" acc=""
  local -i room=$1
  local -a items
  __tt_pv_bg_pickkey
  page=${bgpage[$tune:$REPLY]}
  pu=${page%% *} lab=${page#* }
  [[ $url == http(s|)://* ]] || url=""
  if __tt_links; then
    [[ -n $url ]] && pmark="$TTHEME_MARKS[link] "
    [[ -n $pu ]] && smark="$TTHEME_MARKS[link] "
  fi
  items=(${by:+"by $by"} ${lab:+"$smark$lab"} ${ref:+"$pmark$ref"})
  while (( ${#items} )) && (( ${#${(j:  :)items}} > room )); do
    items[-1]=()
  done
  REPLY=${(j:  :)items}
  if [[ -n $smark && $REPLY == *"$smark$lab"* ]]; then
    (( color )) && acc=$ac
    REPLY=${REPLY/"$smark$lab"/$acc$TTHEME_MARKS[link]${acc:+$TTHEME_SGR[/accent]} $'\e]8;;'$pu$'\e\\'$lab$'\e]8;;\e\\'}
  fi
  [[ -n $pmark && $REPLY == *"$pmark$ref"* ]] || return 0
  (( color )) && [[ -n ${TTHEME_SITE_ANSI[${ref%% *}]} ]] && sgr=$TTHEME_SGR[fg${TTHEME_SITE_ANSI[${ref%% *}]}]
  REPLY=${REPLY/"$pmark$ref"/$sgr$TTHEME_MARKS[link]${sgr:+$TTHEME_SGR[/fg]} $'\e]8;;'$url$'\e\\'$ref$'\e]8;;\e\\'}
  return 0
}

__tt_pv_copy() {
  if (( $+commands[pbcopy] )); then
    print -rn -- $1 | LC_CTYPE=UTF-8 pbcopy
  elif [[ -n $WAYLAND_DISPLAY ]] && (( $+commands[wl-copy] )); then
    print -rn -- $1 | wl-copy
  elif [[ -n $DISPLAY ]] && (( $+commands[xclip] )); then
    print -rn -- $1 | xclip -selection clipboard
  else
    return 1
  fi
} >/dev/null 2>&1

__tt_pv_bg_copy() {
  local text
  __tt_pv_bg_pickkey
  text=${bgcred[$tune:$REPLY]}
  if [[ -z $text ]]; then
    msg="This picture names no artist and no page" msgt=300
    return 0
  fi
  if [[ -n $SSH_CONNECTION$SSH_TTY ]] || ! __tt_pv_copy $text; then
    __tt_b64s $text
    __tt_out $'\e]52;c;'$REPLY$'\a'
  fi
  msg="Copied  $text" msgt=200
}

__tt_pv_bg_profiles() {
  local k entry plain="" step piece acc="" lead
  local -a ents e
  local -i room=$1 i many
  REPLY=""
  __tt_links || return 0
  __tt_pv_bg_pickkey
  k=$REPLY REPLY=""
  ents=(${(f)bgprof[$tune:$k]})
  many=$(( ${#ents} > 1 ))
  (( color )) && acc=$ac
  for entry in $ents; do
    e=(${=entry})
    lead=""
    [[ -n $plain ]] && lead="  "
    if (( many )); then
      (( ${#plain} + ${#lead} + ${#e[1]} > room )) && return 0
      plain+=$lead$e[1] REPLY+=$lead$e[1] lead=" "
    fi
    for (( i = 2; i < ${#e}; i += 2 )); do
      step="$TTHEME_MARKS[link] $e[i]"
      (( ${#plain} + ${#lead} + ${#step} > room )) && return 0
      piece=$acc$TTHEME_MARKS[link]${acc:+$TTHEME_SGR[/accent]}" "$'\e]8;;'$e[i+1]$'\e\\'$e[i]$'\e]8;;\e\\'
      plain+=$lead$step REPLY+=$lead$piece lead=" "
    done
  done
  return 0
}

__tt_pv_bar() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  local z=$TTHEME_SGR[reset] d=$TTHEME_SGR[dim] on=$pl line=" " title hint mk up mo
  local -a ink
  local -i i at=${TTHEME_HUB_TABS[(Ie)preview]} len=${#TTHEME_HUB_TITLES}
  (( color )) || z= d= on=
  hint="tab ${TTHEME_HUB_TITLES[at % ${#TTHEME_HUB_TITLES} + 1]}"
  [[ ${rtype[cur]} == thm ]] && hint="shift+tab ${TTHEME_HUB_TITLES[(at + ${#TTHEME_HUB_TITLES} - 2) % ${#TTHEME_HUB_TITLES} + 1]}"
  local hk=${hint%% *}
  __tt_capped "$hint"
  hint=$REPLY
  for title in $TTHEME_HUB_TITLES; do
    (( len += ${#title} + 2 ))
  done
  local -i zc=2
  if (( color )); then
    __tt_name_of "$applied"
    ink=(${=TTHEME_MARK_INKS[$REPLY]})
    if (( ${#ink} == 3 )); then
      mo=${ink[1]#\#} up=${ink[2]#\#}
      printf -v mk '\e[38;2;%d;%d;%dm>\e[38;2;%d;%d;%dmω' $((16#${up:0:2})) $((16#${up:2:2})) $((16#${up:4:2})) $((16#${mo:0:2})) $((16#${mo:2:2})) $((16#${mo:4:2}))
      mk=$TTHEME_SGR[bold]$mk$TTHEME_SGR[/fg]$TTHEME_SGR[/bold]
    else
      mk=$TTHEME_SGR[bold]">"$ac"ω"$TTHEME_SGR[/accent]$TTHEME_SGR[/bold]
    fi
    line+=$mk"  " zc+=4 len+=4
  fi
  for (( i = 1; i <= ${#TTHEME_HUB_TITLES}; i++ )); do
    title=${TTHEME_HUB_TITLES[i]}
    (( i > 1 )) && { line+=" "; (( zc++ )) }
    pvz+=("1 $zc $(( zc + ${(m)#title} + 1 )) hub $i")
    (( zc += ${(m)#title} + 2 ))
    if (( i != at )); then
      if (( color && mhp )) && [[ $mhov == "hub $i" ]]; then
        line+=$on" $title "$z
      elif (( color )) && [[ $mhov == "hub $i" ]]; then
        line+=$TTHEME_SGR[chip]" $title "$TTHEME_SGR[/chip]
      else
        line+=$d" $title "$z
      fi
    elif (( color )); then
      line+=$on" $title "$z
    else
      line+="[$title]"
    fi
  done
  if (( len + ${#hint} + 2 <= $1 )); then
    pvz+=("1 $(( zc + 2 )) $(( zc + 1 + ${(m)#hint} )) key $hk")
    if (( color )) && [[ $mhov == "key $hk" ]]; then
      line+="  "$TTHEME_SGR[chip]$hint$TTHEME_SGR[/chip]
    else
      line+="  "$d$hint$z
    fi
  fi
  REPLY=$line
}

__tt_pv_head() {
  local b=$TTHEME_SGR[bold] d=$TTHEME_SGR[dim] z=$TTHEME_SGR[reset] title=$4 sub=$5 right=$6
  local -i room=$(( $3 - $2 + 1 )) used
  (( color )) || b= d= z=
  if (( ${(m)#title} > room )); then
    while [[ -n $title ]] && (( ${(m)#title} > room - 1 )); do title=${title[1,-2]}; done
    title+=…
  fi
  used=${(m)#title}
  (( used + 2 + ${(m)#sub} <= room )) || sub=""
  [[ -n $sub ]] && (( used += 2 + ${(m)#sub} ))
  (( used + 2 + ${(m)#right} <= room )) || right=""
  out+=$'\e['$1';'$2'H'$b$gc$title$z
  [[ -n $sub ]] && out+="  "$d$sub$z
  [[ -n $right ]] && out+=$'\e['$(( $3 - ${(m)#right} + 1 ))'G'$d$right$z
  return 0
}

__tt_pv_standing() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  local -a reply
  local standing=unknown latest="" was=$vline
  integer now
  vchk=0 vwarn=0 vnew=0
  if [[ $TTHEME_AUTO_UPDATE != off && ${CI:-false} == false ]]; then
    (( $+EPOCHSECONDS )) || zmodload -F zsh/datetime p:EPOCHSECONDS 2>/dev/null
    now=$(( EPOCHSECONDS * 1000 ))
    __tt_release_seen $TTHEME_STATE_DIR/release.json
    latest=$reply[2]
    if (( reply[4] && now - reply[4] < 30000 )); then
      standing=checking vchk=1
    elif (( reply[5] )); then
      standing=failed vwarn=1
    elif [[ -n $latest ]]; then
      standing=current
      __tt_newer $latest $TTHEME_VERSION && standing=newer vwarn=1 vnew=1
    fi
  fi
  if [[ $standing == newer ]]; then
    printf -v vline $TTHEME_STANDING[$standing] $TTHEME_VERSION $latest
  else
    printf -v vline $TTHEME_STANDING[$standing] $TTHEME_VERSION
  fi
  [[ $vline != "$was" ]]
}

__tt_pv_foot() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  setopt localoptions extendedglob
  local b=$TTHEME_SGR[bold] d=$TTHEME_SGR[dim] z=$TTHEME_SGR[reset] y=$TTHEME_SGR[warn] al=$TTHEME_SGR[alert] on=$pl badge="" pre="" lead="" note="" right="" rk="" ver="" text line plain hex tb=EDIT ke ku REPLY
  local -a kk=() kl=() seg=()
  __tt_cap esc; ke=$REPLY
  __tt_cap alt+u; ku=$REPLY
  local -i end=$1 bw=$(( $1 - 1 )) i lwid rwid vwid rend room
  (( color )) || b= d= z= y= al= on=
  local hl=$TTHEME_SGR[chip] hx=$TTHEME_SGR[/chip]
  (( mhp )) && hl=$pl hx=$TTHEME_SGR[/pill]
  if (( color )) && [[ -n $applied && $applied != "$painted" ]]; then
    hex=${${=applied}[8]#\#}
    printf -v y '\e[38;2;%d;%d;%dm' $((16#${hex:0:2})) $((16#${hex:2:2})) $((16#${hex:4:2}))
    al=$TTHEME_SGR[reverse]$TTHEME_SGR[bold]$y
  fi
  if (( help )); then
    badge=HELP rk='?' right=$b"? / $ke"$z$d" close"$z
  elif [[ -n $pick ]]; then
    __tt_label "$pick"
    badge='PREVIEW (APPLY)' pre="$REPLY → "
    (( te )) && badge="$tb (APPLY)"
    for (( i = 1; i <= ${#plabel}; i++ )); do
      (( i > 1 )) && lead+=" "
      if (( i != pk )) && (( color )) && [[ $mhov == "pick $i" ]]; then
        lead+=$hl${plabel[i]}$hx
      elif (( i != pk )); then
        lead+=$d${plabel[i]}$z
      elif (( color )); then
        lead+=$on${plabel[i]}$z
      else
        lead+="[${${plabel[i]# }% }]"
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
      note="New tabs, the default palette"
    fi
    kk=(←→ enter) kl=(choose confirm)
    rk=esc right=$b$ke$z$d" back"$z
  elif (( te && tfocus == 0 )); then
    badge=$tb kk=(enter ↑↓ s shift+enter '?') kl=("edit palette" move save apply keys)
    (( tbtn )) && kl[1]="reset palette"
    (( ${TTHEME_TUNED[(Ie)$tename]} )) && kk[2]=↑↓←→
    rk=esc right=$b$ke$z$d" cancel"$z
  elif (( te && tfocus == 2 )); then
    badge=$tb kk=(enter ↑↓ s '?') kl=(apply move save keys)
    rk=esc right=$b$ke$z$d" cancel"$z
  elif (( te )); then
    badge=$tb
    kk=(↑↓ ←→ s) kl=(move change save)
    if [[ -n $tune ]] && (( tf == 5 )); then
      __tt_pv_bg_images $tune
      kl[2]="picture ×$REPLY"
      (( REPLY > 1 )) || { kk[2]=() kl[2]=() }
      __tt_pv_bg_findable $tune && { kk+=(f); kl+=(find) }
      kk+=(D) kl+=(remove)
    elif [[ -n $tune ]]; then
      __tt_pv_bg_findable $tune && { kk+=(f); kl+=(find) }
      (( tf == 2 )) && { kl[2]=move; kk+=(1-9); kl+=(place) }
      (( tf == 4 && ! bgoff[$tpick] )) && { kk+=(c); kl+=(colors) }
      (( tf < 4 )) && __tt_pv_bg_tuned $tpick $tf && { kk+=('='); kl+=(reset) }
      __tt_pv_bg_tuned $tpick 0 && { kk+=(+); kl+=("reset all") }
      (( bgoff[$tpick] )) && { kk+=(space); kl+=(show) }
      __tt_pv_bg_images $tune
      (( REPLY > 1 )) && { kk+=(', .' D); kl+=("picture ×$REPLY" remove) }
    else
      kk=(enter ↑↓ s) kl=(find move save)
    fi
    kk+=(shift+enter '?') kl+=(apply keys)
    rk=esc right=$b$ke$z$d" cancel"$z
  elif (( sample )); then
    badge='PREVIEW (SAMPLE)' kk=(↑↓ shift+←→ enter '?') kl=(move sample use keys)
    rk=esc right=$b$ke$z$d" back"$z
  elif (( gmenu )); then
    badge=GROUP kk=(↑↓ space) kl=(move pick)
    rk=esc right=$b$ke$z$d" close"$z
  elif (( conf )); then
    badge=SETTINGS kk=(↑↓ ←→ enter) kl=(move change save)
    rk=esc right=$b$ke$z$d" cancel"$z
  else
    badge=PREVIEW
    [[ -n $flt ]] && badge='PREVIEW (FILTER)'
    if (( ! ${#rval} )); then
      kk=(bksp) kl=(edit)
      (( hub && ${TTHEME_HUB_TABS[(Ie)browse]} )) && [[ -n $flt ]] && kk=(enter bksp) kl=(search edit)
    elif [[ ${rtype[cur]} == (hdr|cat) ]]; then
      if [[ -z $flt && -n ${exp[${rval[cur]}]} ]]; then
        kk=(←) kl=(close)
      elif [[ -z $flt ]]; then
        kk=(→) kl=(open)
      fi
    else
      kk=(enter → tab) kl=(use edit sample)
      [[ -n $flt ]] && { kk+=(bksp); kl+=(edit) }
    fi
    __tt_pv_alt && { kk+=(alt+c); kl+=(settings) }
    kk+=('?') kl+=(keys)
    if [[ -n $flt ]]; then
      rk=esc right=$b$ke$z$d" clear"$z
    else
      rk=esc right=$b$ke$z$d" cancel"$z
      [[ -n $cdot ]] && right+=" $ac$cdot$z $cn"
    fi
    if (( hub && vnew )); then
      ver=$b$ku$z$d" update"$z"   "$d${vline%%  *}$z"  "
      if (( color )); then
        ver+=$al" ${vline#*  } "$z
      else
        ver+=${vline#*  }
      fi
    elif (( hub )); then
      ver=$d$vline$z
      (( vwarn )) && ver=$y$vline$z
    fi
  fi
  if (( color )) && [[ -n $rk && $mhov == "key $rk" ]]; then
    right=$hl${right//$'\e'\[[0-9;]##m/}$hx
  fi
  if (( msgt > 0 )) && [[ -z $pick ]]; then
    text=$msg
    room=$(( bw - (${#badge} ? ${#badge} + 4 : 0) ))
    if (( ${(m)#text} > room )); then
      while [[ -n $text ]] && (( ${(m)#text} > room - 1 )); do text=${text[1,-2]}; done
      text+=…
    fi
    lead=$y$text$z note="" kk=() kl=() ver=""
  fi
  while :; do
    seg=()
    [[ -n $lead ]] && seg+=("$pre$lead")
    [[ -n $note ]] && seg+=("$d$note$z")
    for (( i = 1; i <= ${#kk}; i++ )); do
      __tt_cap "${kk[i]}"
      if (( color )) && [[ $mhov == "key ${kk[i]}" ]]; then
        seg+=("$hl$REPLY ${kl[i]}$hx")
      else
        seg+=("$b$REPLY$z$d ${kl[i]}$z")
      fi
    done
    line=${(j:   :)seg}
    if [[ -n $badge ]]; then
      if (( color )); then
        line=$on" $badge "$z"  "$line
      else
        line="[$badge] $line"
      fi
    fi
    plain=${line//$'\e'\[[0-9;]##m/}
    lwid=${(m)#plain}
    plain=${right//$'\e'\[[0-9;]##m/}
    rwid=${(m)#plain}
    plain=${ver//$'\e'\[[0-9;]##m/}
    vwid=${(m)#plain}
    (( lwid <= bw && lwid + (rwid ? 3 + rwid : 0) + (vwid ? 3 + vwid : 0) <= bw )) && break
    if [[ -n $ver ]] && (( ! vnew )); then
      ver=""
    elif [[ -n $note ]]; then
      note=""
    elif [[ -n $pre ]]; then
      pre=""
    elif (( ${#kk} > 2 )); then
      kk[-2]=() kl[-2]=()
    elif [[ -n $right ]]; then
      right=""
    elif (( ${#kk} > 1 )); then
      kk[-2]=() kl[-2]=()
    elif [[ -n $ver ]]; then
      ver=""
    else
      break
    fi
  done
  if (( lwid > bw )); then
    __tt_clip "$line" $bw
    line=$REPLY
  fi
  out+=" "$line$'\e[K'
  rend=$end
  if [[ -n $ver ]]; then
    out+=$'\e['$(( end - vwid + 1 ))'G'$ver$z
    rend=$(( end - vwid - 3 ))
  fi
  [[ -n $right ]] && out+=$'\e['$(( rend - rwid + 1 ))'G'$right
  local -i zc=2 zw
  [[ -n $badge ]] && (( zc += ${(m)#badge} + (color ? 4 : 3) ))
  if [[ -n $lead ]]; then
    if [[ -n $pick ]]; then
      zw=$(( zc + ${(m)#pre} - 1 ))
      for (( i = 1; i <= ${#plabel}; i++ )); do
        pvz+=("$ph $(( zw + 1 )) $(( zw + ${(m)#plabel[i]} )) pick $i")
        (( zw += ${(m)#plabel[i]} + 1 ))
      done
    fi
    plain=$pre${lead//$'\e'\[[0-9;]##m/}
    (( zc += ${(m)#plain} + 3 ))
  fi
  [[ -n $note ]] && (( zc += ${(m)#note} + 3 ))
  for (( i = 1; i <= ${#kk}; i++ )); do
    __tt_cap "${kk[i]}"
    zw=$(( ${(m)#REPLY} + 1 + ${(m)#kl[i]} ))
    pvz+=("$ph $zc $(( zc + zw - 1 )) key ${kk[i]}")
    (( zc += zw + 3 ))
  done
  if [[ -n $right ]]; then
    pvz+=("$ph $(( rend - rwid + 1 )) $rend key $rk")
  fi
  [[ -n $ver ]] && (( vnew )) && pvz+=("$ph $(( end - vwid + 1 )) $end key alt+u")
  return 0
}

__tt_pv_wrap() {
  setopt localoptions extendedglob
  local line="" rest=${1##[[:space:]]#} joined REPLY
  local -a match mbegin mend
  local -i w=$2 i
  reply=()
  while [[ $rest == (#b)([^[:space:]]##)([[:space:]]#)(*) ]]; do
    rest=$match[3] joined=$line$match[1]
    if [[ -n ${line//[[:space:]]} ]] && (( ${(m)#joined} > w )); then
      reply+=("${line%%[[:space:]]#}")
      line=""
    fi
    line+=$match[1]$match[2]
  done
  line=${line%%[[:space:]]#}
  [[ -n $line ]] && reply+=("$line")
  (( ${#reply} )) || reply=("")
  for (( i = 1; i <= ${#reply}; i++ )); do
    (( ${(m)#reply[i]} > w )) && { __tt_clip "${reply[i]}" $w; reply[i]=$REPLY }
  done
  return 0
}

__tt_pv_topics() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  local -i i
  local w
  hg=() hk=() hd=() kw=0 dw=0
  for (( i = 1; i + 3 <= ${#TTHEME_PREVIEW_KEYS}; i += 4 )); do
    w=$TTHEME_PREVIEW_KEYS[i]
    [[ $2 == box && $w == *:bar ]] && continue
    case ${w%:bar} in
      $1) ;;
      hub) (( hub )) && [[ $1 == list ]] || continue ;;
      help) (( help )) || continue ;;
      *) continue ;;
    esac
    __tt_capped "$TTHEME_PREVIEW_KEYS[i+2]"
    hg+=("$TTHEME_PREVIEW_KEYS[i+1]") hk+=("$REPLY") hd+=("$TTHEME_PREVIEW_KEYS[i+3]")
    (( ${(m)#REPLY} > kw )) && kw=${(m)#REPLY}
    (( ${(m)#hd[-1]} > dw )) && dw=${(m)#hd[-1]}
  done
  return 0
}

__tt_pv_keys() {
  (( ph >= 22 )) && [[ $TTHEME_HELP_BOX != off ]] || return 0
  local z=$TTHEME_SGR[reset] b=$TTHEME_SGR[bold]
  local -a hg=() hk=() hd=()
  local -i i r top x=$(( sc + 2 )) kw=0 dw=0 tw
  __tt_pv_topics $1 box
  [[ $1 == panel && -z $tune ]] && hk=("$hk[1]") hd=("$hd[1]")
  (( sw - kw - 6 >= 16 )) || return 0
  top=$(( ph - ${#hk} - 2 ))
  (( top >= ${2:-0} )) || return 0
  sbot=$(( top - 1 ))
  if (( gmenu )); then
    __tt_pv_topics group box
  elif [[ -n $pick ]]; then
    __tt_pv_topics pick box
  elif (( te && tfocus != 1 )); then
    hk=("$hk[1]") hd=("$hd[1]")
  fi
  tw=$(( se - x - kw - 3 ))
  __tt_pv_box $top $(( ph - 1 )) Help
  r=$(( top + 1 ))
  for (( i = 1; i <= ${#hk}; i++, r++ )); do
    REPLY=${hd[i]}
    (( ${(m)#REPLY} > tw )) && __tt_clip "$REPLY" $tw
    out+=$'\e['$r';'$x'H'$b${hk[i]}$z$'\e['$r';'$(( x + kw + 2 ))'H'$REPLY
  done
  return 0
}

__tt_pv_help() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  local z=$TTHEME_SGR[reset] b=$TTHEME_SGR[bold] d=$TTHEME_SGR[dim] blank where=list
  (( te )) && where=panel
  (( sample )) && where=sample
  (( gmenu )) && where=group
  (( conf )) && where=settings
  local -a hg=() hk=() hd=() hl=() hn=() wn=() reply=()
  local -i i j k r x y w hh floor tw kw=0 dw=0 rows used n c0 r0
  __tt_pv_topics $where
  (( color )) || z= b= d=
  if (( split && sw >= 48 )); then
    c0=$(( sc + 2 )) r0=2 tw=$(( sw - kw - 8 )) rows=$(( ph - 3 ))
  else
    w=$(( kw + dw + 10 ))
    (( w > pw - 2 )) && w=$(( pw - 2 ))
    tw=$(( w - 10 - kw )) rows=$(( ph - 5 ))
  fi
  (( tw < 8 )) && tw=8
  for (( i = 1; i <= ${#hk}; i++ )); do
    __tt_pv_wrap "${hd[i]}" $tw
    hl+=("${reply[@]}") wn+=(${#reply}) hn+=(${#reply})
    [[ ${hg[i]} != "${hg[i-1]}" ]] && (( hn[i]++ ))
    (( used += hn[i] ))
  done
  n=${#hk}
  if (( used > rows )); then
    used=1
    for (( n = 0; n < ${#hk} && used + hn[n + 1] <= rows; n++ )); do
      (( used += hn[n + 1] ))
    done
  fi
  if (( ! split || sw < 48 )); then
    hh=$(( used + 4 ))
    x=$(( (pw - w) / 2 + 1 )) y=$(( (ph - hh) / 2 ))
    floor=$(( te && ! split ? 4 : pvhd + 2 ))
    (( y < floor )) && y=$floor
    (( y > ph - hh )) && y=$(( ph - hh ))
    (( y < 1 )) && y=1
    blank=${(l:w:: :)}
    out+=$'\e['$y';'$x'H'"╭─ Help ${(l:$(( w - 9 ))::─:)}╮"
    for (( r = y + 1; r < y + hh - 1; r++ )); do
      out+=$'\e['$r';'$x'H'$blank$'\e['$r';'$x'H│'$'\e['$r';'$(( x + w - 1 ))'H│'
    done
    out+=$'\e['$(( y + hh - 1 ))';'$x'H'"╰${(l:$(( w - 2 ))::─:)}╯"
    c0=$(( x + 3 )) r0=$(( y + 2 ))
  fi
  r=$r0
  for (( i = 1; i <= n; i++ )); do
    [[ ${hg[i]} != "${hg[i-1]}" ]] && out+=$'\e['$(( r++ ))';'$c0'H'$b${hg[i]}$z
    for (( j = 1; j <= wn[i]; j++, r++ )); do
      (( ++k ))
      (( j == 1 )) && out+=$'\e['$r';'$(( c0 + 2 ))'H'$b${hk[i]}$z
      out+=$'\e['$r';'$(( c0 + 4 + kw ))'H'${hl[k]}
    done
  done
  (( n < ${#hk} )) && out+=$'\e['$r';'$c0'H'$d$TTHEME_MARKS[below]" $(( ${#hk} - n )) more"$z
  (( split && sw >= 48 )) && __tt_pv_box 1 $(( r + (n < ${#hk}) )) Help
  return 0
}

__tt_pv_tabs() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  local -a names=($TTHEME_SCENES)
  [[ $mode == pin ]] && names=(Pins $names)
  local z=$TTHEME_SGR[reset] d=$TTHEME_SGR[dim] b=$TTHEME_SGR[bold] hl=$TTHEME_SGR[chip] hx=$TTHEME_SGR[/chip]
  local -i k at n=${#names} zc=$sc
  (( n )) || return 1
  (( mhp )) && hl=$pl hx=$TTHEME_SGR[/pill]
  at=$(( (scene % n + n) % n + 1 ))
  shown=$names[at] tabs=""
  if (( ${#${(j:  :)names}} <= sw )); then
    for (( k = 1; k <= n; k++ )); do
      if (( k > 1 )); then
        tabs+="  "
        (( zc += 2 ))
      fi
      if (( k == at )); then
        tabs+=$b$ac$names[k]$z
      else
        tabz+=("2 $zc $(( zc + ${#names[k]} - 1 )) scene $k")
        if (( color )) && [[ $mhov == "scene $k" ]]; then
          tabs+=$hl$names[k]$hx
        else
          tabs+=$d$names[k]$z
        fi
      fi
      (( zc += ${#names[k]} ))
    done
  else
    tabs=$b$ac$names[at]$z"  "$d"$at/$n"$z
  fi
}

__tt_pv_sample() {
  local shown tabs
  local -a tabz=()
  local -i sw=$(( sw - 4 )) sc=$(( sc + 2 ))
  __tt_pv_tabs || return 0
  if [[ $shown == Pins ]]; then
    __tt_pv_pins
  else
    __tt_pv_specimen
  fi
}

__tt_pv_pins() {
  local key="pins|$sbot|$sw|$sc|$ph" built="" line REPLY
  local -a reply lines
  local -i r=4
  pvz+=("${tabz[@]}")
  out+=$'\e[2;'$sc'H'$tabs
  if [[ $key == "$pvscene" ]]; then
    out+=$pvscenes
    sfit=$pvsfit
    return 0
  fi
  if (( ${#TTHEME_PINS} )); then
    __tt_map_whole $sw $(( sbot - 7 > 2 ? sbot - 7 : 2 ))
    lines=("${reply[@]}" "")
    __tt_here_fit Here $sw
    lines+=("${reply[@]}")
  else
    __tt_clip "$TTHEME_SGR[dim]No pins yet — enter picks one here$TTHEME_SGR[reset]" $sw
    lines=("$REPLY")
  fi
  sfit=$(( 4 + ${#lines} < sbot ? 4 + ${#lines} : sbot )) pvsfit=$sfit
  for line in "${lines[@]}"; do
    (( r < sbot )) || break
    built+=$'\e['$r';'$sc'H'$line
    (( ++r ))
  done
  pvscene=$key pvscenes=$built
  out+=$built
}

__tt_pv_specimen() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  local -a sp=(${=applied}) lines parts
  local z=$TTHEME_SGR[reset] d=$TTHEME_SGR[dim] cell hex fore line text piece role built="" key="$applied|$painted|$scene|$sbot|$sw|$sc|$ph"
  local -A rs=(p "" d $TTHEME_SGR[dim] b $TTHEME_SGR[bold])
  local -i i r=6 cw=4 k at=${TTHEME_SCENES[(Ie)$shown]} room
  lines=("${(@P)${:-TTHEME_SCENE_$at}}")
  if (( sw < 44 )); then
    lines=("${(@)lines:#«w»*}")
  else
    lines=("${(@)lines:#«n»*}")
  fi
  sfit=$(( 6 + ${#lines} < sbot ? 6 + ${#lines} : sbot ))
  (( ${#sp} >= 20 )) || return 0
  pvz+=("${tabz[@]}")
  out+=$'\e[2;'$sc'H'$tabs
  if [[ $key == "$pvscene" ]]; then
    out+=$pvscenes
    return 0
  fi
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
  (( sw < 44 )) && cw=3
  (( sw >= 56 )) && cw=$(( (sw + 1) / 8 - 1 ))
  (( cw > 7 )) && cw=7
  line=""
  for (( i = 0; i < 8; i++ )); do
    fore=${sp[i+5]#\#} hex=${sp[i+13]#\#}
    printf -v cell "\e[38;2;%d;%d;%d;48;2;%d;%d;%dm%s${TTHEME_SGR[/ink]} " \
      $((16#${fore:0:2})) $((16#${fore:2:2})) $((16#${fore:4:2})) \
      $((16#${hex:0:2})) $((16#${hex:2:2})) $((16#${hex:4:2})) "${(l:cw::▀:)}"
    line+=$cell
  done
  built+=$'\e[4;'$sc'H'$line
  for line in "${lines[@]}"; do
    (( r < sbot )) || break
    parts=("${(@s:«:)line}")
    text=$parts[1] room=$sw
    while (( ${(m)#text} > room )); do text=${text[1,-2]}; done
    (( room -= ${(m)#text} ))
    for piece in "${(@)parts[2,-1]}"; do
      (( room > 0 )) || break
      role=${piece%%»*}
      [[ $role == [wn] ]] && role=p
      piece=${piece#*»}
      while (( ${(m)#piece} > room )); do piece=${piece[1,-2]}; done
      text+=$z${rs[${role:-p}]}$piece
      (( room -= ${(m)#piece} ))
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
    y) __tt_pv_bg_copy ;;
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
  (( changed )) && msg="Kept, and saved when preview closes" msgt=200
  tune="" tpick="" tsnaps=() bgname=""
}

__tt_pv_tune_keep() {
  __tt_pv_behind_wait
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
  local ty=${rtype[cur]} v=${rval[cur]} first="" i
  [[ $ty == thm ]] && first=$v
  [[ $ty == (hdr|cat) ]] && first=${${=tmembers[$v]}[1]}
  __tt_pv_tops
  __tt_pv_rows
  for (( i = 1; i <= ${#rval}; i++ )); do
    [[ ${rtype[i]} == "$ty" && ${rval[i]} == "$v" ]] && { cur=$i; return 0 }
  done
  [[ -n $first ]] && { __tt_pv_goto $first; return 0 }
  cur=1
}

__tt_pv_gopen() {
  gmenu=1
  gm=${gitems[(Ie)TTHEME_GROUP:$TTHEME_GROUP]}
  (( gm )) || gm=1
}

__tt_pv_gstep() {
  local -i n=${#gitems} i=$(( gm + $1 ))
  if [[ $2 == edge ]]; then
    (( i >= 1 && i <= n )) && gm=$i
  else
    gm=$(( (i - 1 + n) % n + 1 ))
  fi
  return 0
}

__tt_pv_gpick() {
  local var=${gitems[$1]%%:*} v=${gitems[$1]#*:} was REPLY
  gm=$1 was=${(P)var}
  [[ $was == "$v" ]] && return 0
  typeset -g "$var=$v"
  __tt_pv_regroup
  if __tt_config_write $var $v; then
    __tt_tilde "$TTHEME_CONFIG"
    msg="Saved  $REPLY" msgt=200
  else
    typeset -g "$var=$was"
    __tt_pv_regroup
    __tt_tilde "$TTHEME_CONFIG"
    msg="Could not write $REPLY" msgt=200
  fi
}

__tt_pv_gmenu() {
  case $key in
    $'\x03') return 1 ;;
    up|k) __tt_pv_gstep -1 ;;
    down|j) __tt_pv_gstep 1 ;;
    ' '|$'\r') __tt_pv_gpick $gm ;;
    esc|altg|©) gmenu=0 ;;
    '?') help=1 ;;
  esac
  return 0
}

__tt_pv_alt() { [[ -z $flt ]] || ! __tt_caps }

__tt_pv_chip() {
  local text key
  local -i room=$2 at end=$lw gap
  text="Group $TTHEME_GROUP / Sort ${gshow[$TTHEME_SORT]:-$TTHEME_SORT}"
  (( ${(m)#text} + 2 > room )) && text="$TTHEME_GROUP / ${gshow[$TTHEME_SORT]:-$TTHEME_SORT}"
  REPLY=""
  (( ${(m)#text} + 2 <= room )) || return 0
  __tt_cap alt+g
  key=$REPLY
  at=$(( lw - ${(m)#text} - 1 ))
  gap=$(( (split ? sc - 1 : se) - lw - ${(m)#key} - 2 ))
  if (( ! color )); then
    REPLY=$'\e['$at'G'"[$text]"
  elif (( gmenu )) || [[ $mhov == group && $mhp == 1 ]]; then
    REPLY=$'\e['$at'G'$pl" $text "$TTHEME_SGR[/pill]
  elif [[ $mhov == group ]]; then
    REPLY=$'\e['$at'G'$TTHEME_SGR[hot]" $text "$TTHEME_SGR[/hot]
  else
    REPLY=$'\e['$at'G'$TTHEME_SGR[chip]" $text "$TTHEME_SGR[/chip]
  fi
  if (( gap >= 2 )) && __tt_pv_alt; then
    (( color )) && REPLY+="  "$TTHEME_SGR[dim]$key$TTHEME_SGR[/dim] || REPLY+="  $key"
    end=$(( lw + 2 + ${(m)#key} ))
  fi
  pvz+=("$1 $at $end group")
}

__tt_pv_gdraw() {
  local z=$TTHEME_SGR[reset] fr=$ac mark text
  local -i x=$(( lw - 16 )) y=$(( hub + 2 )) i r
  (( color )) || z= fr=
  for (( r = y; r < y + ${#gitems} + 3; r++ )); do
    out+=$'\e['$r';'$(( x - 1 ))'H '
  done
  out+=$'\e['$y';'$x'H'$fr"╭─ Group ${(l:7::─:)}╮"$z
  pvz+=("$y $x $(( x + 16 )) gbox")
  r=$y
  for (( i = 1; i <= ${#gitems}; i++ )); do
    if (( i == 3 )); then
      out+=$'\e['$(( ++r ))';'$x'H'$fr"├─ Sort ${(l:8::─:)}┤"$z
      pvz+=("$r $x $(( x + 16 )) gbox")
    fi
    (( ++r ))
    mark=$TTHEME_MARKS[off]
    [[ ${gitems[i]#*:} == "${(P)${gitems[i]%%:*}}" ]] && mark=$TTHEME_MARKS[on]
    text=${gitems[i]#*:}
    text=${(r:11:)${gshow[$text]:-$text}}
    out+=$'\e['$r';'$x'H'$fr"│"$z
    if (( i == gm && ! color )); then
      out+=$TTHEME_MARKS[focus]$mark" "$text" "
    elif (( i == gm )); then
      out+=$pl" $mark $text "$TTHEME_SGR[/pill]
    elif (( color )) && [[ $mhov == "gpick $i" ]]; then
      out+=$TTHEME_SGR[chip]" $mark $text "$TTHEME_SGR[/chip]
    elif [[ $mark == $TTHEME_MARKS[on] ]] && (( color )); then
      out+=" "$ac$mark$TTHEME_SGR[/accent]" $text "
    else
      out+=" $mark $text "
    fi
    out+=$fr"│"$z
    pvz+=("$r $x $(( x + 16 )) gpick $i")
  done
  out+=$'\e['$(( ++r ))';'$x'H'$fr"╰${(l:15::─:)}╯"$z
  pvz+=("$r $x $(( x + 16 )) gbox")
}

__tt_pv_conf() {
  case $key in
    $'\x03') return 1 ;;
    up|k) cf=$(( cf > 1 ? cf - 1 : ${#cvars} )) ;;
    down|j) cf=$(( cf < ${#cvars} ? cf + 1 : 1 )) ;;
    left|sleft) __tt_pv_conf_step -1 ;;
    right|sright) __tt_pv_conf_step 1 ;;
    $'\r') __tt_pv_conf_save ;;
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
    TTHEME_FX) [[ -n $flt ]] || { __tt_pv_roll; gstep=8 } ;;
    TTHEME_TAB_PALETTE) __tt_pv_canpick ;;
    TTHEME_MOUSE) __tt_pv_pointer ;;
  esac
}

__tt_pv_pointer() {
  if [[ $1 == off || $TTHEME_MOUSE == off ]]; then
    if [[ -n $pvmouse ]]; then
      __tt_pv_unhover
      printf '\e]22;default\e\\\e[?1006l\e[?1003l\e[?1002l\e[?1000l'
    fi
    pvmouse="" mzone=""
  else
    pvmouse=$'\e[?1000h\e[?1002h'
    [[ -n $SSH_CONNECTION$SSH_TTY ]] || pvmouse+=$'\e[?1003h'
    pvmouse+=$'\e[?1006h'
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

__tt_pv_conf_job() {
  local -i rc=0
  (( $1 )) && { __tt_cli sync > /dev/null 2>&1 || rc=$? }
  case $2 in
    remode) __tt_cli sync > /dev/null 2>&1 || rc=$? ;;
    redraw) __tt_cli redraw 2>&1 || rc=$? ;;
  esac
  return $rc
}

__tt_pv_conf_saved() {
  local out=$2 tab=$pvjobkeep[1] kind=$pvjobkeep[2] saved=$pvjobkeep[3]
  local -i rc=$3
  pvjobkeep=()
  if [[ -z $kind ]]; then
    (( rc )) || __tt_reload
    return 0
  fi
  if [[ $kind == remode ]]; then
    (( rc )) || __tt_pv_remoded
    out=$saved
  else
    __tt_reload
  fi
  bgsrc=() resized=1 bgdim=()
  (( $+functions[__tt_bg_refresh] )) && __tt_bg_refresh $TTHEME_ORDER
  msg=${out:-"Saved, with no pictures to draw"} msgt=300
  return 0
}

__tt_pv_conf_save() {
  __tt_pv_behind_wait
  local var kind="" note name REPLY
  local -a pairs=()
  local -i i tab
  for (( i = 1; i <= ${#cvars}; i++ )); do
    var=${cvars[i]}
    [[ ${(P)var} == "${csnap[i]}" ]] || pairs+=($var "${(P)var}")
  done
  if (( ! ${#pairs} )); then
    conf=0
    return 0
  fi
  if __tt_config_write "${pairs[@]}"; then
    __tt_tilde "$TTHEME_CONFIG"
    conf=0 msg="Saved  $REPLY" msgt=200
    tab=${pairs[(Ie)TTHEME_TAB_PALETTE]}
    if (( ${pairs[(Ie)TTHEME_MODE]} )); then
      kind=remode
    elif (( ${pairs[(Ie)TTHEME_BG_BLUR]} || ${pairs[(Ie)TTHEME_BG_STICKER]} )); then
      kind=redraw
    fi
    (( tab )) || [[ -n $kind ]] || return 0
    note=$msg
    if [[ -n $kind ]]; then
      note="Drawing the background pictures again"
      if (( $+functions[__tt_bg_write] )); then
        for name in ${(k)bgedit}; do
          __tt_bg_write $name
        done
      fi
      bgedit=()
    fi
    pvjobkeep=($tab "$kind" "$msg")
    __tt_pv_behind '*' "" __tt_pv_conf_saved "$note" __tt_pv_conf_job $tab "$kind"
  else
    __tt_pv_unconf
    __tt_tilde "$TTHEME_CONFIG"
    msg="Could not write $REPLY" msgt=200
  fi
}

__tt_pv_remoded() {
  local v n o a p REPLY
  local -a reply held
  __tt_specs_named
  held=($reply)
  __tt_name_of "$orig"
  o=$REPLY
  __tt_name_of "$applied"
  a=$REPLY
  __tt_name_of "$painted"
  p=$REPLY
  __tt_palettes_load && __tt_reloaded
  for v n in $held; do
    [[ -n ${TTHEME_PALETTE[$n]} ]] && typeset -g $v=${TTHEME_PALETTE[$n]}
  done
  [[ -n ${TTHEME_PALETTE[$o]} ]] && orig=${TTHEME_PALETTE[$o]}
  [[ -n ${TTHEME_PALETTE[$a]} ]] && applied=${TTHEME_PALETTE[$a]}
  __tt_reload
  [[ -n ${TTHEME_PALETTE[$p]} ]] && __tt_pv_paint "${TTHEME_PALETTE[$p]}"
  resized=1
}

__tt_pv_conf_panel() {
  local z=$TTHEME_SGR[reset] b=$TTHEME_SGR[bold] d=$TTHEME_SGR[dim] c=$ac on=$pl var v note
  local -a ch sh reply
  local -i r0=$1 col=$2 end=$3 k i j r fit=1
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
      out+=$c$TTHEME_MARKS[focus]$z" "$b
    elif (( color )) && [[ $mhov == (conf|confv|confs)" $k"(| *) ]]; then
      out+=$d$TTHEME_MARKS[focus]$z" "
    else
      out+="  "$d
    fi
    out+=${(r:11:)clabel[k]}$z
    if (( ! fit )); then
      v=${(P)var}
      (( i )) && v=${sh[i]}
      if (( k == cf )); then
        [[ $mhov == "confs $k -1" ]] && out+=$b
        out+=$c"‹ "$z$b$v$z
        [[ $mhov == "confs $k 1" ]] && out+=$b
        out+=$c" ›"$z
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
      if (( j != i )) && (( color )) && [[ $mhov == "confv $k $j" ]]; then
        out+=$TTHEME_SGR[chip]" ${sh[j]} "$TTHEME_SGR[/chip]
      elif (( j != i )); then
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
  r=$(( r0 + ${#cvars} + 1 ))
  cend=$(( r + 2 ))
  [[ -n $note ]] && (( r < ph )) || return 0
  __tt_pv_wrap "$note" $(( end - col + 1 ))
  if (( ${#reply} > ph - r )); then
    v=${(j: :)reply[ph-r,-1]}
    while (( ${(m)#v} > end - col )); do v=${v[1,-2]}; done
    reply[ph-r,-1]=("${v% }$TTHEME_MARKS[cut]")
  fi
  for v in $reply; do
    out+=$'\e['$(( r++ ))';'$col'H'$d$v$z
  done
  (( r > cend )) && cend=$r
  return 0
}

__tt_pv_flush() {
  local REPLY
  print -rn -- "$out"
  if (( wiped )); then
    __tt_pv_want
    [[ -n $REPLY ]] && __tt_pv_bg_show "$REPLY"
  fi
  if [[ -n $bgstrip ]]; then
    __tt_pv_bg_strip ${=bgstrip}
    __tt_pv_spins && __tt_pv_bg_orbit $pvjobtick
  elif (( ${#bgthumb} )); then
    __tt_pv_bg_strip_off
  fi
  printf '\e[%d;%dH\e[?2026l' $pvsr $pvsc
}

__tt_pv_reach() {
  local key=${pkeys[pk]} base k lab t=$'\t' d=$TTHEME_SGR[dim] z=$TTHEME_SGR[reset] REPLY
  local -a reply was=()
  local -A TTHEME_PINS=("${(@kv)TTHEME_PINS}")
  local -i room=$2 spare
  (( color )) || d= z=
  (( room < 3 )) && room=3
  if [[ $key == ssh:* ]]; then
    if [[ -n ${TTHEME_PINS[$key]} && $TTHEME_PINS[$key] != "$pick" ]]; then
      __tt_label "${TTHEME_PINS[$key]}"
      lab=$REPLY
      __tt_pin_scope "$key"
      was+=("$lab$t$REPLY")
    fi
    TTHEME_PINS[$key]=$pick
    base=$key
  else
    __tt_pin_base "$key"
    base=$REPLY
    for k in ${(k)TTHEME_PINS}; do
      [[ $k == /* ]] || continue
      __tt_pin_base "$k"
      [[ $REPLY == "$base" ]] || continue
      if [[ $k != "$key" || $TTHEME_PINS[$k] != "$pick" ]]; then
        __tt_label "${TTHEME_PINS[$k]}"
        lab=$REPLY
        __tt_pin_scope "$k"
        was+=("$lab$t$REPLY")
      fi
      unset "TTHEME_PINS[$k]"
    done
    TTHEME_PINS[$key]=$pick
  fi
  __tt_map_whole $1 $room "$base"
  spare=$(( room - ${#reply} ))
  reach=("${reply[@]}")
  [[ $key == /* || ${#was} -gt 0 ]] && reach+=("")
  __tt_pin_where "$key"
  base=$REPLY
  for k in $was; do
    if ! __tt_clip "${d}Replaces ${k%$t*} on $base  ${k##*$t}$z" $1 && (( spare > 0 )); then
      __tt_clip "${d}Replaces ${k%$t*}$z" $1
      reach+=("$REPLY")
      __tt_clip "${d}  on $base  ${k##*$t}$z" $1
      (( spare-- ))
    fi
    reach+=("$REPLY")
  done
  __tt_label "$pick"
  lab=$REPLY
  __tt_pin_scope "$key"
  __tt_clip "→ $base  $REPLY" $(( $1 - ${(m)#lab} - 2 ))
  rsub=$REPLY
  [[ $key == /* ]] || return 0
  __tt_here_fit "Then here" $1
  reach+=("${reply[@]}")
}

__tt_pv_draw() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  local out line cnt ex ag="" ac="" gc="" pl="" hm="" sb="" dd="" zz="" state=on src="" nflt="" rsub="" REPLY
  local -i lw sw split sc sbot=$ph cend teend se=$(( pw - 1 )) h k i N=${#rval} mt=${#TTHEME_ORDER} wiped=0 tall=$(( ph >= 22 )) hd
  local -a held
  (( gmenu )) && set --
  bgstrip="" bgframe=""
  if [[ -n $flt ]]; then
    __tt_pv_norm "$flt"
    nflt=$REPLY
  fi
  __tt_pv_lw
  lw=$reply[1] sw=$reply[2]
  split=$(( sw > 0 )) sc=$(( pw - sw ))
  hd=$(( tall ? hub + 4 : 2 )) pvhd=$hd
  h=$(( ph - hd - 3 ))
  (( conf && ! split )) && h=$(( ph - hd - 5 - ${#cvars} ))
  reach=()
  if [[ -n $pick && $mode == pin ]]; then
    if (( split )); then
      __tt_pv_reach $(( sw - 4 )) $(( ph - 6 ))
    else
      __tt_pv_reach $se $(( ph - hd - 11 ))
      h=$(( ph - hd - 4 - ${#reach} ))
    fi
  fi
  (( h < 1 )) && h=1
  (( cur < top )) && top=$cur
  (( cur >= top + h )) && top=$(( cur - h + 1 ))
  (( top < 1 )) && top=1
  (( N > h && top > N - h + 1 )) && top=$(( N - h + 1 ))
  (( N <= h )) && top=1
  if (( color )); then
    dd=$TTHEME_SGR[dim] zz=$TTHEME_SGR[reset] ac=$TTHEME_SGR[accent] pl=$TTHEME_SGR[pill] hm=$TTHEME_SGR[match]
    if [[ -n $applied ]]; then
      local -a ap=(${=applied})
      local acx=${ap[3]#\#} sbx=${ap[4]#\#} six=${ap[11]#\#}
      printf -v gc '\e[38;2;%d;%d;%dm' $((16#${acx:0:2})) $((16#${acx:2:2})) $((16#${acx:4:2}))
      printf -v sb '\e[48;2;%d;%d;%dm' $((16#${sbx:0:2})) $((16#${sbx:2:2})) $((16#${sbx:4:2}))
      if [[ $applied != "$painted" && -n $six ]]; then
        printf -v ac '\e[38;2;%d;%d;%dm' $((16#${six:0:2})) $((16#${six:2:2})) $((16#${six:4:2}))
        pl+=$ac hm+=$ac
      fi
    fi
    [[ ${rtype[cur]} == thm ]] && ag=${rtop[cur]}
  fi
  if [[ -n $flt ]]; then
    local -a mm=()
    for (( i = 1; i <= N; i++ )); do
      [[ ${rtype[i]} == thm ]] && mm+=(${rval[i]})
    done
    mm=(${(u)mm})
    mt=${#mm}
  fi
  cnt="$mt/${#TTHEME_ORDER}"
  out=$'\e[H'
  if (( resized )); then
    out+=$'\e[K\e[2H\e[J\e[H'
    (( bgcw )) && { __tt_bg_wipe; out+=$REPLY; __tt_pv_bg_lost }
    resized=0 wiped=1
  fi
  [[ $1 == hint ]] && (( ! wiped )) || pvz=()
  if (( pw < 40 || ph < 12 )); then
    __tt_capped "esc cancel"
    local -a small=(ttheme "Needs 40×12 — now ${pw}×${ph}" "$REPLY") paint=("" "" "")
    (( color )) && paint=($TTHEME_SGR[bold]$ac "" $TTHEME_SGR[dim])
    for (( k = 1; k <= 3 && k <= ph; k++ )); do
      line=${small[k]}
      while (( ${(m)#line} > pw )); do line=${line[1,-2]}; done
      (( k > 1 )) && out+=$'\n'
      out+=${paint[k]}$line${paint[k]:+$TTHEME_SGR[reset]}$'\e[K'
    done
    out+=$'\e[J'
    __tt_pv_flush
    return 0
  fi
  if (( sample )); then
    __tt_pv_whole
    return 0
  fi
  if (( te && ! split )); then
    __tt_pv_te_draw
    return 0
  fi
  local find typed=$flt bd="" edge=${(l:$(( lw - 3 ))::─:)}
  (( color )) && bd=$TTHEME_SGR[bold]
  while [[ -n $typed ]] && (( ${(m)#typed} > lw - 12 )); do typed=${typed[1,-2]}; done
  if [[ -n $flt ]]; then
    find=$typed"_"
  else
    ex="$expal | $extop"
    local -i room=$(( tall ? lw - 21 : lw - 19 - ${#cnt} ))
    (( ${#ex} > room )) && ex="${ex[1,room-1]}…"
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
    find=$dd"Search… e.g. $ex"$zz
  fi
  if (( tall )); then
    pvsr=$(( hub + 3 )) pvsc=$(( 6 + ${(m)#typed} ))
    line=$'\e['$lw'X '$dd"│"$zz" "$dd$TTHEME_MARKS[search]$zz" "$find$'\e['$lw'G'$dd"│"$zz
  else
    pvsr=$(( hub + 1 )) pvsc=$(( 4 + ${(m)#typed} ))
    line=$'\e['$lw'X '$dd$TTHEME_MARKS[search]$zz" "$find$'\e['$(( lw - ${#cnt} ))'G'$dd$cnt$zz
  fi
  if [[ $1 == hint ]] && (( ! wiped )); then
    print -rn -- $'\e['$pvsr'H'$TTHEME_SGR[reset]$line
    printf '\e[%d;%dH\e[?2026l' $pvsr $pvsc
    return 0
  fi
  if (( hub )); then
    __tt_pv_bar $(( split ? sc - 2 : pw - 1 ))
    out+=$REPLY$'\e[K\n'
  fi
  if (( tall )); then
    __tt_pv_chip $(( hub + 1 )) $(( lw - 12 - ${#cnt} ))
    out+=" "$bd"Preview"$zz" "$dd"($cnt)"$zz$'\e[K'$REPLY$'\n'
    out+=" "$dd"╭"$edge"╮"$zz$'\e[K\n'$line$'\e[K\n'" "$dd"╰"$edge"╯"$zz$'\e[K\n'
  else
    out+=$line$'\e[K\n'
    (( hub )) || out+=$'\e[K\n'
  fi
  if (( N > h && top > 1 )); then
    if [[ $mhov == "more -1" ]]; then
      out+="   "$TTHEME_MARKS[above]" $(( top - 1 )) more"
    else
      out+="   "$dd$TTHEME_MARKS[above]" $(( top - 1 )) more"$zz
    fi
    pvz+=("$(( hd + 1 )) 1 $lw more -1")
  fi
  out+=$'\e[K\n'
  if (( mhi && mhrow >= hd + 2 && mhrow < hd + 2 + h )); then
    i=$(( top + mhrow - hd - 2 ))
    if (( i != mhi && i <= N )) && [[ ${rtype[i]} != rule ]]; then
      mhi=$i mhov="row $i"
    fi
  fi
  for (( k = 0; k < ph - hd - 2; k++ )); do
    i=$(( top + k ))
    line=""
    if (( k < h )); then
      if (( ! N )); then
        (( k == 0 )) && { __tt_clip "   ${dd}No palettes match '$flt'$zz" $lw; line=$REPLY }
        if (( k == 2 && hub && ${TTHEME_HUB_TABS[(Ie)browse]} )) && [[ -n $flt ]]; then
          if (( color )); then
            line="  "$ac$TTHEME_MARKS[gutter]$zz" "$pl" $TTHEME_MARKS[search] Search marketplace for '$flt' "$zz
          else
            line="  $TTHEME_MARKS[gutter] [$TTHEME_MARKS[search] Search marketplace for '$flt']"
          fi
          __tt_clip "$line" $lw
          line=$REPLY
          pvz+=("$(( hd + 2 + k )) 1 $lw tosearch")
        fi
      elif (( i <= N )); then
        __tt_pv_row $i
        line=$REPLY
        pvz+=("$(( hd + 2 + k )) 1 $lw row $i")
        case ${rtype[i]} in
          hdr) pvz+=("$(( hd + 2 + k )) 3 5 fold $i") ;;
          cat) pvz+=("$(( hd + 2 + k )) 5 7 fold $i") ;;
        esac
      fi
    elif (( k == h && N > h && top + h <= N )); then
      line="   "$dd$TTHEME_MARKS[below]" $(( N - top - h + 1 )) more"$zz
      [[ $mhov == "more 1" ]] && line="   "$TTHEME_MARKS[below]" $(( N - top - h + 1 )) more"
      pvz+=("$(( hd + 2 + k )) 1 $lw more 1")
    fi
    out+=$line$'\e[K\n'
  done
  __tt_pv_foot $se
  (( gmenu )) && __tt_pv_gdraw
  if (( split )); then
    if (( help && sw >= 48 )); then
      __tt_pv_help
    elif (( ${#reach} )); then
      __tt_label "$pick"
      __tt_pv_box 1 $(( ${#reach} + 3 < ph - 1 ? ${#reach} + 3 : ph - 1 )) "$REPLY" "$rsub"
      for (( k = 1; k <= ${#reach} && k + 2 < ph - 1; k++ )); do
        out+=$'\e['$(( k + 2 ))';'$(( sc + 2 ))'H'${reach[k]}
      done
    elif (( conf )); then
      __tt_pv_conf_panel 3 $(( sc + 2 )) $(( se - 2 ))
      __tt_tilde "$TTHEME_CONFIG"
      src=$REPLY
      __tt_pv_box 1 $(( cend < ph - 1 ? cend : ph - 1 )) Settings "$src"
    elif (( te )); then
      __tt_pv_te_head $sc $se
      __tt_pv_te_panel $sc $se 3 $(( ph - 1 ))
      __tt_pv_keys panel $teend
    elif [[ ${rtype[cur]} == thm ]]; then
      __tt_pv_te_glance ${rval[cur]} $sc $se $(( ph - 1 ))
      __tt_pv_keys list $teend
    else
      __tt_pv_keys list
      __tt_clip "${dd}Move onto a palette to see it here$zz" $(( se - sc + 1 ))
      out+=$'\e[1;'$sc'H'$REPLY
    fi
    (( help && sw < 48 )) && __tt_pv_help
  else
    if (( ${#reach} )); then
      __tt_label "$pick"
      __tt_pv_head $(( ph - 1 - ${#reach} )) 1 $se "$REPLY" "$rsub"
      for (( k = 1; k <= ${#reach}; k++ )); do
        out+=$'\e['$(( ph - 1 - ${#reach} + k ))';1H'${reach[k]}
      done
    elif (( conf )); then
      __tt_pv_head $(( ph - 3 - ${#cvars} )) 1 $lw Settings
      __tt_pv_conf_panel $(( ph - 2 - ${#cvars} )) 1 $lw
    fi
    (( help )) && __tt_pv_help
  fi
  (( osdt > 0 )) && __tt_pv_osd
  __tt_pv_flush
}

__tt_pv_markets() {
  local LC_ALL=C
  local -a rest=(${@:#ttheme})
  reply=(${(M)@:#ttheme} ${(o)rest})
}

__tt_pv_tops() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  local k s w p
  local -a by=()
  tops=() tmembers=()
  __tt_order
  if [[ $TTHEME_GROUP == marketplace ]]; then
    for k in $reply; do
      p=${k%%/*} s=${TTHEME_SUBJECT[$k]}
      [[ -n ${tmembers[$p]} ]] || by+=($p)
      tmembers[$p]+=" $k"
      if [[ -z $s ]]; then
        tmembers[$p/]+=" $k"
        continue
      fi
      for w in ${s%%/*} ${=TTHEME_ALSO[$k]}; do
        tmembers[$p/$w]+=" $k"
      done
    done
    __tt_pv_markets $by
    tops=($reply)
    return 0
  fi
  for k in $reply; do
    s=${TTHEME_SUBJECT[$k]}
    if [[ -z $s ]]; then
      w=${k%%/*}
      [[ -n ${tmembers[$w]} ]] || by+=($w)
      tmembers[$w]+=" $k"
      continue
    fi
    for w in ${s%%/*} ${=TTHEME_ALSO[$k]}; do
      tmembers[$w]+=" $k"
    done
  done
  for w in $TTHEME_WORKS; do
    [[ -n ${tmembers[$w]} ]] && tops+=($w)
  done
  tops+=($by)
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
  (( TTHEME_PALETTES_IN )) || __tt_palettes
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
  tstrip[$1]=$cell$TTHEME_SGR[/fg]
}

__tt_pv_init() {
  __tt_pv_tops
  [[ -n $orig ]] && __tt_name_of "$orig" && cn=$REPLY
  [[ -n ${TTHEME_PALETTE[$cn]} ]] || return 0
  cdot=$TTHEME_MARKS[current]
}

__tt_pv_roll() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  gseed=$RANDOM exnext=$(( SECONDS + 3 ))
  (( ${#TTHEME_ORDER} )) || return 0
  local -a pool=($TTHEME_WORKS)
  (( ${#pool} )) || pool=(${(u)TTHEME_ORDER%%/*})
  expal=${${TTHEME_ORDER[RANDOM % ${#TTHEME_ORDER} + 1]}##*/}
  extop=${pool[RANDOM % ${#pool} + 1]}
  extop=${TTHEME_WORK_NAME[$extop]:-$extop}
}

__tt_pv_size() {
  local sz=$(stty size 2>/dev/null)
  pvsized=$EPOCHREALTIME
  [[ $sz == <1->" "<1-> ]] || return 1
  [[ $sz == "$ph $pw" ]] && return 1
  ph=${sz%% *} pw=${sz##* } resized=1
  return 0
}

__tt_pv_behind() {
  local job=$1 pick=$2 done=$3 note=$4
  shift 4
  exec {pvjobfd}< <({ "$@" </dev/null 2>&1; print -rn -- $'\x1e'$? })
  pvjob=$job pvjobpick=$pick pvjobdone=$done pvjobnote=$note pvjobbuf="" pvjobat=$EPOCHREALTIME pvjobtick=0
  msg=$note msgt=300
}

__tt_pv_held() { [[ -n $pvjob && ( $pvjob == '*' || $tune == "$pvjob" ) ]] }

__tt_pv_spins() { [[ -n $pvjob && -n $bgframe && ( $pvjob == '*' || ${bgframe##* } == "$pvjobpick" ) ]] }

__tt_pv_settled() {
  local -F end=$(( EPOCHREALTIME + 3 ))
  while (( TTHEME_BG_JOB )) && kill -0 $TTHEME_BG_JOB 2>/dev/null && (( EPOCHREALTIME < end )); do
    zselect -t 1 || :
  done
  "$@"
}

__tt_pv_behind_ended() {
  local job=$pvjob done=$pvjobdone text=${pvjobbuf%$'\x1e'*}
  local -i rc=1
  exec {pvjobfd}<&-
  [[ $pvjobbuf == *$'\x1e'* ]] && rc=${pvjobbuf##*$'\x1e'}
  pvjob="" pvjobpick="" pvjobwant="" pvjobdone="" pvjobnote="" pvjobbuf="" pvjobfd=0
  text=${${text//$'\n'/ }## #}
  $done "$job" "$text" $rc
  return 0
}

__tt_pv_behind_tick() {
  [[ -n $pvjob ]] || return 1
  local chunk
  local -a ready
  local -i tick
  while zselect -a ready -t 0 -r $pvjobfd; do
    if ! sysread -i $pvjobfd chunk; then
      __tt_pv_behind_ended
      return 0
    fi
    pvjobbuf+=$chunk
  done
  [[ $msg == "$pvjobnote" ]] && msgt=300
  tick=$(( (EPOCHREALTIME - pvjobat) / 0.08 ))
  (( tick != pvjobtick )) || return 1
  pvjobtick=$tick
  if __tt_pv_spins; then
    print -rn -- $'\e[?2026h'
    __tt_pv_bg_orbit $tick
    printf '\e[%d;%dH\e[?2026l' $pvsr $pvsc
  fi
  return 1
}

__tt_pv_behind_wait() {
  local -a ready
  until [[ -z $pvjob ]] || __tt_pv_behind_tick; do
    zselect -a ready -t 8 -r $pvjobfd || :
  done
  return 0
}

__tt_pv_getch() {
  if [[ -n $pvrest ]]; then
    REPLY=$pvrest[1] pvrest=$pvrest[2,-1]
    return 0
  fi
  if (( $# )); then
    read -sk 1 -t $1 2>/dev/null
    return
  fi
  local -F t at
  local -i quick=0 step
  while :; do
    __tt_pv_behind_tick && return 1
    t=0.2
    [[ -n $pvjob ]] && t=0.08
    __tt_pv_bg_busy && t=0.05
    (( gstep )) && t=0.06
    step=$(( t * 100 + 0.5 ))
    at=$EPOCHREALTIME
    read -sk 1 -t $t 2>/dev/null && return 0
    if (( EPOCHREALTIME - at < t / 4 )); then
      (( ++quick >= 5 )) && { pvgone=1; return 1 }
    else
      quick=0
    fi
    [[ -t 0 ]] || return 1
    __tt_pv_size && return 1
    __tt_pv_bg_poll && return 1
    if (( osdt > 0 )); then
      (( osdt -= step ))
      (( osdt > 0 )) || return 1
    fi
    if (( msgt > 0 )); then
      (( msgt -= step ))
      (( msgt > 0 )) || return 1
    fi
    (( vchk )) && __tt_pv_standing && return 1
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
  [[ -z $flt && $key == ç ]] && key=altc
  [[ -z $flt && $key == © ]] && key=altg
  [[ $key == $'\n' ]] && key=down
  [[ $key == $'\v' ]] && key=up
  [[ $key == $'\e' ]] || return 0
  local seq=""
  if ! __tt_pv_getch 0.05; then
    key=esc
    return 0
  fi
  if [[ $REPLY == $'\e' ]]; then
    pvrest=$REPLY$pvrest key=esc
    return 0
  fi
  if [[ $REPLY != '[' && $REPLY != O ]]; then
    key=nop
    [[ $REPLY == c ]] && key=altc
    [[ $REPLY == g ]] && key=altg
    [[ $REPLY == u ]] && key=altu
    [[ $REPLY == [\]P_^X] ]] && __tt_pv_string
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
    "200~") __tt_pv_paste ;;
    *) key=nop ;;
  esac
}

__tt_pv_string() {
  local prev=""
  while __tt_pv_getch 0.05; do
    [[ $REPLY == $'\a' || ( $prev == $'\e' && $REPLY == \\ ) ]] && return 0
    prev=$REPLY
  done
}

__tt_pv_gulp() { sysread -t 0.5 -s 4096 REPLY 2>/dev/null }

__tt_pv_paste() {
  setopt localoptions extendedglob
  local text="" seam="" end=$'\e[201~'
  key=nop
  while __tt_pv_gulp; do
    seam+=$REPLY
    if [[ $seam == *$end* ]]; then
      pvrest=${seam#*$end} seam=${seam%%$end*}
      break
    fi
    (( ${#text} < 1024 )) && text+=${seam[1,-6]}
    seam=${seam[-5,-1]}
  done
  text+=$seam
  text=${${text[1,1024]}//[$'\r\n\t']##/ }
  __tt_pv_plain "$text"
  pasted=$REPLY
  [[ -n $pasted ]] && key=paste
  return 0
}

__tt_pv_plain() {
  REPLY=${${1//[[:cntrl:]]/}//($'\u061c'|$'\u200e'|$'\u200f'|$'\u202a'|$'\u202b'|$'\u202c'|$'\u202d'|$'\u202e'|$'\u2066'|$'\u2067'|$'\u2068'|$'\u2069')/}
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
    if (( (b & 3) == 3 )); then
      mact=move
    else
      mact=drag
      (( b & 3 )) && key=nop
    fi
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
    shift+enter) REPLY=senter ;;
    shift+tab) REPLY=stab ;;
    alt+u) REPLY=altu ;;
    alt+g) REPLY=altg ;;
    alt+c) REPLY=altc ;;
    ←) REPLY=left ;;
    →) REPLY=right ;;
    '?'|'#'|[a-zA-Z]|'='|'+') REPLY=$1 ;;
    *) REPLY="" ;;
  esac
  [[ -n $REPLY ]]
}

__tt_pv_shape() {
  local -i want=$(( ${#mhov} > 0 ))
  (( want == mhand )) && return 0
  mhand=$want
  if (( want )); then
    [[ $TERM_PROGRAM == iTerm.app ]] && printf '\e]22;hand2\e\\' || printf '\e]22;pointer\e\\'
  else
    printf '\e]22;default\e\\'
  fi
  return 0
}

__tt_pv_unhover() {
  mhrow=0 mhcol=0 mhov="" mhi=0 mhp=0
  __tt_pv_shape
}

__tt_pv_hovered() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  local REPLY now=""
  local -a f
  local -i held=0
  if (( mhrow )) && __tt_pv_spot $mhrow $mhcol; then
    f=(${=REPLY})
    now=${f[4,-1]}
    if [[ -n $mzone ]]; then
      if [[ $REPLY == "$mzone" ]]; then
        held=1
      else
        now=""
      fi
    elif (( help || ! mhlive )); then
      now=""
    elif (( gmenu )) && [[ $f[4] != (gpick|group) ]]; then
      now=""
    else
      case $f[4] in
        gbox) now="" ;;
        row|fold|more|tosearch|group|scene) __tt_pv_free || now="" ;;
        tefind) __tt_pv_bg_findable || now="" ;;
        hub) __tt_pv_free && (( f[5] != ${TTHEME_HUB_TABS[(Ie)preview]} )) || now="" ;;
        key) __tt_pv_word "$f[5]" || now="" ;;
      esac
      [[ $f[4] == row && ${rtype[$f[5]]} == rule ]] && now=""
    fi
  fi
  if [[ $now != "$mhov" ]] || (( held != mhp )); then
    mhov=$now mhp=$held mhi=0 pvquiet=0
    [[ ${now%% *} == (row|fold) ]] && mhi=${now##* }
  fi
  __tt_pv_shape
  return 0
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
    if (( gmenu )) && [[ ${${=mzone}[4]} != (gpick|gbox|group) ]]; then
      gmenu=0 mzone=""
      return 0
    fi
  fi
  z=(${=mzone})
  (( ${#z} )) || return 0
  [[ $mact == release ]] && mzone=""
  case $mact in
    press) __tt_pv_press $z ;;
    drag)
      [[ $z[4] == track ]] && __tt_pv_bg_track $z[5] $(( mcol - z[2] )) $(( z[3] - z[2] ))
      return 0
      ;;
    release)
      (( mrow == z[1] && mcol >= z[2] && mcol <= z[3] )) || return 0
      __tt_pv_release $z
      ;;
  esac
}

__tt_pv_free() {
  (( ! conf && ! te && ! help )) && [[ -z $pick && -z $tune ]]
}

__tt_pv_press() {
  [[ $4 == tereset ]] || tearm=0
  if (( ! te )) && [[ $4 == (te*|track|place|colors) ]]; then
    __tt_pv_free && [[ ${rtype[cur]} == thm ]] || return 0
    __tt_te_open ${rval[cur]}
  fi
  case $4 in
    row|fold) __tt_pv_free && [[ ${rtype[$5]} != rule ]] && cur=$5 ;;
    pick) pk=$5 ;;
    conf) cf=$5 ;;
    gpick) gm=$5 ;;
    teimg) (( tfocus == 1 )) || __tt_te_to_image ;;
    tepal) tfocus=0 ;;
    teedit) tfocus=0 tbtn=0 ;;
    tereset) tfocus=0 tbtn=1 ;;
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
  (( TTHEME_PALETTES_IN )) || __tt_palettes
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
    tosearch)
      __tt_pv_free || return 0
      __tt_pv_to_search || return 1
      ;;
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
    gpick) __tt_pv_gpick $5 ;;
    group)
      if (( gmenu )); then
        gmenu=0
      elif __tt_pv_free; then
        __tt_pv_gopen
      fi
      ;;
    scene) __tt_pv_free && scene=$(( $5 - 1 )) ;;
    tefind) __tt_te_find ;;
    teedit) __tt_te_edit ;;
    tereset) __tt_te_resetting ;;
    teapply) __tt_te_apply || return 1 ;;
    place) __tt_pv_bg_adjust at $5 ;;
    colors)
      __tt_bg_coloring $tpick
      [[ $5 == "$REPLY" ]] || __tt_pv_bg_recolor
      ;;
  esac
  return 0
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
  elif (( gmenu )); then
    __tt_pv_gstep $mwheel edge
  elif (( conf )); then
    (( cf += mwheel ))
    (( cf < 1 )) && cf=1
    (( cf > ${#cvars} )) && cf=${#cvars}
  elif (( te )); then
    key=down
    (( mwheel < 0 )) && key=up
    __tt_pv_te
    return
  elif (( sample )); then
    key=down
    (( mwheel < 0 )) && key=up
    __tt_pv_sampling
    return
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
    $'\r'|senter)
      sel=$pick picked=$pk
      return 1
      ;;
  esac
  return 0
}

__tt_pv_leave() {
  __tt_pv_behind_wait
  __tt_pv_unhover
  printf '\e[?2026h'
  __tt_pv_bg_close
  __tt_pv_unpaint
  printf '\e[?2026l'
}

__tt_pv_lost() {
  painted=? resized=1 bgdim=()
  __tt_pv_forget
}

__tt_pv_back() {
  printf '\e[?2026h\e[?25l\e[?2004h%s' "$pvmouse"
  mhand=0
  __tt_pv_unhover
  __tt_pv_lost
  if [[ -n $applied ]]; then
    __tt_pv_paint "$applied"
  else
    __tt_osc_reset
    painted=""
  fi
  __tt_pv_size
}

__tt_pv_screen() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  local err REPLY q=$2
  local -i at=${TTHEME_HUB_TABS[(Ie)preview]} n=${#TTHEME_HUB_TABS} rc
  local -i to=$(( (at - 1 + $1 + n) % n + 1 ))
  __tt_pv_leave
  while (( to != at )); do
    hubwas="$TTHEME_STARTUP ${TTHEME_PALETTE[$TTHEME_STARTUP]}"
    __tt_name_of "$orig"
    err=$(TTHEME_HUB_SEARCH=$q TTHEME_HUB=${TTHEME_HUB_TABS[to]} TTHEME_HUB_LOOK=${TTHEME_PAINTED:+$orig} TTHEME_HUB_MARK=${TTHEME_PAINTED:+$TTHEME_MARK_INKS[$REPLY]} __tt_cli ${TTHEME_HUB_TABS[to]} 2>&1 >/dev/tty)
    rc=$? q=""
    if (( rc == TTHEME_HUB_CLOSED || rc == TTHEME_HUB_UPDATE )); then
      hubleft=1
      (( rc == TTHEME_HUB_UPDATE )) && pvupdate=1
      __tt_pv_lost
      return 1
    elif (( rc > TTHEME_HUB_SWITCH && rc <= TTHEME_HUB_SWITCH + n )); then
      to=$(( rc - TTHEME_HUB_SWITCH ))
    else
      err=${${err//$'\n'/ }## #}
      msg=${err:-"${TTHEME_HUB_TITLES[to]} failed"} msgt=300
      to=$at
    fi
  done
  __tt_pv_back
  return 0
}

__tt_pv_to_search() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  local -i at=${TTHEME_HUB_TABS[(Ie)preview]} to=${TTHEME_HUB_TABS[(Ie)browse]}
  (( hub && to && ! ${#rval} )) && [[ -n $flt ]] || return 0
  __tt_pv_screen $(( to - at )) "$flt"
}

__tt_te_unsaved() {
  local img
  for img in ${(k)tsnaps}; do
    [[ "${bgsize[$img]} ${bgpos[$img]} ${bgop[$img]} ${bgoff[$img]}" == "${tsnaps[$img]}" ]] || return 0
  done
  [[ -n $tune && $tpick != "${bgview[$tune]:-$tune}" ]] && return 0
  return 1
}

__tt_te_save_image() {
  __tt_te_unsaved || return 0
  __tt_pv_tune_keep
  __tt_pv_bg_save > /dev/null 2>&1
  bgedit=() bgswap=() bgview=()
  __tt_pv_bg_reset $tename
  bgload[$tename]=""
  __tt_pv_tune_open $tename
}

__tt_te_edge() {
  local text
  local -i w=$1 col i c
  local -a line=("${(@s::)${(l:w::─:)}}")
  line[1]=${2[1]} line[w]=${2[2]}
  shift 2
  while (( $# >= 2 )); do
    col=$1 text=$2
    shift 2
    for (( i = 1; i <= ${#text}; i++ )); do
      c=$(( col + i ))
      (( c > 1 && c < w )) && line[c]=${text[i]}
    done
  done
  REPLY=${(j::)line}
}

__tt_te_boxed() {
  setopt localoptions extendedglob
  local text=$1 plain=${1//$'\e'\[[0-9;]##m/}
  local -i room=$(( $2 - 2 )) pad
  if (( ${(m)#plain} > room )); then
    __tt_clip "$text" $room
    text=$REPLY plain=${REPLY//$'\e'\[[0-9;]##m/}
  fi
  pad=$(( room - ${(m)#plain} ))
  REPLY=$d"│"$dx$text${(l:pad:: :)}$d"│"$dx
}

__tt_te_rows() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  local d=$TTHEME_SGR[dim] dx=$TTHEME_SGR[/dim] b=$TTHEME_SGR[bold] bx=$TTHEME_SGR[/bold] y=$TTHEME_SGR[warn] yx=$TTHEME_SGR[/warn] fx=$TTHEME_SGR[/fg] cell hex mark note REPLY
  local -a f=("${(@s:|:)TTHEME_TONE[$1]}") hx=(${=TTHEME_PALETTE[$1]}) names=($TTHEME_TONE_NAMES) cells=()
  local -i W=$2 i at
  (( color )) || d= dx= b= bx= y= yx= fx=
  for (( i = 1; i <= 20; i++ )); do
    cell=${f[i + 2]} mark=" "
    case ${cell[-1]} in
      x) mark=$b$TTHEME_MARKS[miss]$bx ;;
      t) mark=$y$TTHEME_MARKS[on]$yx ;;
    esac
    cell=${cell%?} hex=${hx[i]#\#}
    if (( color )) && [[ ${#hex} == 6 ]]; then
      cells+=(" "$'\e[38;2;'$((16#${hex:0:2}))';'$((16#${hex:2:2}))';'$((16#${hex:4:2}))'m'$TTHEME_MARKS[swatch]$fx" $cell$mark")
    else
      cells+=("   $cell$mark")
    fi
  done
  for note in "$f[1]" "$f[2]"; do
    [[ -n $note ]] || continue
    at=$(( W - 4 - ${(m)#note} ))
    (( at > 11 )) && break
    note=""
  done
  reply=()
  __tt_te_edge $W ╭╮ 2 " Palette " ${note:+$at} ${note:+" $note "}
  reply+=("$d$REPLY$dx")
  for (( i = 1; i <= 4; i++ )); do
    __tt_te_boxed " ${(r:10:)names[i]}${cells[i]}" $W
    reply+=("$REPLY")
  done
  __tt_te_edge $W ├┤ "${TTHEME_TONE_RULE[@]}"
  reply+=("$d$REPLY$dx")
  for (( i = 5; i <= 12; i++ )); do
    __tt_te_boxed " ${(r:10:)names[i]}${cells[i]}${cells[i + 8]}" $W
    reply+=("$REPLY")
  done
  __tt_te_edge $W ╰╯
  reply+=("$d$REPLY$dx")
}

__tt_te_open() {
  local name=$1 REPLY
  tename=$name tfocus=0 tetop=0 msgt=0 te=1 tbtn=0 tearm=0
  (( bgcw )) && __tt_pv_bg_state $name && __tt_pv_tune_open $name
  __tt_te_image && __tt_te_to_image 1
  resized=1
  return 0
}

__tt_te_close() {
  [[ -n $tune ]] && __tt_pv_untune
  te=0 tfocus=0 tename="" tetop=0 tbtn=0 tearm=0 help=0 pick="" resized=1
  return 0
}

__tt_te_saved() {
  local name=$1 REPLY
  local -a names=(${=2})
  (( ${#names} )) && __tt_bg_saved $names
  bgview=()
  __tt_pv_bg_reset $name
  bgload[$name]=""
  if (( te )) && [[ $tename == "$name" && -n $tune ]]; then
    __tt_pv_bg_reopen $name "$tpick" $tf
  fi
  return 0
}

__tt_te_save() {
  msg="Saved" msgt=200
  __tt_te_unsaved || return 0
  local name=$tename
  local -i row=$tf
  __tt_pv_tune_keep
  __tt_pv_behind $name "" __tt_te_saved "Saved" __tt_pv_bg_save_behind
  bgedit=() bgswap=()
  __tt_pv_tune_open $name
  tf=$row
  return 0
}

__tt_te_apply() {
  if __tt_te_unsaved; then
    __tt_te_save_image
    msg="Saved" msgt=200
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
  return 0
}

__tt_te_to_palette() {
  tfocus=0
}

__tt_te_to_apply() {
  tfocus=2
}

__tt_te_to_top() {
  if __tt_te_image; then
    __tt_te_to_image first
  else
    __tt_te_to_palette
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

__tt_pv_unpaint() {
  if (( pvbare )) && [[ $painted != "$orig" || $applied != "$orig" || -n $TTHEME_PAINTED ]]; then
    __tt_osc_reset
  elif [[ $painted != "$orig" ]]; then
    if [[ -z $orig ]]; then
      __tt_osc_reset
    else
      __tt_apply "$orig"
    fi
  elif [[ $applied != "$orig" ]]; then
    __tt_pv_paint "${TTHEME_PAINTED:+$orig}"
  fi
}

__tt_te_follow() {
  [[ $orig == "$1" && -n ${TTHEME_PALETTE[$2]} ]] || return 0
  orig=${TTHEME_PALETTE[$2]}
  TTHEME_SPEC=$orig
}

__tt_te_edit() {
  local name=$tename err back=$applied was=${TTHEME_PALETTE[$tename]} REPLY
  local -i rc
  __tt_te_save_image
  __tt_pv_untune
  __tt_pv_leave
  __tt_bg_hide $name
  err=$(__tt_cli tone $name edit 2>&1 >/dev/tty)
  rc=$?
  err=${${err//$'\n'/ }## #}
  if (( rc == 0 )); then
    __tt_palettes_load && __tt_reloaded
    __tt_te_follow "$was" $name
    __tt_reload
    back=${TTHEME_PALETTE[$name]:-$back}
  fi
  applied=$back
  __tt_pv_back
  if (( rc == 0 )); then
    __tt_pv_bg_reset $name
    bgload[$name]=""
    msg=${err:-"Saved"} msgt=200
  elif (( rc == 1 )); then
    __tt_label $name
    msg=${err:-"Could not tune the colors of $REPLY"} msgt=300
  fi
  __tt_pv_bg_state $name && __tt_pv_tune_open $name
  return 0
}

__tt_te_reset_job() { __tt_pv_settled __tt_cli tone $1 reset 2>&1 >/dev/null }

__tt_te_reset() {
  [[ $pvjob == "$tename" ]] && return 0
  __tt_pv_behind_wait
  local name=$tename
  __tt_te_save_image
  pvjobkeep=("${TTHEME_PALETTE[$name]}")
  tbtn=0 tearm=0
  __tt_pv_behind $name "$tpick" __tt_te_was_reset "Putting the original colors back" __tt_te_reset_job $name
}

__tt_te_was_reset() {
  local name=$1 err=$2 was=$pvjobkeep[1] shown REPLY
  local -i rc=$3
  pvjobkeep=()
  resized=1 bgdim=()
  if (( rc == 0 )); then
    __tt_name_of "$applied"
    shown=$REPLY
    __tt_palettes_load && __tt_reloaded
    __tt_te_follow "$was" $name
    __tt_reload
    if [[ $shown == "$name" && -n ${TTHEME_PALETTE[$name]} ]]; then
      __tt_pv_paint "${TTHEME_PALETTE[$name]}" && applied=${TTHEME_PALETTE[$name]}
    fi
    __tt_pv_bg_reset $name
    bgload[$name]=""
    msg=${err:-"Back to the original colors"} msgt=200
  elif (( rc == 1 )); then
    __tt_label $name
    msg=${err:-"Could not reset the colors of $REPLY"} msgt=300
  fi
  if (( te )) && [[ $tename == "$name" ]] && __tt_pv_bg_state $name; then
    __tt_pv_bg_reopen $name "$tpick" $tf
  fi
  return 0
}

__tt_te_resetting() {
  if (( tearm )); then
    __tt_te_reset
  else
    tearm=1
  fi
}

__tt_te_palette() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  local -i armed=$tearm
  tearm=0
  (( ${TTHEME_TUNED[(Ie)$tename]} )) || tbtn=0
  case $key in
    $'\r')
      if (( tbtn )); then
        tearm=$armed
        __tt_te_resetting
      else
        __tt_te_edit
      fi
      ;;
    left|right|h|l) (( ${TTHEME_TUNED[(Ie)$tename]} )) && tbtn=$(( ! tbtn )) ;;
    s) __tt_te_save ;;
    esc) (( armed )) || __tt_te_close ;;
    up|k)
      if __tt_te_image; then
        __tt_te_to_image last
      else
        __tt_te_to_apply
      fi
      ;;
    down|j|end) __tt_te_to_apply ;;
    home) __tt_te_to_top ;;
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
    h) key=left ;;
    l) key=right ;;
  esac
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
        __tt_te_to_palette
      fi
      ;;
    home) tf=5 ;;
    end) __tt_te_to_apply ;;
    $'\r') [[ -n $tune ]] || __tt_te_find ;;
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
    $'\r') __tt_te_apply; return $? ;;
    s) __tt_te_save ;;
    esc) __tt_te_close ;;
    up|k) __tt_te_to_palette ;;
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
    0) __tt_te_palette ;;
    1) __tt_pv_te_image ;;
    *) __tt_te_button ;;
  esac
  return $?
}

__tt_pv_te_head() {
  local z=$TTHEME_SGR[reset] d=$TTHEME_SGR[dim] b=$TTHEME_SGR[bold] y=$TTHEME_SGR[warn] line REPLY
  local -i col=$1 end=$2 room=$(( $2 - $1 + 1 ))
  (( color )) || z= d= b= y=
  __tt_te_unsaved && (( room -= 11 ))
  __tt_label $tename
  line=$b$ac$TTHEME_MARKS[current]$z" "$b$REPLY$z
  __tt_work_of $tename
  [[ -n $REPLY ]] && line+="  "$d$REPLY$z
  __tt_clip "$line" $room
  out+=$'\e[1;'$col'H'$REPLY$z
  __tt_te_unsaved && out+=$'\e[1;'$(( end - 8 ))'H'$y$TTHEME_MARKS[on]$z" "$d"unsaved"$z
  return 0
}

__tt_pv_te_tile() {
  local z=$TTHEME_SGR[reset] d=$TTHEME_SGR[dim] b=$TTHEME_SGR[bold] sty top side bot
  local -i y=$1 col=$2 r tc=10 over=0
  (( color )) || z= d= b=
  (( color )) && [[ $mhov == tefind ]] && over=1
  if (( tfocus == 1 && tf == 5 || over && mhp )); then
    sty=$b$ac top="┏${(l:tc::━:)}┓" side="┃" bot="┗${(l:tc::━:)}┛"
  elif (( over )); then
    sty=$b$ac top="╭${(l:tc::─:)}╮" side="│" bot="╰${(l:tc::─:)}╯"
  else
    sty=$d top="╭${(l:tc::─:)}╮" side="│" bot="╰${(l:tc::─:)}╯"
  fi
  out+=$'\e['$y';'$col'H'$sty$top$z
  for (( r = 1; r <= 3; r++ )); do
    out+=$'\e['$(( y + r ))';'$col'H'$sty$side${(l:tc::░:)}$side$z
  done
  out+=$'\e['$(( y + 4 ))';'$col'H'$sty$bot$z$'\e['$(( y + 2 ))';'$(( col + tc + 4 ))'H'
  __tt_cap enter
  if (( over && mhp )); then
    out+=$pl"$REPLY finds one"$TTHEME_SGR[/pill]
  elif (( over )); then
    out+=$TTHEME_SGR[chip]"$REPLY finds one"$TTHEME_SGR[/chip]
  elif (( tfocus == 1 && tf == 5 )); then
    out+=$b$REPLY$z$d" finds one"$z
  else
    out+=$d"$REPLY finds one"$z
  fi
  return 0
}

__tt_pv_te_ghost() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  local z=$TTHEME_SGR[reset] d=$TTHEME_SGR[dim]
  local -a labs=($TTHEME_PANEL_LABELS) at=($TTHEME_PANEL_ROWS)
  local -i r0=$1 col=$2 T=$(( $3 - $2 - TTHEME_PANEL[spare] )) v=$(( $2 + TTHEME_PANEL[value] )) i
  (( color )) || z= d=
  (( T < TTHEME_PANEL[least] )) && T=$TTHEME_PANEL[least]
  out+=$'\e['$(( r0 + at[4] ))';'$col'H  '$d$labs[4]$'\e['$(( r0 + at[4] ))';'$v'H'" $TTHEME_PANEL_COLORINGS[2]  $TTHEME_PANEL_COLORINGS[4] "$z
  out+=$'\e['$(( r0 + at[1] ))';'$col'H  '$d$labs[1]$'\e['$(( r0 + at[1] ))';'$v'H'${(l:T::─:)}$z
  for (( i = 1; i <= 9; i++ )); do
    out+=$'\e['$(( r0 + at[2] - 1 + (i - 1) / 3 ))';'$(( v + (i - 1) % 3 * 3 ))'H'$d$TTHEME_MARKS[spot]$z
  done
  out+=$'\e['$(( r0 + at[2] ))';'$col'H  '$d$labs[2]$z
  out+=$'\e['$(( r0 + at[3] ))';'$col'H  '$d$labs[3]$'\e['$(( r0 + at[3] ))';'$v'H'${(l:T::─:)}$z
  return 0
}

__tt_pv_te_edge() {
  local left=$4 right=$5 sty=$6 hs=$7 head=$8 tail=$9 z=$TTHEME_SGR[reset] line
  local -i y=$1 col=$2 w=$3 n
  (( color )) || z=
  n=$(( w - 3 - (${#head} ? ${(m)#head} + 2 : 0) - (${#tail} ? ${(m)#tail} + 3 : 0) ))
  (( n < 0 )) && n=0
  line=$sty$left"─"$z
  [[ -n $head ]] && line+=$hs" $head "$z
  line+=$sty${(l:n::─:)}
  [[ -n $tail ]] && line+=" $tail ─"
  out+=$'\e['$y';'$col'H'$line$right$z
}

__tt_pv_te_sides() {
  local sty=$5 z=$TTHEME_SGR[reset]
  local -i y r1=$2 col=$3 w=$4
  (( color )) || z=
  for (( y = $1; y <= r1; y++ )); do
    out+=$'\e['$y';'$col'H'$sty"│"$z$'\e['$y';'$(( col + w - 1 ))'H'$sty"│"$z
  done
}

__tt_pv_box() {
  local d=$TTHEME_SGR[dim] title=$3 tail=$4
  (( ${(m)#title} + ${(m)#tail} + 8 > sw )) && tail=""
  if (( ${(m)#title} + 5 > sw )); then
    while [[ -n $title ]] && (( ${(m)#title} + 6 > sw )); do title=${title[1,-2]}; done
    title+=…
  fi
  __tt_pv_te_edge $1 $sc $sw ╭ ╮ "$d" "$TTHEME_SGR[bold]$gc" "$title" "$tail"
  __tt_pv_te_sides $(( $1 + 1 )) $(( $2 - 1 )) $sc $sw "$d"
  __tt_pv_te_edge $2 $sc $sw ╰ ╯ "$d"
}

__tt_pv_te_images() {
  local z=$TTHEME_SGR[reset] d=$TTHEME_SGR[dim] b=$TTHEME_SGR[bold] st="  " tt note="0/0"
  local -a held
  local -i y=$1 col=$2 end=$3 n
  (( color )) || z= d= b=
  tt=$d
  if [[ -n $tune ]]; then
    held=(${=bgpics[$tune]})
    n=${held[(Ie)${${tpick#$tune}#:}]}
    (( n )) || n=${held[(Ie)${bgact[$tune]}]}
    (( n )) || n=1
    note="$n/$(( ${#held} ? ${#held} : 1 ))"
  fi
  (( tfocus == 1 && tf == 5 )) && st=$ac$TTHEME_MARKS[focus]$z" " tt=$b
  out+=$'\e['$y';'$col'H'$st$tt"Pictures"$z$'\e['$y';'$(( end - ${#note} + 1 ))'H'$d$note$z
  pvz+=("$y $col $end teimg")
}

__tt_pv_te_button() {
  local spot=teedit
  (( $1 )) && spot=tereset
  if (( tfocus == 0 && tbtn == $1 )); then
    (( color )) && out+=$ac$TTHEME_MARKS[focus]$z" "$pl" $2 "$z || out+="$TTHEME_MARKS[focus] [$2]"
  elif (( color )) && [[ $mhov == "$spot" ]]; then
    out+="  "$TTHEME_SGR[chip]" $2 "$TTHEME_SGR[/chip]
  else
    (( color )) && out+="  "$b" $2 "$z || out+="   $2 "
  fi
}

__tt_pv_te_editrow() {
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  local z=$TTHEME_SGR[reset] d=$TTHEME_SGR[dim] b=$TTHEME_SGR[bold] note="changes its colors full screen"
  local -i y=$1 col=$2 end=$3 x=$(( $2 + 2 ))
  local reset="Reset palette"
  (( color )) || z= d= b=
  out+=$'\e['$y';'$x'H'
  __tt_pv_te_button 0 "Edit palette"
  pvz+=("$y $col $(( x + 15 )) teedit")
  x+=16
  if (( ${TTHEME_TUNED[(Ie)$tename]} )); then
    out+="  "
    (( tearm )) && { __tt_capped "Reset? enter again"; reset=$REPLY }
    __tt_pv_te_button 1 "$reset"
    pvz+=("$y $(( x + 2 )) $(( x + ${#reset} + 5 )) tereset")
    x+=$(( ${#reset} + 6 ))
    (( tfocus == 0 && tbtn )) && note="back to its own colors"
    (( tearm )) && note="drops your tuning"
  fi
  (( ${#note} <= end - x - 3 )) && out+="  "$d$note$z
}

__tt_pv_te_panel() {
  local z=$TTHEME_SGR[reset] d=$TTHEME_SGR[dim] b=$TTHEME_SGR[bold] dx=$TTHEME_SGR[/dim] bx=$TTHEME_SGR[/bold] ax=$TTHEME_SGR[/accent] fs hs st note row REPLY
  local -i col=$1 end=$2 r0=$3 r1=$4 ix=$(( $1 + 2 )) ie=$(( $2 - 2 )) R W T P I=3 V i y pics=0 tfs=$tf
  local -a frame
  (( color )) || z= d= b=
  R=$(( r1 - r0 + 1 )) W=$(( end - col + 1 ))
  __tt_te_rows $tename $W
  frame=("${reply[@]}")
  T=${#frame} P=$(( T + 2 ))
  __tt_te_image && pics=1
  (( pics && 19 <= R && (tfocus == 1 || 19 + P + 1 <= R) )) && I=19
  V=$(( I + P + 1 ))
  teend=$(( r0 + V ))
  if (( V <= R || tfocus == 1 || tfocus < 0 )); then
    tetop=0
  else
    tetop=$(( V - R ))
  fi
  fs=$d hs=$d
  (( tfocus == 1 )) && fs=$ac hs=$b$ac
  (( tfocus != 1 && color )) && [[ $mhov == teimg ]] && fs="" hs=$b
  if (( tetop == 0 && I <= R )); then
    y=$r0
    st=""
    [[ -n $tune ]] && { (( bgoff[$tpick] )) && st=off || st=on }
    __tt_pv_te_edge $y $col $W ╭ ╮ "$fs" "$hs" Picture "$st"
    __tt_pv_te_sides $(( y + 1 )) $(( y + I - 2 )) $col $W "$fs"
    __tt_pv_te_edge $(( y + I - 1 )) $col $W ╰ ╯ "$fs"
    if (( pics )); then
      for (( i = 0; i < I; i++ )); do
        pvz+=("$(( y + i )) $col $end teimg")
      done
    fi
    if (( I == 19 )); then
      if [[ -n $tune ]]; then
        __tt_pv_bg_credit $(( ie - ix + 1 ))
        [[ -n $REPLY ]] && out+=$'\e['$(( y + 1 ))';'$ix'H'$d$REPLY$z
        __tt_pv_bg_profiles $(( ie - ix + 1 ))
        [[ -n $REPLY ]] && out+=$'\e['$(( y + 2 ))';'$ix'H'$d$REPLY$z
      fi
      __tt_pv_te_images $(( y + 3 )) $ix $ie
      if [[ -n $tune ]]; then
        bgstrip="$(( y + 3 )) $ix $ie $tune $tpick"
        (( tfocus == 1 )) || tf=0
        __tt_pv_bg_panel $tpick $(( y + 10 )) $ix $ie
        tf=$tfs
      else
        __tt_pv_te_tile $(( y + 4 )) $ix
        for (( i = 4; i <= 8; i++ )); do
          pvz+=("$(( y + i )) $ix $(( ix + 30 )) tefind")
        done
        __tt_pv_te_ghost $(( y + 10 )) $ix $ie
      fi
    elif (( pics )); then
      __tt_pv_te_images $(( y + 1 )) $ix $ie
    elif (( bgcw )); then
      out+=$'\e['$(( y + 1 ))';'$ix'H'$d"No picture yet"$z
    else
      out+=$'\e['$(( y + 1 ))';'$ix'H'$d"This terminal shows no pictures"$z
    fi
  fi
  fs=$d
  (( tfocus == 0 )) && fs=$ac
  (( tfocus != 0 && color )) && [[ $mhov == tepal ]] && fs=""
  for (( i = 1; i <= P; i++ )); do
    y=$(( r0 + I + i - 1 - tetop ))
    (( y >= r0 && y <= r1 )) || continue
    if (( i == T )); then
      __tt_pv_te_edge $y $col $W ├ ┤ "$fs"
    elif (( i == T + 1 )); then
      __tt_pv_te_sides $y $y $col $W "$fs"
      __tt_pv_te_editrow $y $col $end
    else
      row=${frame[i == P ? T : i]}
      if (( tfocus == 0 && color )); then
        row=${${row//$d/$ac}//$dx/$bx$ax}
        (( i == 1 )) && row=${row/ Palette /$b" Palette "$bx}
      elif (( color )) && [[ $mhov == tepal ]]; then
        row=${row//$d/}
      fi
      out+=$'\e['$y';'$col'H'$row$z
      pvz+=("$y $col $end tepal")
    fi
  done
  y=$(( r0 + I + P - tetop ))
  (( y >= r0 && y <= r1 )) || return 0
  pvz+=("$y $col $end teapply")
  if [[ $mode == pin ]]; then
    note="saves, then asks how far it reaches"
  elif (( canpick )); then
    note="saves, then asks where"
  else
    note="saves and uses it in this tab"
  fi
  out+=$'\e['$y';'$ix'H'
  if (( tfocus == 2 )); then
    (( color )) && out+=$ac$TTHEME_MARKS[focus]$z" "$pl" Apply "$z || out+="$TTHEME_MARKS[focus] [Apply]"
  elif (( color )) && [[ $mhov == teapply ]]; then
    out+="  "$TTHEME_SGR[chip]" Apply "$TTHEME_SGR[/chip]
  else
    (( color )) && out+="  "$b" Apply "$z || out+="   Apply "
  fi
  (( ${#note} <= end - ix - 10 )) && out+="  "$d$note$z
  return 0
}

__tt_pv_te_draw() {
  local -i i end=$(( pw - 1 < 66 ? pw - 1 : 66 ))
  for (( i = 1; i < ph; i++ )); do
    out+=$'\e['$i$';1H\e[K'
  done
  __tt_pv_te_head 2 $end
  __tt_pv_te_panel 2 $end 3 $(( ph - 1 ))
  reach=()
  if [[ -n $pick && $mode == pin ]]; then
    __tt_pv_reach $se $(( ph - 13 ))
    if (( ${#reach} )); then
      __tt_label "$pick"
      __tt_pv_head $(( ph - 1 - ${#reach} )) 1 $se "$REPLY" "$rsub"
      for (( i = 1; i <= ${#reach}; i++ )); do
        out+=$'\e['$(( ph - 1 - ${#reach} + i ))$';1H\e[K'${reach[i]}
      done
    fi
  fi
  (( help )) && __tt_pv_help
  out+=$'\e['$ph';1H'
  __tt_pv_foot $se
  (( osdt > 0 )) && __tt_pv_osd
  __tt_pv_flush
}

__tt_pv_te_glance() {
  local tename=$1 tune="" tpick="" REPLY
  local -i tfocus=-1 tbtn=0 tearm=0 tetop=0 tf=0
  local -A tsnaps=()
  if __tt_pv_bg_state $1; then
    __tt_pv_shows $1
    tpick=$REPLY tune=$1
    __tt_bg_load $tpick
  fi
  __tt_pv_te_head $2 $3
  __tt_pv_te_panel $2 $3 3 $4
}

__tt_pv_whole() {
  local wk="" title="Terminal colors" REPLY
  local -i i sc=1 sw=$(( pw - 1 )) sbot=$(( ph - 1 )) sfit=$(( ph - 1 )) split=0
  for (( i = 1; i < ph; i++ )); do
    out+=$'\e['$i$';1H\e[K'
  done
  __tt_pv_sample
  if [[ -n $an ]]; then
    __tt_work_of $an
    wk=$REPLY
    __tt_label $an
    title=$REPLY
  fi
  __tt_pv_box 1 $(( ph - 1 )) "$title" "$wk"
  (( help )) && __tt_pv_help
  out+=$'\e['$ph';1H'
  __tt_pv_foot $se
  (( osdt > 0 )) && __tt_pv_osd
  __tt_pv_flush
}

__tt_pv_sampling() {
  local -i i k n=${#rval} step=1
  case $key in
    $'\x03') return 1 ;;
    esc|$'\t') sample=0 ;;
    '?') help=1 ;;
    sleft) scene=$(( scene - 1 )) ;;
    sright) scene=$(( scene + 1 )) ;;
    up|down)
      [[ $key == up ]] && step=-1
      for (( i = 1; i < n; i++ )); do
        k=$(( ((cur - 1 + step * i) % n + n) % n + 1 ))
        if [[ ${rtype[k]} == thm ]]; then
          cur=$k
          break
        fi
      done
      ;;
    $'\r'|senter)
      sample=0
      __tt_pv_handle
      return
      ;;
  esac
  return 0
}

__tt_pv_handle() {
  local name
  if [[ $key == mouse && $mact == move ]]; then
    mhrow=$mrow mhcol=$mcol mhlive=1
    __tt_pv_hovered
    return 0
  fi
  pvquiet=0
  if [[ $key == mouse ]]; then
    mhrow=$mrow mhcol=$mcol
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
  if (( sample )); then
    __tt_pv_sampling
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
  if (( gmenu )); then
    __tt_pv_gmenu
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
    $'\r'|senter)
      if (( ! ${#rval} )); then
        __tt_pv_to_search || return 1
      elif [[ ${rtype[cur]} == thm ]]; then
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
        cur=$(( cur - ph + pvhd + 3 ))
        (( cur < 1 )) && cur=1
        [[ ${rtype[cur]} == rule ]] && cur=$(( cur - 1 ))
      fi
      ;;
    pgdn)
      if (( cur >= ${#rval} )); then
        cur=1
      else
        cur=$(( cur + ph - pvhd - 3 ))
        (( cur > ${#rval} )) && cur=${#rval}
        [[ ${rtype[cur]} == rule ]] && cur=$(( cur + 1 ))
      fi
      ;;
    ' ') [[ ${rtype[cur]} == (hdr|cat) ]] && __tt_pv_toggle ;;
    $'\t')
      if [[ ${rtype[cur]} == thm ]]; then
        sample=1
      elif (( hub )); then
        __tt_pv_screen 1 || return 1
      fi
      ;;
    stab) (( hub )) && { __tt_pv_screen -1 || return 1 } ;;
    altu) [[ -z $pick ]] && (( hub && vnew )) && { pvupdate=1; return 1 } ;;
    altg) __tt_pv_gopen ;;
    altc)
      conf=1 cf=1 csnap=()
      for name in $cvars; do
        csnap+=("${(P)name}")
      done
      ;;
    '?') help=1 ;;
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
      __tt_pv_plain "$key"
      [[ -n $REPLY ]] || return 0
      __tt_pv_lw
      (( ${(m)#flt} + ${(m)#key} > reply[1] - 12 )) && return 0
      name=""
      [[ ${rtype[cur]} == thm ]] && name=${rval[cur]}
      flt+=${(L)key}
      __tt_pv_rows
      __tt_pv_first "$name"
      ;;
    paste)
      __tt_pv_lw
      name=""
      [[ ${rtype[cur]} == thm ]] && name=${rval[cur]}
      flt+=${(L)pasted}
      while [[ -n $flt ]] && (( ${(m)#flt} > reply[1] - 12 )); do flt=${flt[1,-2]}; done
      __tt_pv_rows
      __tt_pv_first "$name"
      ;;
  esac
  return 0
}

__tt_preview() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  (( TTHEME_PALETTES_IN )) || __tt_palettes
  zmodload -F zsh/datetime p:EPOCHREALTIME 2>/dev/null
  zmodload -F zsh/zselect b:zselect 2>/dev/null
  [[ $functions[TRAPURG] == *__tt_woken* ]] && trap '' URG
  local mode=$1 pdir=${2:-$PWD} hubwas=""
  local -i hub=0 hubleft=0 vchk=0 vwarn=0 vnew=0 pvupdate=0
  local vline=""
  [[ $mode == hub ]] && hub=1
  if [[ ! -t 0 || ! -t 1 ]]; then
    print -u2 "ttheme $mode: needs a terminal"
    return 1
  fi
  local orig=$TTHEME_SPEC applied=$TTHEME_SPEC painted=$TTHEME_SPEC pvbare=$(( ! ${#TTHEME_PAINTED} )) flt="" sel="" cn="" cdot="" key="" REPLY="" cur=1 top=1 color=0 pw=80 ph=24 resized=1 expal="" extop="" exnext=0 gstep=0 gseed=0 tick=0 pvhd=2 pvsr=1 pvsc=4
  local pick="" pk=1 pkdef=1 picked=0 canpick=0 bgcw=0 bgch=0 bgname="" bgshown="" bginc="" osd="" osdt=0
  local tune="" tpick="" tf=1 help=0 msg="" msgt=0 an="" bgrel=0 bgmx=0 bgmy=0 bgpad="" bganchor=0 bgcut="" bgnext=0 bgbytes=0 bgstrip="" bgframe="" pvjob="" pvjobpick="" pvjobwant="" pvjobdone="" pvjobnote="" pvjobbuf="" pvscene="" pvscenes="" pvsfit=0
  local -i scene=0 pvjobfd=0 pvjobtick=0
  local -F pvjobat=0
  local -a bgorder=() pvjobkeep=()
  local -A bgfrom=() bgurl=() bgby=() bgsent=() bgcost=() bgdim=() bgsrc=() bgfill=() bgfocus=() bgsize=() bgpos=() bgop=() bgdef=() bgoff=() bgbase=() bgload=() bgshot=() bgshotkey=() bgedit=() bgtunef=() bgofff=() bgimages=()
  local -A bgpic=() bgpics=() bgact=() bgview=() bgswap=() bgthumb=() tsnaps=() pvseek=() bgcolors=() bgcred=() bgpage=() bgprof=()
  local conf=0 cf=1
  local -i gmenu=0 gm=1
  local -a gitems=(TTHEME_GROUP:work TTHEME_GROUP:marketplace TTHEME_SORT:abc TTHEME_SORT:cast)
  local -A gshow=(abc A-Z cast "Cast order")
  local -a plabel=(" Default " " This tab ") pkeys=() reach=() csnap=()
  local te=0 tfocus=0 tetop=0 tbtn=0 tearm=0 tename="" sample=0
  local -i pvgone=0 mrow=0 mcol=0 mclick=0 mwheel=0 mlwheel=0 mlrow=0 mlcol=0
  local -F mlast=0 pvsized=0
  local mact="" mzone="" pvmouse="" pasted="" pvrest="" mhov=""
  local -i mhrow=0 mhcol=0 mhi=0 mhp=0 mhand=0 mhlive=0 pvquiet=0 pvagain=0
  local -a pvz=()
  local -a cvars=(TTHEME_MODE TTHEME_TAB_PALETTE TTHEME_ANNOUNCE TTHEME_FX TTHEME_MOUSE TTHEME_HELP_BOX TTHEME_BG_BLUR TTHEME_BG_COLORS TTHEME_BG_STICKER) clabel=(Mode "New tabs" Announce "Search fx" Mouse Help Blur Pictures Sticker)
  local -a cchoice=("${(j: :)TTHEME_MODE_SETTINGS}" "off seq" "1 0" "typewriter decode glitch" "on off" "on off" "0 1 2 3 4" "original tone" "on off") cshow=("${(j: :)TTHEME_MODE_SETTINGS}" "off seq" "on off" "typewriter decode glitch" "on off" "on off" "off 1px 2px 3px 4px" "original tinted" "on off")
  local -A cnote=(
    TTHEME_MODE:auto "Every palette in the system's mode, following it as it changes"
    TTHEME_MODE:light "Every palette in its light mode" TTHEME_MODE:dark "Every palette in its dark mode"
    TTHEME_TAB_PALETTE:seq "New tabs rotate through palettes" TTHEME_TAB_PALETTE:off "New tabs keep the terminal theme"
    TTHEME_ANNOUNCE:1 "Shows the palette notice" TTHEME_ANNOUNCE:0 "Silences the palette notice"
    TTHEME_FX:typewriter "The search hint types itself" TTHEME_FX:decode "The search hint decodes" TTHEME_FX:glitch "The search hint glitches in"
    TTHEME_MOUSE:on "The pointer, clicks, the wheel and drags work in ttheme's screens" TTHEME_MOUSE:off "The terminal keeps the mouse, so a drag selects text"
    TTHEME_HELP_BOX:on "The keys no bar names stay on screen" TTHEME_HELP_BOX:off "Those keys show only behind ?"
    TTHEME_BG_BLUR:0 "Pictures stay sharp" TTHEME_BG_BLUR:1 "Pictures soften a little behind the text"
    TTHEME_BG_BLUR:2 "Pictures soften behind the text" TTHEME_BG_BLUR:3 "Pictures blur behind the text"
    TTHEME_BG_BLUR:4 "Pictures blur well behind the text"
    TTHEME_BG_STICKER:on "Pictures that stand alone get a white edge, like a sticker"
    TTHEME_BG_STICKER:off "Pictures keep the edge they were cut with"
    TTHEME_BG_COLORS:original "New pictures keep their own colors"
    TTHEME_BG_COLORS:tone "New pictures are tinted in the palette's color"
  )
  [[ $mode == pin ]] && __tt_pin_scopes "$pdir"
  __tt_pv_canpick
  __tt_pv_size
  local -a tops=() rtype=() rval=() rcnt=() rtop=() reply=()
  local -A tmembers=() exp=() tstrip=()
  __tt_color && color=1
  __tt_pv_init
  __tt_pv_roll
  __tt_pv_rows
  [[ -n ${TTHEME_PALETTE[$cn]} ]] && __tt_pv_goto "$cn"
  if (( hub )); then
    __tt_release hub
    __tt_pv_standing
  fi
  local tty=""
  local -i TTHEME_RAW=0
  {
    tty=$(stty -g 2>/dev/null) && stty -echo -icanon -icrnl -ixon min 1 time 0 2>/dev/null || tty=""
    TTHEME_RAW=$(( ${#tty} > 0 ))
    __tt_pv_bg_open
    printf '\e[?2026h\e[?1049h\e[?7l\e[?25l\e[?2004h'
    __tt_pv_pointer
    while :; do
      (( EPOCHREALTIME - pvsized < 0.2 )) || __tt_pv_size
      (( mhrow )) && __tt_pv_hovered
      printf '\e[?2026h'
      if (( tick && ! te )); then
        __tt_pv_draw hint
      else
        __tt_pv_focus
        __tt_pv_draw
      fi
      tick=0 mlwheel=0 pvquiet=1
      (( mhrow )) && __tt_pv_hovered
      if (( ! pvquiet && ! pvagain )); then
        pvagain=1
        continue
      fi
      pvagain=0 pvquiet=1
      while (( pvquiet )); do
        if ! __tt_pv_read; then
          (( pvgone )) && break 2
          [[ -t 0 ]] && continue 2
          break 2
        fi
        while :; do
          [[ $key == (mouse|nop) ]] || __tt_pv_unhover
          __tt_pv_handle || break 3
          __tt_pv_read drain || break
        done
      done
    done
  } always {
    __tt_pv_behind_wait
    local spec=${sel:+${TTHEME_PALETTE[$sel]}}
    [[ -n $spec && $mode != pin ]] && (( ! ${#bgedit} && ! ${#bgswap} )) && __tt_pv_claim "$sel"
    printf '\e[?2026h'
    __tt_pv_bg_close
    if [[ -n $spec ]]; then
      if (( pvbare && picked == 1 )) && [[ $mode != pin && $spec == "${TTHEME_PALETTE[$TTHEME_STARTUP]}" ]]; then
        [[ $painted == "$spec" && $applied == "$spec" && -z $TTHEME_PAINTED ]] || __tt_osc_reset
      else
        [[ $spec == "$painted" ]] && { [[ -n $TTHEME_PAINTED || $mode == pin ]] || (( picked == 1 )) } || __tt_apply "$spec"
      fi
    else
      __tt_pv_unpaint
    fi
    (( conf )) && __tt_pv_unconf
    local pointed=$pvmouse
    __tt_pv_pointer off
    printf '\e[?2004l\e[?7h'
    (( hubleft )) || printf '\e[?1049l'
    printf '\e[?25h\e[?2026l'
    [[ -n $pointed ]] && __tt_ask ""
    [[ -n $tty ]] && stty "$tty" 2>/dev/null
    TTHEME_RAW=0
    [[ -n $tune ]] && __tt_pv_untune
    __tt_pv_bg_save
    if [[ -n $spec ]]; then
      TTHEME_SPEC=$spec
      if [[ $mode == pin ]]; then
        __tt_pin_save "$sel" "${pkeys[picked]}" "$orig" $pvbare
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
    (( hubleft )) && __tt_installs_done "$hubwas"
  }
  (( pvupdate )) && { __tt_installs update; return }
  return 0
}
