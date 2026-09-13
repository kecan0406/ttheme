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

__tt_tilde() { REPLY=${1/#$HOME\//~/} }

__tt_pins_load() {
  local raw="" line key name
  [[ -r $TTHEME_PINS_FILE ]] && raw="$(<$TTHEME_PINS_FILE)"
  [[ $raw == "$TTHEME_PINS_RAW" ]] && return 0
  TTHEME_PINS_RAW=$raw
  TTHEME_PINS=()
  for line in "${(@f)raw}"; do
    [[ $line == [~/]* ]] || continue
    key=${line%%[[:space:]]*} name=${line##*[[:space:]]}
    TTHEME_PINS[${key/#\~\//$HOME/}]=$name
    [[ -n ${TTHEME_PALETTE[$name]} ]] || print -u2 "ttheme: unknown palette '$name' pinned to $key"
  done
}

__tt_pins_load

: ${TTHEME_TAB_PALETTE:=seq}

: ${TTHEME_ANNOUNCE:=1}

: ${TTHEME_FX:=typewriter}

typeset -g TTHEME_STATE_DIR=${XDG_STATE_HOME:-$HOME/.local/state}/ttheme

__tt_detect() {
  if [[ -n $GHOSTTY_RESOURCES_DIR || $TERM_PROGRAM == ghostty ]]; then
    print -r -- ghostty
  elif [[ -n $KITTY_WINDOW_ID ]]; then
    print -r -- kitty
  elif [[ -n $WEZTERM_PANE ]]; then
    print -r -- wezterm
  elif [[ -n $ALACRITTY_WINDOW_ID ]]; then
    print -r -- alacritty
  elif [[ -n $ITERM_SESSION_ID || $TERM_PROGRAM == iTerm.app ]]; then
    print -r -- iterm2
  elif [[ $TERM == foot* ]]; then
    print -r -- foot
  else
    print -r -- unknown
  fi
}

typeset -g TTHEME_ADAPTER=$(__tt_detect)

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

__tt_name_of() {
  local k
  for k in ${(k)TTHEME_PALETTE}; do
    [[ $TTHEME_PALETTE[$k] == $1 ]] && { print -r -- "$k"; return 0 }
  done
  print -r -- custom
}

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
  local name=$(__tt_name_of "$TTHEME_SPEC")
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

__tt_menu() {
  local k cur="" mark grp last_grp=""
  if ! __tt_color; then
    for k in $TTHEME_ORDER; do
      printf '%s\t%s\t%s\n' "$k" "${TTHEME_GROUP[$k]:-Other}" "${TTHEME_SRC[$k]:-unknown}"
    done
    return 0
  fi
  [[ -n $TTHEME_SPEC ]] && cur=$(__tt_name_of "$TTHEME_SPEC")
  local gutter=""
  if [[ -n ${TTHEME_PALETTE[$cur]} ]]; then
    local -a cp=(${=TTHEME_PALETTE[$cur]})
    local ch=${cp[3]#\#}
    printf -v gutter '\033[38;2;%d;%d;%dm◆\033[0m ' \
      $((16#${ch:0:2})) $((16#${ch:2:2})) $((16#${ch:4:2}))
  fi
  for k in $TTHEME_ORDER; do
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
  ttheme preview  browse live — focus repaints, enter keeps (this tab or default), esc restores
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
  mkdir -p $TTHEME_STATE_DIR 2>/dev/null
  [[ -r $f ]] && idx=$(<$f)
  [[ $idx == <-> ]] || idx=0
  (( idx = idx % ${#TTHEME_ROTATION} + 1 ))
  print -r -- $idx > $f 2>/dev/null
  REPLY=${TTHEME_PALETTE[$TTHEME_ROTATION[idx]]}
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

__tt_pv_draw() {
  local h=$(( ph - 6 )) w=$pw i out line g arrow chunk cnt hz="" mt=${#TTHEME_ORDER}
  local bw=$(( pw < 48 ? pw : 48 ))
  local N=${#rval} rail=0 rl=0 rs=0 rthumb="█" rtrack="░" cmark="▶" ag="" hsel=""
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
    rtrack=$'\e[2m'"░"$'\e[0m'
    if [[ ${rtype[cur]} == thm ]]; then
      local -a fp=(${=TTHEME_PALETTE[${rval[cur]}]})
      local fc=${fp[3]#\#}
      printf -v rthumb '\e[38;2;%d;%d;%dm█\e[0m' $((16#${fc:0:2})) $((16#${fc:2:2})) $((16#${fc:4:2}))
      printf -v cmark '\e[38;2;%d;%d;%dm▶\e[0m' $((16#${fc:0:2})) $((16#${fc:2:2})) $((16#${fc:4:2}))
      printf -v hsel '\e[7;1;38;2;%d;%d;%dm' $((16#${fc:0:2})) $((16#${fc:2:2})) $((16#${fc:4:2}))
      ag=${TTHEME_GROUP[${rval[cur]}]:-Other}
    fi
  else
    rthumb="#" rtrack="."
  fi
  if [[ -n $flt ]]; then
    local -a mm=(${(M)rtype:#thm})
    mt=${#mm}
  fi
  cnt="($mt/${#TTHEME_ORDER})"
  hz=${(l:$(( bw - 2 ))::─:)hz}
  out=$'\e[H'
  if (( resized )); then
    out+=$'\e[2J'
    resized=0
  fi
  local ver="v$TTHEME_VERSION" hl=$'\e[1m'
  if (( color )); then
    if [[ -n $applied ]]; then
      local -a ap=(${=applied})
      local ac=${ap[3]#\#}
      printf -v hl '\e[1;38;2;%d;%d;%dm' $((16#${ac:0:2})) $((16#${ac:2:2})) $((16#${ac:4:2}))
    fi
    line="${hl}Ttheme"$'\e[0m'" "$'\e[2m'"$ver $cnt"$'\e[0m'
  else
    line="Ttheme $ver $cnt"
  fi
  out+=$line$'\e[K'$'\n'
  line=""
  [[ -n ${TTHEME_PALETTE[$cn]} ]] && line=${tbody[$cn]}
  out+=$line$'\e[K'$'\n'
  out+="╭$hz╮"$'\e[K\n'
  local ex="$expal | $exgrp"
  (( ${#ex} > bw - 18 )) && ex="${ex[1,bw-19]}…"
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
  ex="e.g. $ex"
  if [[ -n $flt ]]; then
    line="│ ⌕ ${flt}_"
  elif (( color )); then
    line="│ ⌕ "$'\e[2m'"search… $ex"$'\e[0m'
  else
    line="│ ⌕ search… $ex"
  fi
  out+=$line$'\e[K'$'\e['${bw}G"│"$'\n'
  out+="╰$hz╯"$'\e[K\n'
  for (( i = top; i < top + h; i++ )); do
    if (( ! ${#rval} && i == 1 )); then
      out+="  no palettes match '$flt'"$'\e[K\n'
      continue
    fi
    if (( i > ${#rval} )); then
      out+=$'\e[K\n'
      continue
    fi
    if [[ ${rtype[i]} == hdr ]]; then
      g=${rval[i]}
      arrow=▸
      [[ -n $flt || -n ${exp[$g]} ]] && arrow=▾
      if (( i == cur )); then
        if (( color )); then
          chunk=$'\e[1;7m'" $g "$'\e[0m'
        else
          chunk="[$g]"
        fi
      elif (( color )); then
        if [[ -n $ag && $g == $ag ]]; then
          chunk=$hsel" $g "$'\e[0m'
        else
          chunk=" "$'\e[1m'"$g"$'\e[0m'" "
        fi
      else
        chunk=" $g"
      fi
      if (( color )); then
        line="$arrow"$chunk${hchip[$g]}" "$'\e[2m'"(${rcnt[i]})"$'\e[0m'${hnat[$g]}
      else
        line="$arrow"$chunk" (${rcnt[i]})"${hnat[$g]}
      fi
    elif (( i == cur )); then
      line="  $cmark "${tbody[${rval[i]}]}
    elif [[ -n $cdot && ${rval[i]} == $cn ]]; then
      line="  $cdot "${tbody[${rval[i]}]}
    else
      line="    "${tbody[${rval[i]}]}
    fi
    out+=$line$'\e[K'
    if (( rail )); then
      if (( i - top + 1 >= rs && i - top + 1 < rs + rl )); then
        out+=$'\e['${w}G$rthumb
      else
        out+=$'\e['${w}G$rtrack
      fi
    fi
    out+=$'\n'
  done
  if [[ -n $pick ]]; then
    local a=$plabel[1] b=$plabel[2] on=${hsel:-$'\e[7;1m'} at=$pick
    if [[ $mode == pin ]]; then
      __tt_tilde "$PWD"
      at+=" → $REPLY"
    fi
    if (( color )); then
      if (( pk == 1 )); then
        a=$on$a$'\e[0m' b=$'\e[2m'$b$'\e[0m'
      else
        a=$'\e[2m'$a$'\e[0m' b=$on$b$'\e[0m'
      fi
      line=" $at → $a $b "$'\e[2m'"←→ choose · enter · esc back"$'\e[0m'
    else
      if (( pk == 1 )); then a="[${${a# }% }]"; else b="[${${b# }% }]"; fi
      line=" $at → $a $b ←→ choose · enter · esc back"
    fi
  else
    line="↑↓ move · ←→ fold · type to filter · enter apply · esc restore"
    (( color )) && line=$'\e[2m'$line$'\e[0m'
  fi
  out+=$line$'\e[K'
  print -rn -- "$out"
}

__tt_pv_init() {
  local k g
  for k in $TTHEME_ORDER; do
    g=${TTHEME_GROUP[$k]:-Other}
    if [[ -z ${gthemes[$g]} ]]; then
      groups+=($g)
      gnative[$g]=$TTHEME_NATIVE[$k]
    fi
    gthemes[$g]+=" $k"
  done
  [[ -n $orig ]] && cn=$(__tt_name_of "$orig")
  if [[ -n ${TTHEME_PALETTE[$cn]} ]]; then
    cdot="◆"
    if (( color )); then
      local -a cp=(${=TTHEME_PALETTE[$cn]})
      local ch=${cp[3]#\#}
      printf -v cdot '\e[38;2;%d;%d;%dm◆\e[0m' \
        $((16#${ch:0:2})) $((16#${ch:2:2})) $((16#${ch:4:2}))
    fi
  fi
  local body nat
  for g in $groups; do
    nat=${gnative[$g]}
    if (( color )); then
      local -a gp=(${=TTHEME_PALETTE[${${=gthemes[$g]}[1]}]})
      local sb=${gp[4]#\#}
      printf -v body '\e[48;2;%d;%d;%dm ● \e[0m' \
        $((16#${sb:0:2})) $((16#${sb:2:2})) $((16#${sb:4:2}))
      hchip[$g]=$body
      hnat[$g]=${nat:+" "$'\e[2m'$nat$'\e[0m'}
    else
      hnat[$g]=${nat:+" $nat"}
    fi
  done
  local t sw sc j
  for t in $TTHEME_ORDER; do
    if (( color )); then
      local -a tp=(${=TTHEME_PALETTE[$t]})
      local bg=${tp[1]#\#} cu=${tp[3]#\#}
      printf -v sw '\e[48;2;%d;%d;%dm' $((16#${bg:0:2})) $((16#${bg:2:2})) $((16#${bg:4:2}))
      for j in 6 7 8 9 10 11; do
        sc=${tp[j]#\#}
        printf -v sc '\e[38;2;%d;%d;%dm▄' $((16#${sc:0:2})) $((16#${sc:2:2})) $((16#${sc:4:2}))
        sw+=$sc
      done
      sw+=" "
      printf -v body '%-13s \e[48;2;%d;%d;%d;38;2;%d;%d;%dm ● \e[0m%s\e[0m  \e[2m%s\e[0m' \
        "$t" \
        $((16#${bg:0:2})) $((16#${bg:2:2})) $((16#${bg:4:2})) \
        $((16#${cu:0:2})) $((16#${cu:2:2})) $((16#${cu:4:2})) \
        "$sw" "${TTHEME_SRC[$t]:-unknown}"
    else
      printf -v body '%-13s ● · %s' "$t" "${TTHEME_SRC[$t]:-unknown}"
    fi
    tbody[$t]=$body
  done
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
  [[ $key == $'\e' ]] || return 0
  local seq=""
  if ! __tt_pv_getch 0.05; then
    key=esc
    return 0
  fi
  if [[ $REPLY != '[' && $REPLY != O ]]; then
    key=nop
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
  if [[ -n $pick ]]; then
    __tt_pv_pick
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
      cur=$(( cur - ph + 6 ))
      (( cur < 1 )) && cur=1
      ;;
    pgdn)
      cur=$(( cur + ph - 6 ))
      (( cur > ${#rval} )) && cur=${#rval}
      (( cur < 1 )) && cur=1
      ;;
    ' ') [[ ${rtype[cur]} == hdr ]] && __tt_pv_toggle ;;
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
      (( ${#flt} >= (pw < 48 ? pw : 48) - 8 )) && return 0
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
  local pick="" pk=1 pkdef=1 picked=0 canpick=0
  local -a plabel=(" this tab " " default ")
  if [[ $mode == pin ]]; then
    canpick=1 pkdef=2 plabel=(" this directory " " and below ")
  elif (( $+functions[__tt_persist] )) && [[ $TTHEME_TAB_PALETTE == off ]]; then
    canpick=1
  fi
  __tt_pv_size
  local -a groups=() rtype=() rval=() rcnt=()
  local -A gnative=() gthemes=() exp=() hchip=() hnat=() tbody=()
  __tt_color && color=1
  __tt_pv_init
  __tt_pv_roll
  __tt_pv_rows
  [[ -n ${TTHEME_PALETTE[$cn]} ]] && __tt_pv_goto "$cn"
  printf '\e[?1049h\e[?7l\e[?25l'
  {
    while :; do
      __tt_pv_focus
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
    printf '\e[?7h\e[?1049l\e[?25h'
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
    elif [[ -n $orig && $orig != "$applied" ]]; then
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
  if [[ -n $TTHEME_SPEC ]]; then
    :
  elif [[ $TTHEME_TAB_PALETTE == off ]]; then
    __tt_bg=$(__tt_query_bg)
    if [[ -n $__tt_bg ]]; then
      for __k in ${(k)TTHEME_PALETTE}; do
        if [[ ${TTHEME_PALETTE[$__k]%% *} == $__tt_bg ]]; then
          TTHEME_SPEC=$TTHEME_PALETTE[$__k]
          break
        fi
      done
      [[ -n $TTHEME_SPEC ]] || TTHEME_SPEC="$__tt_bg ${TTHEME_PALETTE[neutral]#* }"
    else
      TTHEME_SPEC="- ${TTHEME_PALETTE[neutral]#* }"
    fi
    unset __tt_bg __k
  else
    __tt_next
    TTHEME_SPEC=$REPLY
    __tt_apply "$TTHEME_SPEC"
    unset REPLY
  fi

  __tt_dir_sync
  autoload -Uz add-zsh-hook
  add-zsh-hook chpwd __tt_chpwd
  __tt_announce
fi
