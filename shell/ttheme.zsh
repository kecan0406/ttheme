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

: ${TTHEME_WARN_PATTERN:='(prod|production|infra|terraform|k8s|deploy)'}

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

__tt_record() {
  [[ -n $TTY ]] || return 0
  mkdir -p $TTHEME_STATE_DIR 2>/dev/null || return 0
  print -r -- "$(__tt_name_of "$TTHEME_SPEC")	$TTHEME_SPEC	$$" \
    > $TTHEME_STATE_DIR/${TTY:t} 2>/dev/null
}

__tt_unrecord() {
  [[ -n $TTY ]] && rm -f $TTHEME_STATE_DIR/${TTY:t} 2>/dev/null
}

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
  local hex=${p[3]#\#}
  printf '\033[38;2;%d;%d;%dm●\033[0m %s \033[2m· ANSI %s\033[0m\n' \
    $((16#${hex:0:2})) $((16#${hex:2:2})) $((16#${hex:4:2})) \
    "$name" "${TTHEME_SRC[$name]:-unknown}"
}

__tt_menu() {
  local k cur="" mark grp last_grp=""
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
    print -u2 "multiple palettes start with '$name': ${(o)m}"
  else
    print -u2 "unknown palette '$name' — pick one below:"
    __tt_menu >&2
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

tnow() {
  if [[ -z $TTHEME_SPEC ]]; then
    print -u2 "tnow: no palette assigned to this shell"
    return 1
  fi
  local name=$(__tt_name_of "$TTHEME_SPEC")
  if [[ -n ${TTHEME_PALETTE[$name]} ]]; then
    __tt_palette_line "$name"
  else
    print -r -- "custom	$TTHEME_SPEC"
  fi
}

tlist() {
  local f name spec pid mark
  [[ -d $TTHEME_STATE_DIR ]] || { print -u2 "tlist: no recorded tabs"; return 1 }
  for f in $TTHEME_STATE_DIR/*(N:t); do
    if [[ ! -e /dev/$f ]]; then
      rm -f $TTHEME_STATE_DIR/$f
      continue
    fi
    IFS=$'\t' read -r name spec pid < $TTHEME_STATE_DIR/$f
    if ! kill -0 $pid 2>/dev/null; then
      rm -f $TTHEME_STATE_DIR/$f
      continue
    fi
    mark=""
    [[ $f == ${TTY:t} ]] && mark=" ← this tab"
    printf '%-8s ' "$f"
    if [[ -n ${TTHEME_PALETTE[$name]} ]]; then
      __tt_palette_line "$name" "$mark"
    else
      printf '%-8s %s%s\n' "$name" "$spec" "$mark"
    fi
  done
}

ttheme() {
  local all=0
  if [[ $1 == --all ]]; then
    all=1
    shift
  fi

  if (( ! $# )); then
    (( all )) && { print -u2 "ttheme --all: needs a palette name"; return 1 }
    __tt_menu
    return 0
  fi

  local REPLY
  __tt_resolve "$1" || return 1
  local spec=${TTHEME_PALETTE[$REPLY]}

  if (( all )); then
    __tt_apply_all "$spec" || return 1
  else
    __tt_apply "$spec"
  fi

  TTHEME_SPEC=$spec
  TTHEME_WARN_ON=0
  __tt_record
  __tt_announce
}

troll() {
  if [[ $TTHEME_TAB_PALETTE == off ]]; then
    print -u2 "troll: TTHEME_TAB_PALETTE is off"
    return 1
  fi
  local REPLY
  __tt_next
  __tt_apply "$REPLY"
  TTHEME_SPEC=$REPLY
  TTHEME_WARN_ON=0
  __tt_record
  __tt_announce
}

tw() {
  local REPLY name=neutral
  if (( $# )); then
    __tt_resolve "$1" || return 1
    name=$REPLY
    shift
  fi
  __tt_new_window "$name" "$@"
}

__tt_guard() {
  [[ -n $TTHEME_SPEC ]] || return 0

  local want=0
  [[ ${PWD:l} =~ $TTHEME_WARN_PATTERN ]] && want=1
  (( want == TTHEME_WARN_ON )) && return 0
  TTHEME_WARN_ON=$want

  local spec
  if (( want )); then
    spec=$(__tt_spec "$TTHEME_WARN_PALETTE") || return 0
    (( TTHEME_ANNOUNCE )) &&
      printf '\033[2m⚠ warning colors — %s matches TTHEME_WARN_PATTERN\033[0m\n' "$PWD"
  else
    spec=$TTHEME_SPEC
    (( TTHEME_ANNOUNCE )) &&
      printf '\033[2m↩ left the warning area — restoring the palette\033[0m\n'
  fi
  [[ ${TTHEME_SPEC%% *} == - ]] && spec="- ${spec#* }"
  __tt_apply "$spec"
}

if (( $+functions[compdef] )); then
  __tt_complete() { compadd -- $TTHEME_ORDER }
  compdef __tt_complete ttheme tw
fi

if __tt_active; then
  typeset -g TTHEME_WARN_ON=${TTHEME_WARN_ON:-0}

  if [[ -n $TTHEME_SPEC ]]; then
    :
  elif [[ -n $TTHEME_START && -n ${TTHEME_PALETTE[$TTHEME_START]} ]]; then
    TTHEME_SPEC=${TTHEME_PALETTE[$TTHEME_START]}
    __tt_apply "$TTHEME_SPEC"
    unset TTHEME_START
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

  __tt_record
  __tt_announce

  autoload -Uz add-zsh-hook
  add-zsh-hook chpwd __tt_guard
  add-zsh-hook zshexit __tt_unrecord
  __tt_guard
fi
