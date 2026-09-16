typeset -g TTHEME_HOME=${${(%):-%x}:A:h}

if [[ -r $TTHEME_HOME/palettes.zsh ]]; then
  source $TTHEME_HOME/palettes.zsh
elif [[ -r $TTHEME_HOME/../dist/shell/palettes.zsh ]]; then
  source $TTHEME_HOME/../dist/shell/palettes.zsh
else
  print -u2 "ttheme: palettes.zsh not found — run \`mise run build\` in the repo"
  return 1
fi

typeset -g TTHEME_CONFIG=${XDG_CONFIG_HOME:-$HOME/.config}/ttheme/config.zsh

[[ -r $TTHEME_CONFIG ]] && source $TTHEME_CONFIG

typeset -g TTHEME_PINS_FILE=${TTHEME_CONFIG:h}/pins
typeset -g TTHEME_PINS_RAW=""
typeset -gA TTHEME_PINS=()
typeset -g TTHEME_PIN="" TTHEME_PIN_SPEC="" TTHEME_BASE_SPEC=""

__tt_tilde() { REPLY=${1/#$HOME\//\~/} }

__tt_pins_load() {
  setopt localoptions extendedglob
  local raw="" line key name
  [[ -r $TTHEME_PINS_FILE ]] && raw="$(<$TTHEME_PINS_FILE)"
  [[ $raw == "$TTHEME_PINS_RAW" ]] && return 0
  TTHEME_PINS_RAW=$raw
  TTHEME_PINS=()
  for line in "${(@f)raw}"; do
    line=${line%%[[:space:]]##}
    [[ $line == [~/]*[[:space:]]* ]] || continue
    name=${line##*[[:space:]]} key=${${line%[[:space:]]*}%%[[:space:]]##}
    TTHEME_PINS[${key/#\~\//$HOME/}]=$name
    [[ -n ${TTHEME_PALETTE[$name]} ]] || print -u2 "ttheme: unknown palette '$name' pinned to $key"
  done
}

__tt_pins_load

: ${TTHEME_TAB_PALETTE:=seq}

: ${TTHEME_ANNOUNCE:=1}

: ${TTHEME_FX:=typewriter}

: ${TTHEME_SORT:=abc}

typeset -g TTHEME_STATE_DIR=${XDG_STATE_HOME:-$HOME/.local/state}/ttheme

if [[ -n $GHOSTTY_RESOURCES_DIR || $TERM_PROGRAM == ghostty ]]; then
  typeset -g TTHEME_ADAPTER=ghostty
elif [[ -n $KITTY_WINDOW_ID ]]; then
  typeset -g TTHEME_ADAPTER=kitty
elif [[ -n $WEZTERM_PANE ]]; then
  typeset -g TTHEME_ADAPTER=wezterm
elif [[ -n $ALACRITTY_WINDOW_ID ]]; then
  typeset -g TTHEME_ADAPTER=alacritty
elif [[ -n $ITERM_SESSION_ID || $TERM_PROGRAM == iTerm.app ]]; then
  typeset -g TTHEME_ADAPTER=iterm2
elif [[ $TERM == foot* ]]; then
  typeset -g TTHEME_ADAPTER=foot
else
  typeset -g TTHEME_ADAPTER=unknown
fi

source $TTHEME_HOME/adapters/_osc.zsh
[[ -r $TTHEME_HOME/adapters/$TTHEME_ADAPTER.zsh ]] &&
  source $TTHEME_HOME/adapters/$TTHEME_ADAPTER.zsh

__tt_active() {
  [[ -o interactive ]] || return 1
  [[ $TTHEME_ADAPTER != unknown || -n $TTHEME_FORCE ]]
}

__tt_spec() {
  local spec=${TTHEME_PALETTE[$1]}
  [[ -n $spec ]] || return 1
  print -r -- "$spec"
}

__tt_name_of() { REPLY=${${(k)TTHEME_PALETTE[(re)$1]}:-custom} }

__tt_color() { [[ -t 1 && -z $NO_COLOR ]] }

__tt_palette_line() {
  local name=$1 marker=$2
  local -a p=(${=TTHEME_PALETTE[$name]})
  (( ${#p} >= 20 )) || return 1
  local bg=${p[1]#\#} cur=${p[3]#\#}
  printf '%s\033[48;2;%d;%d;%d;38;2;%d;%d;%dm ● \033[0m %-8s \033[2m· ANSI %s\033[0m\n' \
    "$marker" \
    $((16#${bg:0:2})) $((16#${bg:2:2})) $((16#${bg:4:2})) \
    $((16#${cur:0:2})) $((16#${cur:2:2})) $((16#${cur:4:2})) \
    "$name" "${TTHEME_SRC[$name]:-unknown}"
}

__tt_announce() {
  (( TTHEME_ANNOUNCE )) || return 0
  local -a p=(${=TTHEME_SPEC})
  (( ${#p} >= 20 )) || return 0
  local REPLY
  __tt_name_of "$TTHEME_SPEC"
  [[ -n ${TTHEME_PALETTE[$REPLY]} ]] || return 0
  local name=$REPLY
  local grp=${TTHEME_GROUP[$name]:-Other} src=${TTHEME_SRC[$name]:-unknown}
  if ! __tt_color; then
    print -r -- "$name · $grp · ANSI $src"
    return 0
  fi
  local cur=${p[3]#\#} sel=${p[4]#\#}
  printf '\033[48;2;%d;%d;%dm %s \033[0m\n\033[7;1;38;2;%d;%d;%dm %s \033[0m \033[2m· ANSI %s\033[0m\n' \
    $((16#${sel:0:2})) $((16#${sel:2:2})) $((16#${sel:4:2})) "$grp" \
    $((16#${cur:0:2})) $((16#${cur:2:2})) $((16#${cur:4:2})) "$name" "$src"
}

__tt_dir_rule() {
  local k base best="" bestlen=-1 p=${1:A}
  for k in ${(k)TTHEME_PINS}; do
    [[ -n ${TTHEME_PALETTE[$TTHEME_PINS[$k]]} ]] || continue
    base=${${k%/\*\*}:A}
    if [[ $k == *"/**" ]]; then
      [[ $p == "$base" || $p == "$base"/* ]] || continue
    else
      [[ $p == "$base" ]] || continue
    fi
    (( ${#base} > bestlen )) && { best=$k; bestlen=${#base} }
  done
  [[ -n $best ]] || return 1
  REPLY=$best
}

__tt_dir_sync() {
  local REPLY="" spec=""
  __tt_dir_rule "$PWD" || REPLY=""
  [[ $REPLY == "$TTHEME_PIN" ]] && return 0
  if [[ -n $REPLY ]]; then
    [[ -n $TTHEME_PIN ]] || TTHEME_BASE_SPEC=$TTHEME_SPEC
    spec=${TTHEME_PALETTE[$TTHEME_PINS[$REPLY]]}
  elif [[ $TTHEME_SPEC == "$TTHEME_PIN_SPEC" ]]; then
    spec=$TTHEME_BASE_SPEC
  fi
  TTHEME_PIN=$REPLY TTHEME_PIN_SPEC=$spec
  [[ -n $spec && $spec != "$TTHEME_SPEC" ]] || return 0
  __tt_apply "$spec"
  TTHEME_SPEC=$spec
}

__tt_chpwd() {
  __tt_pins_load
  __tt_dir_sync
}

__tt_pins_write() {
  local k REPLY w=0
  local -a keys=(${(ok)TTHEME_PINS}) lines=()
  for k in $keys; do
    __tt_tilde "$k"
    (( ${#REPLY} > w )) && w=${#REPLY}
  done
  for k in $keys; do
    __tt_tilde "$k"
    printf -v REPLY '%-*s  %s' $w "$REPLY" "${TTHEME_PINS[$k]}"
    lines+=("$REPLY")
  done
  if (( ! ${#lines} )); then
    rm -f $TTHEME_PINS_FILE || return 1
    TTHEME_PINS_RAW=""
    return 0
  fi
  mkdir -p ${TTHEME_PINS_FILE:h} || return 1
  print -rl -- "${lines[@]}" > $TTHEME_PINS_FILE || return 1
  TTHEME_PINS_RAW="$(<$TTHEME_PINS_FILE)"
}

__tt_pin_save() {
  local name=$1 key=$PWD REPLY
  (( $2 == 2 )) && key="$PWD/**"
  unset "TTHEME_PINS[$PWD]" "TTHEME_PINS[$PWD/**]"
  TTHEME_PINS[$key]=$name
  if ! __tt_pins_write; then
    print -u2 "ttheme pin: could not write $TTHEME_PINS_FILE"
    return 1
  fi
  [[ -n $TTHEME_PIN ]] || TTHEME_BASE_SPEC=$3
  TTHEME_PIN=$key TTHEME_PIN_SPEC=${TTHEME_PALETTE[$name]}
  __tt_tilde "$key"
  if __tt_color; then
    printf '\033[2mpinned · %s → %s\033[0m\n' "$REPLY" "$name"
  else
    print -r -- "pinned · $REPLY → $name"
  fi
}

__tt_unpin() {
  local key REPLY
  for key in "$PWD" "$PWD/**"; do
    [[ -n ${TTHEME_PINS[$key]} ]] || continue
    unset "TTHEME_PINS[$key]"
    if ! __tt_pins_write; then
      print -u2 "ttheme unpin: could not write $TTHEME_PINS_FILE"
      return 1
    fi
    __tt_dir_sync
    __tt_tilde "$key"
    if __tt_color; then
      printf '\033[2munpinned · %s\033[0m\n' "$REPLY"
    else
      print -r -- "unpinned · $REPLY"
    fi
    return 0
  done
  if __tt_dir_rule "$PWD"; then
    __tt_tilde "$REPLY"
    print -u2 "ttheme unpin: nothing pinned here — $REPLY covers this directory"
  else
    print -u2 "ttheme unpin: nothing pinned here"
  fi
  return 1
}

__tt_keep() {
  if ! __tt_persist "$1"; then
    print -u2 "ttheme: could not save the default — no \`theme =\` line inside the \`# ttheme begin\` block of the ghostty config (run \`npx @kecan0406/ttheme@latest init\`)"
    return 1
  fi
  if __tt_color; then
    printf '\033[2mdefault · new tabs open with %s\033[0m\n' "$1"
  else
    print -r -- "default · new tabs open with $1"
  fi
}

__tt_order() {
  if [[ $TTHEME_SORT == series ]]; then
    reply=($TTHEME_ORDER)
  else
    reply=($TTHEME_ABC)
  fi
}

__tt_menu() {
  local k cur="" mark grp last_grp="" REPLY
  local -a reply
  __tt_order
  if ! __tt_color; then
    for k in $reply; do
      printf '%s\t%s\t%s\n' "$k" "${TTHEME_GROUP[$k]:-Other}" "${TTHEME_SRC[$k]:-unknown}"
    done
    return 0
  fi
  [[ -n $TTHEME_SPEC ]] && __tt_name_of "$TTHEME_SPEC" && cur=$REPLY
  local gutter=""
  if [[ -n ${TTHEME_PALETTE[$cur]} ]]; then
    local -a cp=(${=TTHEME_PALETTE[$cur]})
    local ch=${cp[3]#\#}
    printf -v gutter '\033[38;2;%d;%d;%dm◆\033[0m ' \
      $((16#${ch:0:2})) $((16#${ch:2:2})) $((16#${ch:4:2}))
  fi
  for k in $reply; do
    grp=${TTHEME_GROUP[$k]:-Other}
    if [[ $grp != $last_grp ]]; then
      printf '\033[1m%s\033[0m' "$grp"
      [[ -n ${TTHEME_NATIVE[$k]} ]] && printf ' \033[2m%s\033[0m' "${TTHEME_NATIVE[$k]}"
      printf '\n'
      last_grp=$grp
    fi
    mark="  "
    [[ $k == $cur ]] && mark=$gutter
    __tt_palette_line "$k" "$mark"
  done
  printf '\n\033[2mttheme <name> paints this tab · ttheme preview · ttheme help\033[0m\n'
}

__tt_help() {
  print -r -- 'ttheme — character terminal palettes

  ttheme          list every palette, grouped, with previews
  ttheme homura   paint this tab (a unique prefix works: ttheme ho)
  ttheme preview  browse live — focus repaints, enter keeps (this tab or default), esc restores, ? lists keys
  ttheme next     advance this tab to the next palette
  ttheme pin      pick a palette for this directory — cd into it repaints, cd out restores
  ttheme unpin    drop the palette pinned to this directory
  ttheme config   edit settings in $EDITOR — they apply in new tabs'
}

__tt_config() {
  if [[ ! -e $TTHEME_CONFIG ]]; then
    mkdir -p ${TTHEME_CONFIG:h} || return 1
    print -r -- "$TTHEME_CONFIG_TEMPLATE" > $TTHEME_CONFIG
  fi
  ${=${VISUAL:-${EDITOR:-vi}}} $TTHEME_CONFIG || return
  print -r -- "settings apply in new tabs — $TTHEME_CONFIG"
}

__tt_config_write() {
  local line name doc
  local -a out=()
  local -A want=("$@")
  local -i i
  if [[ ! -e $TTHEME_CONFIG ]]; then
    mkdir -p ${TTHEME_CONFIG:h} 2>/dev/null || return 1
    print -r -- "$TTHEME_CONFIG_TEMPLATE" 2>/dev/null > $TTHEME_CONFIG || return 1
  fi
  [[ -r $TTHEME_CONFIG && -w $TTHEME_CONFIG ]] || return 1
  for line in "${(@f)$(<$TTHEME_CONFIG)}"; do
    for name in ${(k)want}; do
      [[ $line == (|\#)(| )': ${'${name}[:=}]* ]] || continue
      line=": \${$name:=${want[$name]}}"
      unset "want[$name]"
      break
    done
    out+=("$line")
  done
  for (( i = 1; i < $#; i += 2 )); do
    name=${@[i]}
    (( ${+want[$name]} )) || continue
    doc=""
    for line in "${(@f)TTHEME_CONFIG_TEMPLATE}"; do
      [[ $line == ": \${$name:="* ]] && break
      doc=$line
    done
    out+=("" "$doc" ": \${$name:=${want[$name]}}")
  done
  print -rl -- "${out[@]}" 2>/dev/null > $TTHEME_CONFIG
}

__tt_resolve() {
  local name=$1 k
  if [[ -n ${TTHEME_PALETTE[$name]} ]]; then
    REPLY=$name
    return 0
  fi
  local -a m=()
  for k in ${(k)TTHEME_PALETTE}; do
    [[ $k == $name* ]] && m+=$k
  done
  if (( ${#m} == 1 )); then
    REPLY=$m[1]
    return 0
  elif (( ${#m} > 1 )); then
    m=(${(o)m})
    print -u2 "multiple palettes start with '$name': $m"
  elif m=(${(o)${(M)${(k)TTHEME_PALETTE}:#*$name*}}) && (( ${#m} )); then
    print -u2 "unknown palette '$name' — did you mean: ${(j:, :)m[1,3]}?"
  else
    print -u2 "unknown palette '$name' — run \`ttheme\` to list palettes"
  fi
  return 1
}

__tt_next() {
  local f=$TTHEME_STATE_DIR/.rotation idx=0
  [[ -d $TTHEME_STATE_DIR ]] || mkdir -p $TTHEME_STATE_DIR 2>/dev/null
  [[ -r $f ]] && idx=$(<$f)
  [[ $idx == <-> ]] || idx=0
  (( idx = idx % ${#TTHEME_ORDER} + 1 ))
  print -r -- $idx > $f 2>/dev/null
  REPLY=${TTHEME_PALETTE[$TTHEME_ORDER[idx]]}
}

__tt_rotate() {
  if [[ $TTHEME_TAB_PALETTE == off ]]; then
    print -u2 "ttheme next: TTHEME_TAB_PALETTE is off"
    return 1
  fi
  local REPLY
  __tt_next
  __tt_apply "$REPLY"
  TTHEME_SPEC=$REPLY
  __tt_announce
}

__tt_pv_rows() {
  rtype=() rval=() rcnt=()
  local g t gm
  local -a ts
  for g in $groups; do
    ts=()
    gm=""
    [[ -n $flt && ${(L)g} == *$flt* ]] && gm=1
    for t in ${=gthemes[$g]}; do
      [[ -z $flt || -n $gm || $t == *$flt* ]] && ts+=($t)
    done
    [[ -n $flt ]] && (( ! ${#ts} )) && continue
    rtype+=(hdr); rval+=($g); rcnt+=(${#ts})
    if [[ -n $flt || -n ${exp[$g]} ]]; then
      for t in $ts; do rtype+=(thm); rval+=($t); rcnt+=(0); done
    fi
  done
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
  local name=$1 i
  exp[${TTHEME_GROUP[$name]:-Other}]=1
  __tt_pv_rows
  for (( i = 1; i <= ${#rval}; i++ )); do
    [[ ${rtype[i]} == thm && ${rval[i]} == $name ]] && { cur=$i; return 0 }
  done
  cur=1
}

__tt_pv_focus() {
  [[ ${rtype[cur]} == thm ]] || return 0
  (( resized )) || [[ ${rval[cur]} == "$bgname" ]] || __tt_pv_bg_show "${rval[cur]}"
  local spec=${TTHEME_PALETTE[${rval[cur]}]}
  [[ $spec == "$applied" ]] && return 0
  __tt_apply "$spec"
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
  if [[ ${rtype[cur]} == hdr ]]; then
    [[ -n ${exp[${rval[cur]}]} ]] && __tt_pv_toggle
    return 0
  fi
  local g=${TTHEME_GROUP[${rval[cur]}]:-Other} i
  for (( i = cur; i >= 1; i-- )); do
    [[ ${rtype[i]} == hdr ]] && { cur=$i; break }
  done
  exp[$g]=""
  __tt_pv_rows
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

__tt_pv_row() {
  local t=${rval[$1]} b=$'\e[1m' d=$'\e[2m' r=$'\e[22;24;39m' z=$'\e[0m' on="" base="" lead=$'\e[2m' mark=" " name arrow=▸
  local -i w
  (( color )) || b= d= r= z= lead=
  (( $1 == cur && color )) && on=$sb
  if [[ ${rtype[$1]} == hdr ]]; then
    [[ -n $flt || -n ${exp[$t]} ]] && arrow=▾
    name=$t
    (( ${(m)#name} > lw - 8 )) && name="${name[1,lw-9]}…"
    base=$b
    if (( color )) && [[ $t == "$ag" ]]; then
      base+=$ac lead=$ac
    elif (( $1 == cur )); then
      lead=""
    fi
    __tt_pv_hl "$name" "$base"
    w=$(( lw - 2 - ${(m)#name} - ${#rcnt[$1]} ))
    (( w < 1 )) && w=1
    REPLY=$on$lead$arrow$r" "$base$REPLY$r${(l:w:: :)}$d${rcnt[$1]}$z
    return 0
  fi
  if (( $1 == cur )); then
    mark=$cmark base=$b
  elif [[ -n $cdot && $t == "$cn" ]]; then
    mark=$cdot
  fi
  __tt_pv_hl "$t" "$base"
  if (( color )); then
    [[ -n ${tstrip[$t]} ]] || __tt_pv_strip $t
    w=$(( lw - 20 - ${#t} ))
    (( w < 1 )) && w=1
    REPLY="$on  $mark $base$REPLY$r${(l:w:: :)}${tstrip[$t]}"
  else
    REPLY="  $mark $REPLY"
  fi
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
  local b=$'\e[1m' d=$'\e[2m' z=$'\e[0m' y=$'\e[33m' on=$'\e[7;1m'$ac badge="" lead="" note="" right="" line plain
  local -a kk=() kl=() seg=()
  local -i end=$1 i lwid rwid
  (( color )) || b= d= z= y= on=
  if (( help )); then
    badge=KEYS right=$b"? esc"$z$d" close"$z
  elif [[ -n $pick ]]; then
    local a=$plabel[1] c=$plabel[2]
    if (( color )); then
      if (( pk == 1 )); then a=$on$a$z c=$d$c$z; else a=$d$a$z c=$on$c$z; fi
    else
      if (( pk == 1 )); then a="[${${a# }% }]"; else c="[${${c# }% }]"; fi
    fi
    badge=APPLY lead="$pick → $a $c"
    if [[ $mode == pin ]]; then
      __tt_tilde "$PWD"
      note=$REPLY
      (( pk == 2 )) && note+="/**"
    elif (( pk == 1 )); then
      note="until this tab closes"
    else
      note="new tabs · ghostty config"
    fi
    kk=(enter) kl=(confirm)
    right=$b"esc"$z$d" back"$z
  elif [[ -n $tune ]]; then
    badge=TUNE kk=(↑↓ ←→) kl=(field step)
    if (( tf == 2 )); then
      kl[2]=move kk+=(1-9) kl+=(place)
    else
      kk+=(⇧←→) kl+=(×10)
    fi
    kk+=(space '=' enter)
    if (( bgoff[$tune] )); then kl+=(show default keep); else kl+=(hide default keep); fi
    right=$b"esc"$z$d" undo"$z
  elif (( conf )); then
    badge=CONFIG kk=(↑↓ ←→ enter) kl=(setting value save)
    right=$b"esc"$z$d" undo"$z
  else
    [[ -n $flt ]] && badge=FILTER
    if (( ! ${#rval} )); then
      kk=(bksp) kl=(edit)
    elif [[ ${rtype[cur]} == hdr ]]; then
      if [[ -z $flt && -n ${exp[${rval[cur]}]} ]]; then
        kk=(←) kl=(close)
      elif [[ -z $flt ]]; then
        kk=(→) kl=(open)
      fi
    else
      kk=(enter) kl=(apply)
      [[ $mode == pin ]] && kl[1]=pin
      __tt_pv_bg_state ${rval[cur]} && { kk+=(tab); kl+=("tune bg") }
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
    lead=$y$msg$z note="" kk=() kl=()
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
  return 0
}

__tt_pv_help() {
  local back="the tab" z=$'\e[0m' b=$'\e[1m' blank
  [[ -n ${TTHEME_PALETTE[$cn]} ]] && back=$cn
  local -a hk=(move series filter apply) hv=(
    "↑↓  home  end  pgup  pgdn"
    "←→  ·  enter or space on a series"
    "a-z 0-9 -  ·  bksp  ·  ctrl-u clears"
    "enter  ·  esc restores $back"
  )
  if (( bgcw )); then
    hk+=("tune bg" "" "" "")
    hv+=("tab on a palette with a background" "↑↓ field  ←→ step  ⇧←→ ×10  1-9 place" "space hides  ·  = default" "enter keeps  ·  esc undoes")
  fi
  hk+=(config "")
  hv+=("alt-c  ·  ↑↓ setting  ←→ value" "enter saves  ·  esc undoes")
  hk+=(close)
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
  x=$(( (pw - w) / 2 + 1 )) y=$(( (ph - hh) / 2 ))
  (( y < 4 )) && y=4
  blank=${(l:w:: :)}
  out+=$'\e['$y';'$x'H'"╭─ keys ${(l:$(( w - 9 ))::─:)}╮"
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
  local -a sp=(${=applied}) ln=()
  (( ${#sp} >= 20 )) || return 0
  local z=$'\e[0m' d=$'\e[2m' pr=$'\e[32m❯\e[0m ' sel cu cell line="" lo hi
  local -i i r cw=4
  (( sw < 44 )) && cw=3
  (( sw >= 56 )) && cw=$(( (sw + 1) / 8 - 1 ))
  (( cw > 7 )) && cw=7
  printf -v sel '\e[48;2;%d;%d;%dm' $((16#${sp[4]:1:2})) $((16#${sp[4]:3:2})) $((16#${sp[4]:5:2}))
  printf -v cu '\e[48;2;%d;%d;%dm' $((16#${sp[3]:1:2})) $((16#${sp[3]:3:2})) $((16#${sp[3]:5:2}))
  for (( i = 0; i < 8; i++ )); do
    lo=${sp[i+5]#\#} hi=${sp[i+13]#\#}
    printf -v cell '\e[38;2;%d;%d;%d;48;2;%d;%d;%dm%s\e[0m ' \
      $((16#${lo:0:2})) $((16#${lo:2:2})) $((16#${lo:4:2})) \
      $((16#${hi:0:2})) $((16#${hi:2:2})) $((16#${hi:4:2})) "${(l:cw::▀:)}"
    line+=$cell
  done
  out+=$'\e[4;'$sc'H'$line
  ln=($'\e[1;34m~/code/demo\e[0m'$d' on '$z$'\e[35mmain\e[32m +2\e[33m ~1\e[0m' "${pr}git status -sb")
  (( sw >= 44 )) && ln+=($'## \e[32mmain\e[0m...\e[31morigin/main\e[33m [ahead 1]\e[0m')
  ln+=($'\e[31m M\e[0m src/main.rs' $'\e[31m??\e[0m notes.md' "")
  (( sw >= 44 )) && ln+=("${pr}ls" $'\e[1;34mdocs\e[0m  \e[1;34msrc\e[0m  \e[1;34mtests\e[0m  Cargo.toml  README.md' "")
  ln+=("${pr}cargo test" $'\e[32m ✓\e[0m parses config' $'\e[31m ✗\e[0m renders frame')
  (( sw >= 44 )) && ln[-1]+=$d'  expected '$z$'\e[32m3\e[0m'$d', received '$z$'\e[31m2\e[0m'
  ln+=("" "${pr}echo ${sel}selected text${z} ${cu} ${z}")
  for (( r = 1; r <= ${#ln}; r++ )); do
    (( r + 5 < ph )) || break
    out+=$'\e['$(( r + 5 ))';'$sc'H'${ln[r]}
  done
}

__tt_pv_tune() {
  local -a fields=(size pos op)
  local -i n=1
  case $key in
    $'\x03') return 1 ;;
    up) (( tf > 1 )) && tf=$(( tf - 1 )) ;;
    down) (( tf < 3 )) && tf=$(( tf + 1 )) ;;
    left|right|sleft|sright)
      [[ $key == *left ]] && n=-1
      [[ $key == s* ]] && (( tf != 2 )) && n=$(( n * 10 ))
      __tt_pv_bg_adjust ${fields[tf]} $n
      ;;
    [1-9])
      tf=2
      __tt_pv_bg_adjust at $key
      ;;
    ' ') __tt_pv_bg_adjust on ;;
    '=') __tt_pv_bg_adjust def ;;
    $'\r'|$'\n')
      if [[ "${bgsize[$tune]} ${bgpos[$tune]} ${bgop[$tune]} ${bgoff[$tune]}" != "$tsnap" ]]; then
        bgedit[$tune]=1 msg="kept · saved when preview closes" msgt=200
      fi
      tune=""
      ;;
    esc) __tt_pv_untune ;;
    '?') help=1 ;;
  esac
  return 0
}

__tt_pv_untune() {
  local -a s=(${=tsnap})
  bgsize[$tune]=$s[1] bgpos[$tune]=$s[2] bgop[$tune]=$s[3] bgoff[$tune]=$s[4] bgname="" tune=""
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
    up) (( cf > 1 )) && cf=$(( cf - 1 )) ;;
    down) (( cf < ${#cvars} )) && cf=$(( cf + 1 )) ;;
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
  esac
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
    conf=0 msg="saved · $REPLY" msgt=200
  else
    __tt_pv_unconf
    msg="could not write $REPLY" msgt=200
  fi
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
      else
        out+="  "$v
      fi
      continue
    fi
    for (( j = 1; j <= ${#sh}; j++ )); do
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
  note=${cnote[${(P)var}]}
  [[ -n $note ]] && out+=$'\e['$(( r0 + ${#cvars} + 1 ))';'$col'H'$d${note[1,end-col+1]}$z
  return 0
}

__tt_pv_flush() {
  print -rn -- "$out"
  if (( wiped )); then
    local bn=$bgname
    [[ ${rtype[cur]} == thm ]] && bn=${rval[cur]}
    [[ -n $bn ]] && __tt_pv_bg_show "$bn" 1
  fi
  printf '\e[?2026l'
}

__tt_pv_draw() {
  local out line cnt ex ag="" ac="" sb="" cmark="▶" rthumb="#" rtrack="." dd="" zz="" state=on src="" REPLY
  local -i lw sw split sc se=$(( pw - 2 )) h k i N=${#rval} rail=0 rl=0 rs=0 mt=${#TTHEME_ORDER} wiped=0
  __tt_pv_lw
  lw=$reply[1] sw=$reply[2]
  split=$(( sw > 0 )) sc=$(( pw - 1 - sw ))
  h=$(( ph - 5 ))
  [[ -n $tune ]] && (( ! split )) && h=$(( ph - 14 ))
  (( conf && ! split )) && h=$(( ph - 12 ))
  (( h < 1 )) && h=1
  (( cur < top )) && top=$cur
  (( cur >= top + h )) && top=$(( cur - h + 1 ))
  (( top < 1 )) && top=1
  (( N > h && top > N - h + 1 )) && top=$(( N - h + 1 ))
  if (( N > h )); then
    rail=1
    rl=$(( h * h / N ))
    (( rl < 1 )) && rl=1
    rs=$(( 1 + (top - 1) * (h - rl) / (N - h) ))
  fi
  if (( color )); then
    dd=$'\e[2m' zz=$'\e[0m' rtrack=$'\e[2m░\e[0m'
    if [[ -n $applied ]]; then
      local -a ap=(${=applied})
      local acx=${ap[3]#\#} sbx=${ap[4]#\#}
      printf -v ac '\e[38;2;%d;%d;%dm' $((16#${acx:0:2})) $((16#${acx:2:2})) $((16#${acx:4:2}))
      printf -v sb '\e[48;2;%d;%d;%dm' $((16#${sbx:0:2})) $((16#${sbx:2:2})) $((16#${sbx:4:2}))
    fi
    rthumb=$ac"█"$zz cmark=$ac"▶"$'\e[39m'
    [[ ${rtype[cur]} == thm ]] && ag=${TTHEME_GROUP[${rval[cur]}]:-Other}
  fi
  if [[ -n $flt ]]; then
    local -a mm=(${(M)rtype:#thm})
    mt=${#mm}
  fi
  cnt="$mt/${#TTHEME_ORDER}"
  out=$'\e[H'
  if (( resized )); then
    out+=$'\e[2J'
    resized=0 wiped=1
  fi
  if (( pw < 40 || ph < 12 )); then
    line="ttheme preview"
    (( color )) && line=$'\e[1m'$ac$line$'\e[0m'
    out+=$line$'\e[K\n'"needs 40×12 — now ${pw}×${ph}"$'\e[K\n'
    line="esc quits"
    (( color )) && line=$'\e[2m'$line$'\e[0m'
    out+=$line$'\e[K\e[J'
    __tt_pv_flush
    return 0
  fi
  if [[ -n $flt ]]; then
    if (( color )); then
      line="⌕ "$'\e[1m'$flt$zz$ac$'\e[7m \e[0m'
    else
      line="⌕ ${flt}_"
    fi
  else
    ex="$expal | $exgrp"
    (( ${#ex} > lw - 17 - ${#cnt} )) && ex="${ex[1,lw-18-${#cnt}]}…"
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
    line="⌕ "$dd"search… e.g. $ex"$zz
  fi
  out+=$line$'\e[K\e['$(( lw - ${#cnt} + 1 ))'G'
  if [[ -n $flt ]]; then
    out+=$cnt$'\n'$ac
  else
    out+=$dd$cnt$zz$'\n'$dd
  fi
  out+=${(l:lw::─:)}$zz$'\e[K\n\e[K\n'
  for (( k = 0; k < ph - 4; k++ )); do
    i=$(( top + k ))
    line=""
    if (( k < h )); then
      if (( ! N )); then
        (( k == 0 )) && line="  ${dd}no palettes match '$flt'$zz"
      elif (( i <= N )); then
        __tt_pv_row $i
        line=$REPLY
      fi
    fi
    out+=$line$'\e[K'
    if (( rail && k < h )); then
      if (( k + 1 >= rs && k + 1 < rs + rl )); then
        out+=$'\e['$(( lw + 2 ))'G'$rthumb
      else
        out+=$'\e['$(( lw + 2 ))'G'$rtrack
      fi
    fi
    out+=$'\n'
  done
  __tt_pv_foot $(( split ? se : pw ))
  if (( split )); then
    out+=$'\e[2;'$sc'H'$dd${(l:$(( se - sc + 1 ))::─:)}$zz
    if (( help && sw >= 48 )); then
      __tt_pv_head 1 $sc $se keys
      __tt_pv_help
    elif [[ -n $tune ]]; then
      (( bgoff[$tune] )) && state=off
      __tt_pv_head 1 $sc $se $tune background $state
      __tt_pv_bg_panel $tune 4 $sc $se
    elif (( conf )); then
      __tt_tilde "$TTHEME_CONFIG"
      src=$REPLY
      (( 8 + ${#src} > sw )) && src=""
      __tt_pv_head 1 $sc $se config "" "$src"
      __tt_pv_conf_panel 4 $sc $se
    else
      [[ -n $an ]] && src=${TTHEME_SRC[$an]}
      (( ${#an} + 2 + ${#src} > sw )) && src=""
      __tt_pv_head 1 $sc $se ${an:-custom} "" "$src"
      __tt_pv_specimen
    fi
    (( help && sw < 48 )) && __tt_pv_help
  else
    if [[ -n $tune ]]; then
      (( bgoff[$tune] )) && state=off
      __tt_pv_head $(( ph - 9 )) 1 $lw $tune background $state
      __tt_pv_bg_panel $tune $(( ph - 8 )) 1 $lw
    elif (( conf )); then
      __tt_pv_head $(( ph - 7 )) 1 $lw config
      __tt_pv_conf_panel $(( ph - 6 )) 1 $lw
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
  elif (( $+functions[__tt_persist] )) && [[ $TTHEME_TAB_PALETTE == off ]]; then
    canpick=1
  fi
}

__tt_pv_strip() {
  local lo hi cell
  local -a tp=(${=TTHEME_PALETTE[$1]}) v=()
  local -i j
  for (( j = 5; j <= 12; j++ )); do
    lo=${tp[j]#\#} hi=${tp[j+8]#\#}
    v+=($((16#${lo:0:2})) $((16#${lo:2:2})) $((16#${lo:4:2})) $((16#${hi:0:2})) $((16#${hi:2:2})) $((16#${hi:4:2})))
  done
  printf -v cell '\e[38;2;%d;%d;%d;48;2;%d;%d;%dm▀▀' $v
  tstrip[$1]=$cell$'\e[0m'
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
  local t=0.2
  (( gstep )) && t=0.06
  while ! read -sk 1 -t $t 2>/dev/null; do
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
    (( gstep )) && { gstep=$(( gstep - 1 )); return 1 }
    (( SECONDS >= exnext )) && { __tt_pv_roll; gstep=8; return 1 }
  done
  return 0
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
    *) key=nop ;;
  esac
}

__tt_pv_pick() {
  case $key in
    $'\x03') return 1 ;;
    esc) pick="" ;;
    left|right|$'\t') pk=$(( 3 - pk )) ;;
    $'\r'|$'\n')
      sel=$pick picked=$pk
      return 1
      ;;
  esac
  return 0
}

__tt_pv_handle() {
  local name
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
    $'\r'|$'\n')
      if [[ ${rtype[cur]} == thm ]]; then
        if (( canpick )); then
          pick=${rval[cur]} pk=$pkdef
        else
          sel=${rval[cur]}
          return 1
        fi
      elif [[ ${rtype[cur]} == hdr ]]; then
        __tt_pv_toggle
      fi
      ;;
    up) (( cur > 1 )) && cur=$(( cur - 1 )) ;;
    down) (( cur < ${#rval} )) && cur=$(( cur + 1 )) ;;
    right) [[ ${rtype[cur]} == hdr && -z ${exp[${rval[cur]}]} ]] && __tt_pv_toggle ;;
    left) __tt_pv_left ;;
    home) cur=1 ;;
    end) (( ${#rval} )) && cur=${#rval} ;;
    pgup)
      cur=$(( cur - ph + 5 ))
      (( cur < 1 )) && cur=1
      ;;
    pgdn)
      cur=$(( cur + ph - 5 ))
      (( cur > ${#rval} )) && cur=${#rval}
      (( cur < 1 )) && cur=1
      ;;
    ' ') [[ ${rtype[cur]} == hdr ]] && __tt_pv_toggle ;;
    $'\t')
      [[ ${rtype[cur]} == thm ]] || return 0
      name=${rval[cur]}
      if __tt_pv_bg_state $name; then
        tune=$name tf=1 tsnap="${bgsize[$name]} ${bgpos[$name]} ${bgop[$name]} ${bgoff[$name]}"
      elif (( bgcw )); then
        msg="no background image for $name" msgt=200
      fi
      ;;
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
    [a-zA-Z0-9-])
      __tt_pv_lw
      (( ${#flt} >= reply[1] - 12 )) && return 0
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
  emulate -L zsh
  local mode=$1
  if [[ ! -t 0 || ! -t 1 ]]; then
    print -u2 "ttheme ${mode:-preview}: needs a terminal"
    return 1
  fi
  local orig=$TTHEME_SPEC applied=$TTHEME_SPEC flt="" sel="" cn="" cdot="" key="" REPLY="" cur=1 top=1 color=0 pw=80 ph=24 resized=1 expal="" exgrp="" exnext=0 gstep=0 gseed=0
  local pick="" pk=1 pkdef=1 picked=0 canpick=0 bgcw=0 bgch=0 bgname="" bgshown="" bginc="" osd="" osdt=0
  local tune="" tsnap="" tf=1 help=0 msg="" msgt=0 an="" bgrel=0 bgmx=0 bgmy=0 bganchor=0
  local -A bgsent=() bgdim=() bgsrc=() bgfill=() bgfocus=() bgsize=() bgpos=() bgop=() bgdef=() bgoff=() bgbase=() bgload=() bgshot=() bgshotkey=() bgedit=()
  local conf=0 cf=1
  local -a plabel=(" this tab " " default ") csnap=()
  local -a cvars=(TTHEME_TAB_PALETTE TTHEME_ANNOUNCE TTHEME_FX TTHEME_SORT) clabel=("new tabs" announce "search fx" sort)
  local -a cchoice=("seq off" "1 0" "typewriter decode glitch" "abc series") cshow=("seq off" "on off" "typewriter decode glitch" "abc series")
  local -A cnote=(
    seq "new tabs rotate through palettes" off "new tabs keep the terminal theme"
    1 "shows the palette notice" 0 "silences the palette notice"
    typewriter "the search hint types itself" decode "the search hint decodes" glitch "the search hint glitches in"
    abc "series and palettes by name" series "series in the order added"
  )
  [[ $mode == pin ]] && pkdef=2 plabel=(" this directory " " and below ")
  __tt_pv_canpick
  __tt_pv_size
  local -a groups=() rtype=() rval=() rcnt=() reply=()
  local -A gthemes=() exp=() tstrip=()
  __tt_color && color=1
  __tt_pv_init
  __tt_pv_roll
  __tt_pv_rows
  [[ -n ${TTHEME_PALETTE[$cn]} ]] && __tt_pv_goto "$cn"
  printf '\e[?2026h\e[?1049h\e[?7l\e[?25l'
  __tt_pv_bg_open
  {
    while :; do
      printf '\e[?2026h'
      __tt_pv_focus
      [[ ${rtype[cur]} == thm ]] && an=${rval[cur]}
      __tt_pv_draw
      if ! __tt_pv_read; then
        [[ -t 0 ]] && continue
        break
      fi
      while :; do
        __tt_pv_handle || break 2
        __tt_pv_read drain || break
      done
    done
  } always {
    printf '\e[?2026h'
    __tt_pv_bg_close
    printf '\e[?7h\e[?1049l\e[?25h\e[?2026l'
    [[ -n $tune ]] && __tt_pv_untune
    (( conf )) && __tt_pv_unconf
    __tt_pv_bg_save
    if [[ -n $sel ]]; then
      local spec=${TTHEME_PALETTE[$sel]}
      [[ $spec == "$applied" ]] || __tt_apply "$spec"
      TTHEME_SPEC=$spec
      __tt_announce
      if [[ $mode == pin ]]; then
        __tt_pin_save "$sel" $picked "$orig"
      elif (( picked == 2 )); then
        __tt_keep "$sel"
      fi
    elif [[ -z $orig && -n $applied ]]; then
      __tt_osc_reset
    elif [[ $orig != "$applied" ]]; then
      __tt_apply "$orig"
    fi
  }
  return 0
}

ttheme() {
  if (( ! $# )); then
    __tt_menu
    return 0
  fi

  case $1 in
    -h|--help|help) __tt_help; return 0 ;;
    next) __tt_rotate; return ;;
    preview) __tt_preview; return ;;
    pin) __tt_preview pin; return ;;
    unpin) __tt_unpin; return ;;
    config) __tt_config; return ;;
    -*) print -u2 "ttheme: unknown option $1 — see \`ttheme help\`"; return 1 ;;
  esac

  local REPLY
  __tt_resolve "$1" || return 1
  local spec=${TTHEME_PALETTE[$REPLY]}
  __tt_apply "$spec"
  TTHEME_SPEC=$spec
  __tt_announce
}

if (( $+functions[compdef] )); then
  __tt_complete() {
    (( CURRENT == 2 )) && compadd -- preview next pin unpin config help
    compadd -- $TTHEME_ORDER
  }
  compdef __tt_complete ttheme
fi

if __tt_active; then
  () {
    local REPLY k
    if [[ -n $TTHEME_SPEC ]]; then
      :
    elif [[ $TTHEME_TAB_PALETTE == off ]]; then
      if __tt_query_bg; then
        for k in ${(k)TTHEME_PALETTE}; do
          [[ ${TTHEME_PALETTE[$k]%% *} == "$REPLY" ]] && { TTHEME_SPEC=$TTHEME_PALETTE[$k]; break }
        done
        [[ -n $TTHEME_SPEC ]] || TTHEME_SPEC="$REPLY ${TTHEME_PALETTE[neutral]#* }"
      else
        TTHEME_SPEC="- ${TTHEME_PALETTE[neutral]#* }"
      fi
    else
      __tt_next
      TTHEME_SPEC=$REPLY
      __tt_apply "$TTHEME_SPEC"
    fi
    __tt_dir_sync
  }
  autoload -Uz add-zsh-hook
  add-zsh-hook chpwd __tt_chpwd
  __tt_announce
fi
