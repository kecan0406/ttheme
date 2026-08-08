typeset -g TTHEME_HOME=${${(%):-%x}:A:h}

if [[ -r $TTHEME_HOME/palettes.zsh ]]; then
  source $TTHEME_HOME/palettes.zsh
elif [[ -r $TTHEME_HOME/../dist/shell/palettes.zsh ]]; then
  source $TTHEME_HOME/../dist/shell/palettes.zsh
else
  print -u2 "ttheme: palettes.zsh not found — run \`mise run build\` in the repo"
  return 1
fi

: ${TTHEME_TAB_PALETTE:=seq}

: ${TTHEME_ANNOUNCE:=1}

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
  printf '\033[48;2;%d;%d;%d;38;2;%d;%d;%dm ● \033[0m %-8s \033[2m· ANSI %s\033[0m%s\n' \
    $((16#${bg:0:2})) $((16#${bg:2:2})) $((16#${bg:4:2})) \
    $((16#${cur:0:2})) $((16#${cur:2:2})) $((16#${cur:4:2})) \
    "$name" "${TTHEME_SRC[$name]:-unknown}" "$marker"
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

__tt_menu() {
  local k cur="" mark grp last_grp=""
  if ! __tt_color; then
    for k in $TTHEME_ORDER; do
      printf '%s\t%s\t%s\n' "$k" "${TTHEME_GROUP[$k]:-Other}" "${TTHEME_SRC[$k]:-unknown}"
    done
    return 0
  fi
  [[ -n $TTHEME_SPEC ]] && cur=$(__tt_name_of "$TTHEME_SPEC")
  for k in $TTHEME_ORDER; do
    grp=${TTHEME_GROUP[$k]:-Other}
    if [[ $grp != $last_grp ]]; then
      printf '\033[1m%s\033[0m' "$grp"
      [[ -n ${TTHEME_NATIVE[$k]} ]] && printf ' \033[2m%s\033[0m' "${TTHEME_NATIVE[$k]}"
      printf '\n'
      last_grp=$grp
    fi
    mark=""
    [[ $k == $cur ]] && mark=" ← current"
    __tt_palette_line "$k" "$mark"
  done
  printf '\n\033[2mttheme <name> paints this tab · ttheme preview · ttheme help\033[0m\n'
}

__tt_help() {
  print -r -- 'ttheme — character terminal palettes

  ttheme          list every palette, grouped, with previews
  ttheme homura   paint this tab (a unique prefix works: ttheme ho)
  ttheme preview  browse live — focus repaints, enter keeps, esc restores
  ttheme next     advance this tab to the next palette
  ttheme current  what this tab is using (just the name when piped)

  TTHEME_TAB_PALETTE=off  new tabs inherit the window'\''s colors
  TTHEME_ANNOUNCE=0       silence the notice under "Last login:"'
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

__tt_current() {
  if [[ -z $TTHEME_SPEC ]]; then
    print -u2 "ttheme current: no palette assigned to this shell"
    return 1
  fi
  local name=$(__tt_name_of "$TTHEME_SPEC")
  if ! __tt_color; then
    print -r -- "$name"
  elif [[ -n ${TTHEME_PALETTE[$name]} ]]; then
    __tt_palette_line "$name"
  else
    print -r -- "custom	$TTHEME_SPEC"
  fi
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
  local h=$(( ph - 5 )) w=$pw i out line g arrow chunk hidden cnt hz="" seg vis mt=${#TTHEME_ORDER}
  local N=${#rval} rail=0 rl=0 rs=0 rthumb="█" rtrack="░" cmark="▶"
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
    fi
  else
    rthumb="#" rtrack="."
  fi
  if [[ -n $flt ]]; then
    local -a mm=(${(M)rtype:#thm})
    mt=${#mm}
  fi
  cnt="($mt/${#TTHEME_ORDER})"
  hz=${(l:$(( w - 2 ))::─:)hz}
  out=$'\e[H'
  if (( resized )); then
    out+=$'\e[2J'
    resized=0
  fi
  if (( color )); then
    line=$'\e[1m'"ttheme preview"$'\e[0m'" "$'\e[2m'$cnt$'\e[0m'
  else
    line="ttheme preview $cnt"
  fi
  out+=$line$'\e[K'
  if [[ -n ${TTHEME_PALETTE[$cn]} ]]; then
    if (( color )); then
      seg="$cdot $cn" vis=$(( ${#cn} + 2 ))
    else
      seg="current $cn" vis=$(( ${#cn} + 8 ))
    fi
    if (( w - vis + 1 > 17 + ${#cnt} )); then
      out+=$'\e['$(( w - vis + 1 ))G$seg
    fi
  fi
  out+=$'\n'
  out+="╭$hz╮"$'\e[K\n'
  if [[ -n $flt ]]; then
    line="│ ⌕ ${flt}_"
  elif (( color )); then
    line="│ ⌕ "$'\e[2m'"search…"$'\e[0m'
  else
    line="│ ⌕ search…"
  fi
  out+=$line$'\e[K'$'\e['${w}G"│"$'\n'
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
      else
        chunk=${hchip[$g]}
      fi
      if (( color )); then
        line="$arrow"$chunk" "$'\e[2m'"(${rcnt[i]})"$'\e[0m'${hnat[$g]}
      else
        line="$arrow"$chunk" (${rcnt[i]})"${hnat[$g]}
      fi
      if [[ -n ${TTHEME_PALETTE[$cn]} && ${TTHEME_GROUP[$cn]:-Other} == $g ]]; then
        hidden=1
        if [[ -n $flt ]]; then
          [[ $cn == *$flt* ]] && hidden=0
        elif [[ -n ${exp[$g]} ]]; then
          hidden=0
        fi
        if (( hidden )); then
          if (( color )); then
            line+=$cchip
          else
            line+=" · current"
          fi
        fi
      fi
    elif (( i == cur )); then
      line="  $cmark "${tbody[${rval[i]}]}
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
  line="↑↓ move · ←→ fold · type to filter · enter apply · esc restore"
  (( color )) && line=$'\e[2m'$line$'\e[0m'
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
  if [[ -n ${TTHEME_PALETTE[$cn]} ]] && (( color )); then
    local -a cp=(${=TTHEME_PALETTE[$cn]})
    local ch=${cp[3]#\#}
    printf -v cdot '\e[38;2;%d;%d;%dm*\e[0m' \
      $((16#${ch:0:2})) $((16#${ch:2:2})) $((16#${ch:4:2}))
    printf -v cchip ' \e[7;1;38;2;%d;%d;%dm current \e[0m' \
      $((16#${ch:0:2})) $((16#${ch:2:2})) $((16#${ch:4:2}))
  fi
  local body nat
  for g in $groups; do
    nat=${gnative[$g]}
    if (( color )); then
      local -a gp=(${=TTHEME_PALETTE[${${=gthemes[$g]}[1]}]})
      local sb=${gp[4]#\#}
      printf -v body '\e[48;2;%d;%d;%dm %s \e[0m' \
        $((16#${sb:0:2})) $((16#${sb:2:2})) $((16#${sb:4:2})) "$g"
      hchip[$g]=$body
      hnat[$g]=${nat:+" "$'\e[2m'$nat$'\e[0m'}
    else
      hchip[$g]=" $g"
      hnat[$g]=${nat:+" $nat"}
    fi
  done
  local t mark sw sc j
  for t in $TTHEME_ORDER; do
    mark=""
    if [[ $t == $cn ]]; then
      if (( color )); then
        mark=$cchip
      else
        mark=" ← current"
      fi
    fi
    if (( color )); then
      local -a tp=(${=TTHEME_PALETTE[$t]})
      local bg=${tp[1]#\#} cu=${tp[3]#\#}
      sw=""
      for j in 6 7 8 9 10 11; do
        sc=${tp[j]#\#}
        printf -v sc '\e[38;2;%d;%d;%dm▄' $((16#${sc:0:2})) $((16#${sc:2:2})) $((16#${sc:4:2}))
        sw+=$sc
      done
      printf -v body '\e[48;2;%d;%d;%d;38;2;%d;%d;%dm ● \e[0m %-13s %s\e[0m  \e[2m%s\e[0m%s' \
        $((16#${bg:0:2})) $((16#${bg:2:2})) $((16#${bg:4:2})) \
        $((16#${cu:0:2})) $((16#${cu:2:2})) $((16#${cu:4:2})) \
        "$t" "$sw" "${TTHEME_SRC[$t]:-unknown}" "$mark"
    else
      printf -v body '● %-13s · %s%s' "$t" "${TTHEME_SRC[$t]:-unknown}" "$mark"
    fi
    tbody[$t]=$body
  done
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
  while ! read -sk 1 -t 0.2 2>/dev/null; do
    [[ -t 0 ]] || return 1
    __tt_pv_size && return 1
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

__tt_pv_handle() {
  local name
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
        sel=${rval[cur]}
        return 1
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
      (( ${#flt} >= pw - 8 )) && return 0
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
  if [[ ! -t 0 || ! -t 1 ]]; then
    print -u2 "ttheme preview: needs a terminal"
    return 1
  fi
  local orig=$TTHEME_SPEC applied=$TTHEME_SPEC flt="" sel="" cn="" cdot="" cchip="" key="" REPLY="" cur=1 top=1 color=0 pw=80 ph=24 resized=1
  __tt_pv_size
  local -a groups=() rtype=() rval=() rcnt=()
  local -A gnative=() gthemes=() exp=() hchip=() hnat=() tbody=()
  __tt_color && color=1
  __tt_pv_init
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
    current) __tt_current; return ;;
    preview) __tt_preview; return ;;
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
    (( CURRENT == 2 )) && compadd -- preview next current help
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

  __tt_announce
fi
