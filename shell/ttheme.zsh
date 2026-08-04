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
  if ! __tt_color; then
    print -r -- "$name · ANSI ${TTHEME_SRC[$name]:-unknown}"
    return 0
  fi
  local hex=${p[3]#\#}
  printf '\033[38;2;%d;%d;%dm●\033[0m %s \033[2m· ANSI %s\033[0m\n' \
    $((16#${hex:0:2})) $((16#${hex:2:2})) $((16#${hex:4:2})) \
    "$name" "${TTHEME_SRC[$name]:-unknown}"
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
  printf '\n\033[2mttheme <name> paints this tab · ttheme help\033[0m\n'
}

__tt_help() {
  print -r -- 'ttheme — character terminal palettes

  ttheme          list every palette, grouped, with previews
  ttheme homura   paint this tab (a unique prefix works: ttheme ho)
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

ttheme() {
  if (( ! $# )); then
    __tt_menu
    return 0
  fi

  case $1 in
    -h|--help|help) __tt_help; return 0 ;;
    next) __tt_rotate; return ;;
    current) __tt_current; return ;;
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
    (( CURRENT == 2 )) && compadd -- next current help
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
