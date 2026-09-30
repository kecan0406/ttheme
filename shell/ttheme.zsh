typeset -g TTHEME_HOME=${${(%):-%x}:A:h} TTHEME_PALETTES_AT=""

zmodload -F zsh/stat b:zstat 2>/dev/null

__tt_palettes_load() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  local -a at
  unset TTHEME_PALETTE TTHEME_GROUP TTHEME_CATALOG TTHEME_NATIVE TTHEME_SRC
  source $TTHEME_HOME/palettes.zsh || return 1
  zstat -F %s.%N -A at +mtime -- $TTHEME_HOME/palettes.zsh 2>/dev/null
  TTHEME_PALETTES_AT=$at[1]
}

__tt_fresh() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  local -a at
  local was=$TTHEME_STARTUP start="$TTHEME_STARTUP ${TTHEME_PALETTE[$TTHEME_STARTUP]}"
  if ! zstat -F %s.%N -A at +mtime -- $TTHEME_HOME/palettes.zsh 2>/dev/null; then
    [[ -e $TTHEME_HOME ]] || __tt_gone
    return 0
  fi
  if [[ $at[1] != "$TTHEME_PALETTES_AT" ]]; then
    __tt_palettes_load && { __tt_follow "$start" && __tt_sync; __tt_reloaded }
    [[ -n $was && -z $TTHEME_STARTUP && -n $TTHEME_SPEC ]] && __tt_active && __tt_off_here
  fi
  at=("")
  zstat -F %s.%N -A at +mtime -- $TTHEME_PINS_FILE 2>/dev/null
  [[ $at[1] == "$TTHEME_PINS_AT" ]] && return 0
  __tt_pins_load
  __tt_active && __tt_dir_sync
}

__tt_prompt() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  (( TTHEME_FRONT < 0 )) || TTHEME_FRONT=0
  __tt_fresh
}

__tt_follow() {
  [[ -n $TTHEME_STARTUP && "$TTHEME_STARTUP ${TTHEME_PALETTE[$TTHEME_STARTUP]}" != "$1" && -z $TTHEME_PAINTED ]] || return 1
  __tt_active && __tt_takes_default || return 1
  TTHEME_SPEC=${TTHEME_PALETTE[$TTHEME_STARTUP]}
}

__tt_gone() {
  local bg=${TTHEME_SPEC%% *} hook
  TTHEME_SPEC=
  __tt_reload
  __tt_reset_reloaded $bg
  print -n $'\e[?1004l'
  for hook in precmd:__tt_prompt precmd:__tt_precmd precmd:__tt_prompted precmd:__tt_unmux preexec:__tt_preexec preexec:__tt_mux chpwd:__tt_chpwd; do
    add-zsh-hook -d ${hook%%:*} ${hook#*:}
  done
  (( $+functions[add-zle-hook-widget] )) && add-zle-hook-widget -d line-init __tt_line_init
  unfunction ttheme
}

__tt_off_here() {
  local bg=${TTHEME_SPEC%% *}
  TTHEME_SPEC=
  if __tt_shown "" || [[ $1 == reload ]]; then
    __tt_reload
  fi
  __tt_unshown force
  __tt_reset_reloaded $bg
}

if [[ -r $TTHEME_HOME/palettes.zsh ]]; then
  __tt_palettes_load
else
  print -u2 "ttheme: palettes.zsh not found — run \`npx @kecan0406/ttheme@latest init\`"
  return 1
fi

typeset -g TTHEME_CONFIG=${XDG_CONFIG_HOME:-$HOME/.config}/ttheme/config.zsh

[[ -r $TTHEME_CONFIG ]] && source $TTHEME_CONFIG

typeset -g TTHEME_PINS_FILE=${TTHEME_CONFIG:h}/pins
typeset -g TTHEME_PINS_RAW="" TTHEME_PINS_AT=""
typeset -gA TTHEME_PINS=()
typeset -g TTHEME_PIN="" TTHEME_PIN_SPEC="" TTHEME_BASE_SPEC=""

__tt_tilde() { REPLY=${1/#$HOME\//\~/} }

__tt_pins_load() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  setopt localoptions extendedglob
  local raw="" line key name
  local -a at=("")
  zstat -F %s.%N -A at +mtime -- $TTHEME_PINS_FILE 2>/dev/null
  TTHEME_PINS_AT=$at[1]
  [[ -r $TTHEME_PINS_FILE ]] && raw="$(<$TTHEME_PINS_FILE)"
  [[ $raw == "$TTHEME_PINS_RAW" ]] && return 0
  TTHEME_PINS_RAW=$raw
  TTHEME_PINS=()
  for line in "${(@f)raw}"; do
    line=${line%%[[:space:]]##}
    [[ $line == [~/]*[[:space:]]* ]] || continue
    name=${line##*[[:space:]]} key=${${line%[[:space:]]*}%%[[:space:]]##}
    [[ $key == \~ ]] && key=$HOME
    TTHEME_PINS[${key/#\~\//$HOME/}]=$name
    [[ -n ${TTHEME_PALETTE[$name]} ]] || print -u2 "ttheme: unknown palette '$name' pinned to $key"
  done
}

__tt_pins_load

: ${TTHEME_TAB_PALETTE:=off}

: ${TTHEME_ANNOUNCE:=1}

: ${TTHEME_FX:=typewriter}

: ${TTHEME_SORT:=abc}

: ${TTHEME_BG_BLUR:=0}

: ${TTHEME_BG_COLORS:=tone}

: ${TTHEME_WARP_FAST:=on}

typeset -g TTHEME_STATE_DIR=${XDG_STATE_HOME:-$HOME/.local/state}/ttheme

() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  if [[ $TERM_PROGRAM == WarpTerminal ]]; then
    typeset -g TTHEME_ADAPTER=warp
  elif [[ -n $GHOSTTY_RESOURCES_DIR || $TERM_PROGRAM == ghostty ]]; then
    typeset -g TTHEME_ADAPTER=ghostty
  elif [[ -n $KITTY_WINDOW_ID ]]; then
    typeset -g TTHEME_ADAPTER=kitty
  elif [[ -n $WEZTERM_PANE ]]; then
    typeset -g TTHEME_ADAPTER=wezterm
  elif [[ -n $ALACRITTY_WINDOW_ID ]]; then
    typeset -g TTHEME_ADAPTER=alacritty
  elif [[ -n $KONSOLE_VERSION ]]; then
    typeset -g TTHEME_ADAPTER=konsole
  elif [[ -n $ITERM_SESSION_ID || $TERM_PROGRAM == iTerm.app ]]; then
    typeset -g TTHEME_ADAPTER=iterm2
  elif [[ $TERM_PROGRAM == Apple_Terminal ]]; then
    typeset -g TTHEME_ADAPTER=terminal-app
  elif [[ -n $WT_SESSION && -z $TERM_PROGRAM ]]; then
    typeset -g TTHEME_ADAPTER=windows-terminal
  elif [[ $TERM == foot* ]]; then
    typeset -g TTHEME_ADAPTER=foot
  else
    typeset -g TTHEME_ADAPTER=unknown
  fi
}

typeset -g TTHEME_TMUX=0 TTHEME_MUXED=0

__tt_tmux() {
  [[ $(tmux if -t "$TMUX_PANE" -F '#{==:#{allow-passthrough},off}' 'set -p allow-passthrough on' \; set -sq focus-events on \; display -p '#{client_control_mode}' 2>/dev/null) == 1 ]] && return 0
  TTHEME_TMUX=1 TTHEME_SPEC=
}

__tt_active() {
  [[ -o interactive ]] || return 1
  (( ${#TTHEME_PALETTE} )) || return 1
  [[ -n $TTHEME_FORCE ]] || { [[ $TTHEME_ADAPTER != unknown ]] && __tt_paints }
}

typeset -g TTHEME_HEARD=""
typeset -gi TTHEME_RECHECK=0 TTHEME_FOCUS=0 TTHEME_FRONT=-1

__tt_put() {
  local f=${1:A}
  shift
  if zmodload -F zsh/files b:zf_mv 2>/dev/null; then
    print -rl -- "$@" >| $f.$$ && zf_mv -f -- $f.$$ $f && return 0
  else
    print -rl -- "$@" >| $f.$$ && command mv -f -- $f.$$ $f && return 0
  fi
  command rm -f -- $f.$$ 2>/dev/null
  return 1
}

__tt_recall() {
  local f=$TTHEME_STATE_DIR/colors.$TTHEME_ADAPTER line
  REPLY=""
  [[ -o zle && -r $f && -z $TTHEME_PAINTED && $TTHEME_TAB_PALETTE == off ]] && (( ! TTHEME_TMUX )) && __tt_active || return 1
  line=$(<$f)
  [[ $line == "${TTHEME_STARTUP:--} "?* ]] || return 1
  REPLY=${line#* }
}

__tt_remember() {
  local f=$TTHEME_STATE_DIR/colors.$TTHEME_ADAPTER line="${TTHEME_STARTUP:--} $1"
  [[ -n $1 && -z $TTHEME_PAINTED ]] && (( ! TTHEME_TMUX )) || return 0
  [[ -r $f && "$(<$f)" == "$line" ]] && return 0
  [[ -d $TTHEME_STATE_DIR ]] || mkdir -p $TTHEME_STATE_DIR 2>/dev/null
  __tt_put $f "$line" 2>/dev/null
}

__tt_listen() {
  local REPLY
  if __tt_recall; then
    TTHEME_RECHECK=1
  else
    __tt_hear || return 1
    __tt_remember "$REPLY"
  fi
  TTHEME_HEARD=$REPLY
  __tt_heard "$REPLY"
}

__tt_wearing() {
  local k
  [[ -n $1 ]] || return 1
  [[ -n $TTHEME_STARTUP && ${TTHEME_PALETTE[$TTHEME_STARTUP]%% *} == "$1" ]] && { REPLY=$TTHEME_PALETTE[$TTHEME_STARTUP]; return 0 }
  for k in ${(k)TTHEME_PALETTE}; do
    [[ ${TTHEME_PALETTE[$k]%% *} == "$1" ]] && { REPLY=$TTHEME_PALETTE[$k]; return 0 }
  done
  return 1
}

__tt_recheck() {
  local REPLY heard=$TTHEME_HEARD was="" now
  TTHEME_RECHECK=0
  [[ -z $TTHEME_PAINTED ]] && __tt_hear || return 0
  [[ $REPLY == "$heard" ]] && return 0
  now=$REPLY
  __tt_remember "$now"
  TTHEME_HEARD=$now
  __tt_heard "$now"
  [[ $TTHEME_TAB_PALETTE == off ]] || return 0
  __tt_wearing "${heard%% *}" && was=$REPLY
  REPLY=""
  __tt_wearing "${now%% *}"
  if [[ -n $TTHEME_PIN ]]; then
    [[ $TTHEME_BASE_SPEC == "$was" ]] && TTHEME_BASE_SPEC=$REPLY
  elif [[ $TTHEME_SPEC == "$was" ]]; then
    TTHEME_SPEC=$REPLY
    __tt_sync
  fi
}

source $TTHEME_HOME/adapters/_osc.zsh
source $TTHEME_HOME/adapters/_wired.zsh
[[ -r $TTHEME_HOME/adapters/$TTHEME_ADAPTER.zsh ]] &&
  source $TTHEME_HOME/adapters/$TTHEME_ADAPTER.zsh

__tt_empty() {
  print -u2 'ttheme: no palettes installed yet — run `ttheme browse` to pick some'
  return 1
}

__tt_spec() {
  local spec=${TTHEME_PALETTE[$1]}
  [[ -n $spec ]] || return 1
  print -r -- "$spec"
}

__tt_name_of() { REPLY=${${(k)TTHEME_PALETTE[(re)$1]}:-custom} }

__tt_color() { [[ -t 1 && -z $NO_COLOR && $TERM != dumb ]] }

__tt_palette_line() {
  local name=$1 width=$2 on=$3 label=${4:-$1} hex cell="" bar=""
  local -a p=(${=TTHEME_PALETTE[$name]}) sw=(${=TTHEME_SWATCH[$name]})
  (( ${#p} >= 20 )) || return 1
  for hex in $sw; do
    hex=${hex#\#}
    cell+=$'\e[38;2;'$((16#${hex:0:2}))';'$((16#${hex:2:2}))';'$((16#${hex:4:2}))'m■ '
  done
  if [[ -n $on ]]; then
    local cur=${p[3]#\#} sel=${p[4]#\#} fg=${p[2]#\#} ac
    printf -v ac '\e[38;2;%d;%d;%dm' $((16#${cur:0:2})) $((16#${cur:2:2})) $((16#${cur:4:2}))
    printf -v bar '\e[48;2;%d;%d;%d;38;2;%d;%d;%dm' \
      $((16#${sel:0:2})) $((16#${sel:2:2})) $((16#${sel:4:2})) $((16#${fg:0:2})) $((16#${fg:2:2})) $((16#${fg:4:2}))
    printf '%s▌\e[39m %s %s■\e[39m \e[1m%-*s\e[22m  %s\e[0m\n' "$ac" "$bar" "$ac" "$width" "$label" "$cell"
  else
    printf '     %-*s  %s\e[0m\n' "$width" "$label" "$cell"
  fi
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
      [[ $p == "$base" || $p == "${base%/}"/* ]] || continue
    else
      [[ $p == "$base" ]] || continue
    fi
    (( ${#base} > bestlen )) || [[ ${#base} == $bestlen && $k != *"/**" ]] || continue
    best=$k bestlen=${#base}
  done
  [[ -n $best ]] || return 1
  REPLY=$best
}

__tt_dir_sync() {
  local REPLY="" spec=""
  __tt_dir_rule "$PWD" || REPLY=""
  if [[ -n $REPLY ]]; then
    spec=${TTHEME_PALETTE[$TTHEME_PINS[$REPLY]]}
    [[ $REPLY == "$TTHEME_PIN" && $spec == "$TTHEME_PIN_SPEC" ]] && return 0
    [[ -n $TTHEME_PIN ]] || TTHEME_BASE_SPEC=$TTHEME_SPEC
  else
    [[ -n $TTHEME_PIN ]] || return 0
    if [[ $TTHEME_SPEC == "$TTHEME_PIN_SPEC" ]]; then
      spec=$TTHEME_BASE_SPEC
      [[ -n $spec ]] || { __tt_osc_reset; TTHEME_SPEC= }
    fi
  fi
  TTHEME_PIN=$REPLY TTHEME_PIN_SPEC=$spec
  [[ -n $spec && $spec != "$TTHEME_SPEC" ]] || return 0
  __tt_wear "$spec"
  return 0
}

__tt_chpwd() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  __tt_pins_load
  __tt_dir_sync
}

__tt_worn_shown() {
  local REPLY
  [[ -n $TTHEME_SPEC ]] || return 1
  __tt_name_of "$TTHEME_SPEC"
  [[ -n ${TTHEME_PALETTE[$REPLY]} ]] || return 1
  __tt_shown "$REPLY" $1
}

__tt_sync() { ! __tt_worn_shown || __tt_reload }

__tt_precmd() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  __tt_sync
}

__tt_focus_on() { printf '\e[?1004h' }

__tt_preexec() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  printf '\e[?1004l'
}

__tt_rewear() {
  __tt_repaint
  if [[ -n $TTHEME_SPEC ]]; then
    __tt_worn_shown $1 && __tt_reload
  else
    __tt_unshown $1
  fi
  return 0
}

__tt_focus() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  TTHEME_FRONT=1
  __tt_fresh
  if (( TTHEME_TMUX )); then
    __tt_rewear
  else
    __tt_sync
  fi
}

__tt_mux() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  [[ ${${(z)3}[1]:t} == tmux ]] && TTHEME_MUXED=1
}

__tt_unmux() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  (( TTHEME_MUXED )) || return 0
  __tt_rewear force
  TTHEME_MUXED=0
}

__tt_blur() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  TTHEME_FRONT=0
  __tt_blurred
}

__tt_line_init() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  (( TTHEME_RECHECK )) && __tt_recheck
  __tt_typed
  (( TTHEME_FOCUS )) && __tt_focus_on
}

__tt_bind_focus() {
  local k
  zle -N __tt_focus
  zle -N __tt_blur
  TTHEME_FOCUS=1
  for k in emacs viins vicmd; do
    bindkey -M $k '^[[I' __tt_focus
    bindkey -M $k '^[[O' __tt_blur
  done
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
    TTHEME_PINS_RAW="" TTHEME_PINS_AT=""
    return 0
  fi
  mkdir -p ${TTHEME_PINS_FILE:h} || return 1
  __tt_put $TTHEME_PINS_FILE "${lines[@]}" || return 1
  TTHEME_PINS_RAW="$(<$TTHEME_PINS_FILE)"
  local -a at
  zstat -F %s.%N -A at +mtime -- $TTHEME_PINS_FILE 2>/dev/null && TTHEME_PINS_AT=$at[1]
}

__tt_pin_base() { REPLY=${${${1%/\*\*}:-/}:a} }

__tt_dir_label() {
  if [[ $1 == "${HOME:a}" ]]; then
    REPLY='~'
  else
    __tt_tilde "$1"
  fi
}

__tt_pin_scope() {
  if [[ $1 == *"/**" ]]; then
    REPLY="and below"
  else
    REPLY="this directory"
  fi
}

__tt_repo() {
  local at=${1:a}
  while [[ $at != / ]]; do
    [[ -e $at/.git ]] && break
    at=${at:h}
  done
  [[ $at != / && $at != "${HOME:a}" ]] || return 1
  REPLY=$at
}

__tt_pin_cover() {
  local k b best=""
  local -i len=-1
  for k in ${(k)TTHEME_PINS}; do
    [[ $k == /* && $k == *"/**" && -n ${TTHEME_PALETTE[$TTHEME_PINS[$k]]} ]] || continue
    __tt_pin_base "$k"
    b=$REPLY
    [[ $1 == "$b" || $1 == "${b%/}"/* ]] || continue
    (( ${#b} > len )) && { best=$k len=${#b} }
  done
  [[ -n $best ]] || return 1
  REPLY=$best
}

__tt_pin_scopes() {
  local d=${1:a} k
  plabel=(" This directory " " And below ") pkeys=("$d" "${d%/}/**") pkdef=2
  if __tt_repo "$d" && [[ $REPLY != "$d" ]]; then
    plabel+=(" Repository ") pkeys+=("$REPLY/**")
  fi
  for k in ${(k)TTHEME_PINS}; do
    [[ $k == /* ]] || continue
    __tt_pin_base "$k"
    [[ $REPLY == "$d" ]] || continue
    if [[ $k == *"/**" ]]; then pkdef=2; else pkdef=1; fi
  done
}

__tt_pin_save() {
  local name=$1 key=$2 k base spec REPLY
  __tt_pin_base "$key"
  base=$REPLY
  for k in ${(k)TTHEME_PINS}; do
    [[ $k == /* ]] || continue
    __tt_pin_base "$k"
    [[ $REPLY == "$base" ]] && unset "TTHEME_PINS[$k]"
  done
  TTHEME_PINS[$key]=$name
  if ! __tt_pins_write; then
    print -u2 "ttheme pin: could not write $TTHEME_PINS_FILE"
    return 1
  fi
  [[ -n $TTHEME_PIN ]] || TTHEME_BASE_SPEC=$3
  if __tt_dir_rule "$PWD"; then
    spec=${TTHEME_PALETTE[$TTHEME_PINS[$REPLY]]}
    TTHEME_PIN=$REPLY TTHEME_PIN_SPEC=$spec
  else
    spec=$TTHEME_BASE_SPEC
    TTHEME_PIN="" TTHEME_PIN_SPEC=""
  fi
  if [[ $spec != "$TTHEME_SPEC" ]]; then
    if [[ -n $spec ]]; then
      __tt_wear "$spec"
    else
      __tt_osc_reset
      TTHEME_SPEC=
    fi
  fi
  __tt_dir_label "$base"
  k=$REPLY
  __tt_pin_scope "$key"
  if __tt_color; then
    printf '\033[2mPinned · %s → %s · %s\033[0m\n' "$name" "$k" "$REPLY"
  else
    print -r -- "Pinned · $name → $k · $REPLY"
  fi
  if [[ $TTHEME_PIN != "$key" ]]; then
    __tt_here_line Here
    print -r -- "$REPLY"
  fi
}

__tt_unpin_drop() {
  local k REPLY where
  local -a gone=()
  for k in "$@"; do
    [[ -n ${TTHEME_PINS[$k]} ]] || continue
    __tt_pin_base "$k"
    __tt_dir_label "$REPLY"
    where=$REPLY
    __tt_pin_scope "$k"
    gone+=("Unpinned · ${TTHEME_PINS[$k]} on $where · $REPLY")
    unset "TTHEME_PINS[$k]"
  done
  if ! __tt_pins_write; then
    print -u2 "ttheme unpin: could not write $TTHEME_PINS_FILE"
    return 1
  fi
  __tt_dir_sync
  for k in $gone; do
    if __tt_color; then
      print -r -- $'\e[2m'"$k"$'\e[0m'
    else
      print -r -- "$k"
    fi
  done
  __tt_here_line Here
  print -r -- "$REPLY"
}

__tt_unpin_then() {
  local k
  local -A TTHEME_PINS=("${(@kv)TTHEME_PINS}")
  for k in "${@:2}"; do
    unset "TTHEME_PINS[$k]"
  done
  __tt_here_fit "Then here" $1
}

__tt_key() {
  local c seq=""
  REPLY=""
  read -sk 1 c || return 1
  case $c in
    $'\e')
      if ! read -sk 1 -t 0.05 c; then
        REPLY=esc
      elif [[ $c == '[' || $c == O ]]; then
        while read -sk 1 -t 0.05 c; do
          seq+=$c
          [[ $c == [A-Za-z~] ]] && break
        done
        case $seq in
          C) REPLY=right ;;
          D) REPLY=left ;;
          Z) REPLY=stab ;;
          *) REPLY=nop ;;
        esac
      else
        REPLY=nop
      fi
      ;;
    $'\t') REPLY=tab ;;
    $'\r'|$'\n') REPLY=enter ;;
    q|$'\x03') REPLY=esc ;;
    *) REPLY=$c ;;
  esac
}

__tt_unpin_block() {
  local b=$'\e[1m' d=$'\e[2m' z=$'\e[0m' on=$'\e[7;1m' bar plain keys top k home=${HOME:a} here=${PWD:a} htip="" REPLY
  local -A own=() below=() parent=() mark=() tstrip=()
  local -a roots=() lp=() lpw=() ll=() lat=() lpal=() lnote=() lflag=() reply gone=(${(f)drops[$1]})
  local -i i width=$(( (COLUMNS > 0 ? COLUMNS : 80) - 1 )) room=$(( (LINES > 0 ? LINES : 24) - 3 ))
  (( color )) || b= d= z= on=
  if (( color )); then
    bar=$'\e[7;1m UNPIN \e[0m ' plain="  UNPIN  "
  else
    bar="[UNPIN]" plain=$bar
  fi
  for (( i = 1; i <= ${#lab}; i++ )); do
    plain+=" ${lab[i]}"
    if (( i != $1 )); then
      bar+=" "$d${lab[i]}$z
    elif (( color )); then
      bar+=" "$on${lab[i]}$z
    else
      bar+=" [${${lab[i]# }% }]"
    fi
  done
  keys="←→ choose · enter unpin · esc keep"
  (( ${(m)#plain} + 3 + ${(m)#keys} <= width )) && bar+="   "$d$keys$z
  __tt_clip "$bar" $width
  bar=$REPLY
  for k in $gone; do
    __tt_pin_base "$k"
    mark[$REPLY]=drop
  done
  top=${PWD:a}
  [[ -n $cover ]] && __tt_pin_base "$cover" && top=$REPLY
  __tt_map_build "$top"
  __tt_map_fit $width
  (( ${#reply} > room )) && reply=("${(@)reply[1,room-1]}" "   …")
  block=("$bar" "${reply[@]}")
  __tt_unpin_then $width $gone
  block+=("${reply[@]}")
}

__tt_unpin_paint() {
  local out=$'\r'
  (( $1 > 1 )) && out+=$'\e['$(( $1 - 1 ))'A'
  out+=${(pj:\e[K\n:)block}$'\e[K\e[J'
  print -rn -- "$out"
}

__tt_unpin_choose() {
  local tty="" REPLY
  local -i n=0 at=1
  local -a block=()
  chosen=0
  {
    tty=$(stty -g 2>/dev/null && stty -echo -icanon min 1 time 0 2>/dev/null)
    print -rn -- $'\e[?25l'
    while :; do
      __tt_unpin_block $at
      __tt_unpin_paint $n
      n=${#block}
      __tt_key || break
      case $REPLY in
        left|stab) at=$(( (at + ${#lab} - 2) % ${#lab} + 1 )) ;;
        right|tab) at=$(( at % ${#lab} + 1 )) ;;
        enter) chosen=$at; break ;;
        esc) break ;;
      esac
    done
  } always {
    REPLY=$'\r'
    (( n > 1 )) && REPLY+=$'\e['$(( n - 1 ))'A'
    print -rn -- "$REPLY"$'\e[J\e[?25h'
    [[ -n $tty ]] && stty "$tty" 2>/dev/null
  }
  (( chosen ))
}

__tt_unpin_options() {
  local d=${PWD:a} k REPLY
  local -a both
  mine=() under=() lab=() drops=() cover=""
  for k in ${(k)TTHEME_PINS}; do
    [[ $k == /* ]] || continue
    __tt_pin_base "$k"
    if [[ $REPLY == "$d" ]]; then
      mine+=("$k")
    elif [[ $REPLY == "${d%/}"/* ]]; then
      under+=("$k")
    fi
  done
  [[ $d != / ]] && __tt_pin_cover "${d:h}" && cover=$REPLY
  if (( ${#mine} )); then
    lab+=(" This directory ") drops+=("${(pj:\n:)mine}")
  fi
  if (( ${#under} )); then
    both=($mine $under)
    lab+=(" And below ") drops+=("${(pj:\n:)both}")
  fi
  if [[ -n $cover ]]; then
    __tt_pin_base "$cover"
    __tt_dir_label "$REPLY"
    lab+=(" $REPLY ") drops+=("$cover")
  fi
  return 0
}

__tt_unpin() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  local d k cover="" REPLY
  local -a mine=() under=() lab=() drops=()
  local -i chosen=0 color=0
  __tt_color && color=1
  __tt_pins_load
  if (( $# )); then
    d=$1
    [[ $d == \~ || $d == \~/* ]] && d=$HOME${d#\~}
    d=${d:a}
    for k in ${(k)TTHEME_PINS}; do
      [[ $k == /* ]] || continue
      __tt_pin_base "$k"
      [[ $REPLY == "$d" ]] && mine+=("$k")
    done
    if (( ${#mine} )); then
      __tt_unpin_drop $mine
      return
    fi
    __tt_dir_label "$d"
    k=$REPLY
    if __tt_pin_cover "$d"; then
      __tt_pin_base "$REPLY"
      __tt_dir_label "$REPLY"
      print -u2 -r -- "ttheme unpin: nothing pinned to $k — the pin on $REPLY and below covers it"
    else
      print -u2 -r -- "ttheme unpin: nothing pinned to $k"
    fi
    return 1
  fi
  __tt_unpin_options
  if (( ! ${#lab} )); then
    print -u2 "ttheme unpin: nothing pinned here"
    return 1
  fi
  if (( ${#lab} == 1 && ${#mine} )); then
    __tt_unpin_drop $mine
    return
  fi
  if [[ ! -t 0 || ! -t 1 ]]; then
    if (( ${#mine} )); then
      __tt_unpin_drop $mine
      return
    fi
    if [[ -n $cover ]]; then
      __tt_pin_base "$cover"
      __tt_dir_label "$REPLY"
      print -u2 -r -- "ttheme unpin: nothing pinned here — the pin on $REPLY and below covers it: ttheme unpin $REPLY"
    elif (( ${#under} == 1 )); then
      print -u2 -r -- "ttheme unpin: nothing pinned here — 1 pin below it: ttheme pins maps it"
    else
      print -u2 -r -- "ttheme unpin: nothing pinned here — ${#under} pins below it: ttheme pins maps them"
    fi
    return 1
  fi
  __tt_unpin_choose || return 1
  __tt_unpin_drop ${(f)drops[chosen]}
}

__tt_clip() {
  local c out=""
  local -i i n=${#1} w=0 cw
  REPLY=$1
  for (( i = 1; i <= n; i++ )); do
    c=${1[i]}
    if [[ $c == $'\e' ]]; then
      while (( i < n )) && [[ ${1[i]} != [A-Za-z] || ${1[i]} == $'\e' ]]; do (( i++ )); done
      continue
    fi
    (( w += ${(m)#c} ))
  done
  (( w <= $2 )) && return 0
  w=0
  for (( i = 1; i <= n; i++ )); do
    c=${1[i]}
    if [[ $c == $'\e' ]]; then
      out+=$c
      while (( i < n )); do
        (( i++ ))
        out+=${1[i]}
        [[ ${1[i]} == [A-Za-z] ]] && break
      done
      continue
    fi
    cw=${(m)#c}
    (( w + cw > $2 - 1 )) && break
    out+=$c
    (( w += cw ))
  done
  REPLY=$out…
  [[ $1 == *$'\e'* ]] && REPLY+=$'\e[0m'
  return 1
}

__tt_map_tip() {
  local -a p=(${=TTHEME_PALETTE[$1]})
  local c=${p[3]#\#}
  REPLY=""
  (( color && ${#p} >= 20 )) || return 0
  printf -v REPLY '\e[38;2;%d;%d;%dm' $((16#${c:0:2})) $((16#${c:2:2})) $((16#${c:4:2}))
}

__tt_map_chip() {
  local -a p=(${=TTHEME_PALETTE[$1]})
  local bg=${p[1]#\#} fg=${p[2]#\#}
  if (( ! color )); then
    printf -v REPLY '%-*s' $2 "$1"
  elif (( ${#p} >= 20 )); then
    printf -v REPLY '\e[48;2;%d;%d;%d;38;2;%d;%d;%dm %-*s \e[0m' $((16#${bg:0:2})) $((16#${bg:2:2})) $((16#${bg:4:2})) \
      $((16#${fg:0:2})) $((16#${fg:2:2})) $((16#${fg:4:2})) $2 "$1"
  else
    printf -v REPLY '\e[2m %-*s \e[0m' $2 "$1"
  fi
}

__tt_here_line() {
  local rule name where
  if ! __tt_dir_rule "$PWD"; then
    reply=("$1 · no pin" "the tab's own palette")
    REPLY="$1 · no pin — the tab's own palette"
    return 0
  fi
  rule=$REPLY name=$TTHEME_PINS[$REPLY]
  __tt_pin_base "$rule"
  if [[ ${REPLY:A} == "${PWD:A}" ]]; then
    where="this directory"
  else
    __tt_dir_label "$REPLY"
    where=$REPLY
  fi
  [[ $rule == *"/**" ]] && where+=" and below"
  __tt_map_chip "$name" ${#name}
  reply=("$1 · $REPLY" "pinned to $where")
  REPLY="$1 · $REPLY pinned to $where"
}

__tt_here_fit() {
  __tt_here_line "$1"
  __tt_clip "$REPLY" $2 && { reply=("$REPLY"); return 0 }
  __tt_clip "${reply[1]}" $2
  reply[1]=$REPLY
  __tt_clip "  ${reply[2]}" $2
  reply[2]=$REPLY
}

__tt_map_under() {
  local b name
  local -i len=-1
  REPLY=""
  for b in ${(k)below}; do
    name=${below[$b]}
    [[ -n ${TTHEME_PALETTE[$name]} && ( $1 == "$b" || $1 == "${b%/}"/* ) ]] || continue
    (( ${#b} > len )) && { REPLY=$name len=${#b} }
  done
}

__tt_map_link() {
  local at=$1 root=/
  if [[ -n $top ]]; then
    root=$top
  elif [[ $at == "$home" || $at == "$home"/* ]]; then
    root=$home
  fi
  (( ${roots[(Ie)$root]} )) || roots+=("$root")
  while [[ $at != "$root" && -z ${parent[$at]} ]]; do
    parent[$at]=${at:h}
    at=${at:h}
  done
}

__tt_map_chain() {
  local at=$1 lbl=$2
  local -a ks
  while [[ -z ${own[$at]}${below[$at]} && $at != "$here" ]]; do
    ks=(${(k)parent[(Re)$at]})
    (( ${#ks} == 1 )) || break
    at=$ks[1] lbl+=/${at:t}
  done
  reply=("$at" "${lbl:-/}")
}

__tt_map_line() {
  local at=$1 name=${own[$1]:-${below[$1]}} note="" flag=""
  if [[ -n $name ]]; then
    if [[ -n ${own[$at]} ]]; then
      note="this directory"
      [[ -n ${below[$at]} ]] && note+=" · ${below[$at]} below"
    else
      note="and below"
    fi
    [[ -n ${TTHEME_PALETTE[$name]} ]] || flag="not installed"
    [[ -d $at ]] || flag+="${flag:+ · }no such directory"
  fi
  lp+=("$2") lpw+=($3) ll+=("$4") lat+=("$at") lpal+=("$name") lnote+=("$note") lflag+=("$flag")
}

__tt_map_walk() {
  local at=$1 pre=$2 tip z=$'\e[0m' REPLY
  local -i i
  local -a ks=(${(oi)${(k)parent[(Re)$1]}}) reply
  (( color )) || z=
  __tt_map_under "$at"
  __tt_map_tip "$REPLY"
  tip=$REPLY
  (( color )) && [[ -z $tip ]] && tip=$'\e[2m'
  for (( i = 1; i <= ${#ks}; i++ )); do
    __tt_map_chain "$ks[i]" "${ks[i]:t}"
    if (( i < ${#ks} )); then
      __tt_map_line "$reply[1]" "$pre$tip├─ $z" $(( $3 + 3 )) "$reply[2]"
      __tt_map_walk "$reply[1]" "$pre$tip│  $z" $(( $3 + 3 ))
    else
      __tt_map_line "$reply[1]" "$pre$tip└─ $z" $(( $3 + 3 )) "$reply[2]"
      __tt_map_walk "$reply[1]" "$pre   " $(( $3 + 3 ))
    fi
  done
}

__tt_map_build() {
  local top=$1 k base root REPLY
  local -a order=()
  own=() below=() parent=() roots=() lp=() lpw=() ll=() lat=() lpal=() lnote=() lflag=() htip=""
  for k in ${(k)TTHEME_PINS}; do
    [[ $k == /* ]] || continue
    __tt_pin_base "$k"
    base=$REPLY
    if [[ $k == *"/**" ]]; then
      below[$base]=$TTHEME_PINS[$k]
    else
      own[$base]=$TTHEME_PINS[$k]
    fi
    [[ -z $top || $base == "$top" || $base == "${top%/}"/* ]] && __tt_map_link "$base"
  done
  [[ -z $top || $here == "$top" || $here == "${top%/}"/* ]] && __tt_map_link "$here"
  __tt_dir_rule "$PWD" && __tt_map_tip "$TTHEME_PINS[$REPLY]" && htip=$REPLY
  if [[ -n $top ]]; then
    order=("$top")
  else
    (( ${roots[(Ie)$home]} )) && order+=("$home")
    [[ $home != / ]] && (( ${roots[(Ie)/]} )) && order+=(/)
  fi
  for root in $order; do
    if [[ $root == / ]]; then
      __tt_map_chain / ""
    else
      __tt_dir_label "$root"
      __tt_map_chain "$root" "$REPLY"
    fi
    __tt_map_line "$reply[1]" "" 0 "$reply[2]"
    __tt_map_walk "$reply[1]" "" 0
  done
}

__tt_map_fit() {
  local b=$'\e[1m' d=$'\e[2m' y=$'\e[33m' r=$'\e[31m' z=$'\e[0m' lab line tag tip note REPLY
  local -i width=$1 i lvl maxw namew need wr cap
  local -a lw=() rw=() cut=()
  (( color )) || b= d= y= r= z=
  reply=()
  for (( i = 1; i <= ${#ll}; i++ )); do
    lw+=($(( lpw[i] + ${(m)#ll[i]} )))
    [[ ${lat[i]} == "$here" ]] && (( lw[i] += 7 ))
    (( ${#lpal[i]} > namew )) && namew=${#lpal[i]}
  done
  for (( lvl = 0; lvl < 4; lvl++ )); do
    rw=() maxw=0 need=0
    for (( i = 1; i <= ${#ll}; i++ )); do
      wr=0
      if [[ -n $lpal[i] ]]; then
        wr=$(( 2 + namew + 2 * color ))
        (( lvl == 0 && color )) && (( wr += 13 ))
        note=${lnote[i]}
        (( lvl == 2 )) && note=${${note//this directory/only}//and below/below}
        (( lvl < 3 )) && (( wr += 2 + ${(m)#note} ))
        [[ -n $lflag[i] ]] && (( wr += 3 + ${(m)#lflag[i]} ))
        tag=${mark[$lat[i]]}
        [[ $tag == new ]] && (( wr += 5 ))
        [[ $tag == drop ]] && (( wr += 9 ))
        (( lw[i] > maxw )) && maxw=$lw[i]
      fi
      rw+=($wr)
    done
    for (( i = 1; i <= ${#ll}; i++ )); do
      if (( rw[i] )); then
        (( maxw + rw[i] > need )) && need=$(( maxw + rw[i] ))
      else
        (( lw[i] > need )) && need=$lw[i]
      fi
    done
    (( need <= width )) && break
  done
  (( lvl > 3 )) && lvl=3
  cut=()
  if (( need > width )); then
    cap=0
    for (( i = 1; i <= ${#ll}; i++ )); do
      (( rw[i] > cap )) && cap=$rw[i]
    done
    cap=$(( width - cap ))
    maxw=0
    for (( i = 1; i <= ${#ll}; i++ )); do
      wr=$(( rw[i] ? cap : width ))
      lab=${ll[i]}
      if (( lw[i] > wr )); then
        while [[ -n $lab ]] && (( lw[i] - ${(m)#ll[i]} + ${(m)#lab} + 1 > wr )); do
          lab=${lab[2,-1]}
        done
        lab=…$lab
        lw[i]=$(( lw[i] - ${(m)#ll[i]} + ${(m)#lab} ))
      fi
      cut+=("$lab")
      (( rw[i] && lw[i] > maxw )) && maxw=$lw[i]
    done
  else
    cut=("${ll[@]}")
  fi
  for (( i = 1; i <= ${#ll}; i++ )); do
    if [[ -n $lpal[i] ]]; then
      line=${lp[i]}$b${cut[i]}$z
    else
      line=${lp[i]}$d${cut[i]}$z
    fi
    [[ ${lat[i]} == "$here" ]] && line+=" "$htip$b"← here"$z
    if [[ -n $lpal[i] ]]; then
      __tt_map_chip "$lpal[i]" $namew
      line+=${(l:maxw - lw[i] + 2:: :)}$REPLY
      if (( lvl == 0 && color )); then
        if [[ -n ${TTHEME_PALETTE[$lpal[i]]} ]]; then
          [[ -n ${tstrip[$lpal[i]]} ]] || __tt_pv_strip "$lpal[i]"
          line+="  "${tstrip[$lpal[i]]}
        else
          line+=${(l:13:: :)}
        fi
      fi
      note=${lnote[i]}
      (( lvl == 2 )) && note=${${note//this directory/only}//and below/below}
      (( lvl < 3 )) && line+="  "$d$note$z
      [[ -n $lflag[i] ]] && line+=$y" · "$lflag[i]$z
      tag=${mark[$lat[i]]}
      if [[ $tag == new ]]; then
        __tt_map_tip "$lpal[i]"
        line+="  "$b$REPLY"new"$z
      elif [[ $tag == drop ]]; then
        line+="  "$r"✕ unpin"$z
      fi
    fi
    while [[ $line == *' ' ]]; do line=${line% }; done
    reply+=("$line")
  done
}

__tt_map_tree() {
  local home=${HOME:a} here=${PWD:a} htip="" REPLY
  local -A own=() below=() parent=() mark=() tstrip=()
  local -a roots=() lp=() lpw=() ll=() lat=() lpal=() lnote=() lflag=() reply
  local -i width=$(( COLUMNS > 0 ? COLUMNS : 80 ))
  __tt_map_build ""
  __tt_map_fit $width
  print -rl -- "${reply[@]}"
  print
  __tt_here_line Here
  __tt_clip "$REPLY" $width
  print -r -- "$REPLY"
  __tt_tilde "$TTHEME_PINS_FILE"
  if (( color )); then
    __tt_clip $'\e[2m'"ttheme pin picks one here · ttheme unpin drops one · $REPLY"$'\e[0m' $width
  else
    __tt_clip "ttheme pin picks one here · ttheme unpin drops one · $REPLY" $width
  fi
  print -r -- "$REPLY"
}

__tt_pins_map() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  local k REPLY
  local -i color=0
  __tt_pins_load
  if [[ ! -t 1 ]]; then
    for k in ${(oi)${(k)TTHEME_PINS}}; do
      __tt_tilde "$k"
      print -r -- "$REPLY"$'\t'"$TTHEME_PINS[$k]"
    done
    return 0
  fi
  if (( ! ${#TTHEME_PINS} )); then
    print -r -- 'No pins yet — `ttheme pin` picks a palette for this directory'
    return 0
  fi
  __tt_color && color=1
  __tt_map_tree
}

__tt_keep() {
  local note was="$TTHEME_STARTUP ${TTHEME_PALETTE[$TTHEME_STARTUP]}"
  note=$(__tt_cli default "$1") || return 1
  [[ -r $TTHEME_HOME/palettes.zsh ]] && __tt_palettes_load && __tt_reloaded
  __tt_follow "$was"
  __tt_worn_shown $2
  __tt_reload
  if __tt_color; then
    printf '\033[2m%s\033[0m\n' "${(@f)note}"
  else
    print -r -- "$note"
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
  local k cur="" grp last_grp="" shelf last_shelf="" label REPLY
  local -a reply
  local -i width=0
  __tt_order
  if ! __tt_color; then
    for k in $reply; do
      printf '%s\t%s\t%s\n' "$k" "${TTHEME_GROUP[$k]:-Other}" "${TTHEME_SRC[$k]:-unknown}"
    done
    return 0
  fi
  [[ -n $TTHEME_SPEC ]] && __tt_name_of "$TTHEME_SPEC" && cur=$REPLY
  for k in $reply; do
    label=${k##*/}
    [[ -n ${TTHEME_CATALOG[$k]} && ${TTHEME_GROUP[$k]} == *@* ]] && label="  $label"
    (( ${#label} > width )) && width=${#label}
  done
  for k in $reply; do
    grp=${TTHEME_GROUP[$k]:-Other}
    if [[ $grp != $last_grp ]]; then
      [[ $grp == *@* && $last_grp != *@* && -n $last_grp ]] && printf '  \033[2m── Markets ──────────\033[0m\n'
      printf '  \033[1m%s\033[0m' "$grp"
      [[ -n ${TTHEME_NATIVE[$k]} ]] && printf ' \033[2m%s\033[0m' "${TTHEME_NATIVE[$k]}"
      printf '\n'
      last_grp=$grp last_shelf=""
    fi
    shelf=""
    [[ $grp == *@* ]] && shelf=${TTHEME_CATALOG[$k]}
    if [[ -n $shelf && $shelf != "$last_shelf" ]]; then
      printf '    \033[1m%s\033[0m\n' "$shelf"
      last_shelf=$shelf
    fi
    label=${k##*/}
    [[ -n $shelf ]] && label="  $label"
    __tt_palette_line "$k" $width "${${(M)k:#$cur}:+1}" "$label"
  done
  printf '\n  \033[2mttheme use <palette> paints this tab · ttheme preview · ttheme help\033[0m\n'
}

__tt_help() {
  if [[ $1 == all ]]; then
    print -r -- $TTHEME_HELP_ALL
  else
    print -r -- $TTHEME_HELP
  fi
}

__tt_usage() {
  print -r -- "Usage: ttheme ${${:-$1 $TTHEME_VERB_ARGS[$1]}% }"$'\n\n'"$TTHEME_VERB_ABOUT[$1]"
}

__tt_verb_help() {
  if [[ -z $1 || $1 == all ]]; then
    __tt_help $1
  elif (( ${TTHEME_SHELL_VERBS[(Ie)$1]} )); then
    __tt_usage $1
  elif [[ -n $1 && -n ${TTHEME_VERB_ABOUT[$1]} ]]; then
    __tt_cli $1 --help
  else
    __tt_help
  fi
}

__tt_misuse() {
  print -u2 -r -- "ttheme $1: $2"$'\n'
  __tt_usage $1 >&2
  return 1
}

__tt_arity() {
  local verb=$1
  shift
  local -a want=(${=TTHEME_VERB_ARGS[$verb]})
  local least=${#${(M)want:#\<*}} most=${#want}
  (( ${#${(M)want:#*...*}} )) && most=$#
  (( $# >= least )) || { __tt_misuse $verb "missing $want[$# + 1]"; return }
  (( $# <= most )) || { __tt_misuse $verb "too many arguments: ${argv[most + 1, -1]}"; return }
}

__tt_cli() {
  local k
  local -a pass=(NODE_COMPILE_CACHE=${XDG_CACHE_HOME:-$HOME/.cache}/ttheme/node)
  for k in $TTHEME_SETTINGS; do
    (( $+parameters[$k] )) && pass+=("$k=${(P)k}")
  done
  env $pass node $TTHEME_HOME/ttheme.js "$@"
}

__tt_catalog() {
  local was
  __tt_cli "$@" || return
  [[ $1 == (list|share) ]] && return 0
  [[ -r $TTHEME_HOME/palettes.zsh ]] || return 0
  was="$TTHEME_STARTUP ${TTHEME_PALETTE[$TTHEME_STARTUP]}"
  __tt_palettes_load && __tt_reloaded
  [[ "$TTHEME_STARTUP ${TTHEME_PALETTE[$TTHEME_STARTUP]}" == "$was" ]] && return 0
  __tt_follow "$was"
  __tt_worn_shown
  __tt_reload
}

__tt_switch() {
  __tt_cli "$@" || return
  [[ -r $TTHEME_HOME/palettes.zsh ]] && __tt_palettes_load && __tt_reloaded
  if ! __tt_active; then
    __tt_reload
    return 0
  fi
  if [[ $1 == off ]]; then
    __tt_off_here reload
  elif [[ -n $TTHEME_STARTUP ]]; then
    __tt_wear "${TTHEME_PALETTE[$TTHEME_STARTUP]}" "$TTHEME_STARTUP" force || __tt_reload
  fi
}

__tt_config() {
  local blur
  if [[ ! -e $TTHEME_CONFIG ]]; then
    mkdir -p ${TTHEME_CONFIG:h} || return 1
    __tt_put $TTHEME_CONFIG "$TTHEME_CONFIG_TEMPLATE"
  fi
  blur=${(M)${(@f)"$(<$TTHEME_CONFIG)"}:#': ${TTHEME_BG_BLUR:='*}
  ${=${VISUAL:-${EDITOR:-vi}}} $TTHEME_CONFIG || return
  [[ ${(M)${(@f)"$(<$TTHEME_CONFIG)"}:#': ${TTHEME_BG_BLUR:='*} == "$blur" ]] || __tt_redraw
  print -r -- "Settings apply in new tabs — $TTHEME_CONFIG"
}

__tt_redraw() {
  local out
  out=$(__tt_cli redraw 2>&1) || { [[ -n $out ]] && print -ru2 -- "$out"; return 1 }
  [[ -n $out ]] || return 0
  print -r -- "$out"
  __tt_reload
  (( $+functions[__tt_bg_refresh] )) && __tt_bg_refresh $TTHEME_ORDER
  return 0
}

__tt_config_line() {
  REPLY=": \${$1:=$2}"
  [[ -n ${(M)${(@f)TTHEME_CONFIG_TEMPLATE}:#"# $REPLY"} ]] && REPLY="# $REPLY"
}

__tt_config_write() {
  local line name doc
  local -a out=()
  local -A want=("$@")
  local -i i
  if [[ ! -e $TTHEME_CONFIG ]]; then
    mkdir -p ${TTHEME_CONFIG:h} 2>/dev/null || return 1
    __tt_put $TTHEME_CONFIG "$TTHEME_CONFIG_TEMPLATE" 2>/dev/null || return 1
  fi
  [[ -r $TTHEME_CONFIG && -w $TTHEME_CONFIG ]] || return 1
  for line in "${(@f)$(<$TTHEME_CONFIG)}"; do
    for name in ${(k)want}; do
      [[ $line == (|\#)(| )': ${'${name}[:=}]* ]] || continue
      __tt_config_line $name ${want[$name]}
      line=$REPLY
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
      [[ $line == (|'# ')": \${$name:="* ]] && break
      doc=$line
    done
    __tt_config_line $name ${want[$name]}
    out+=("" "$doc" "$REPLY")
  done
  __tt_put $TTHEME_CONFIG "${out[@]}" 2>/dev/null
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
    print -u2 "ttheme: multiple palettes start with '$name': $m"
  elif m=(${(o)${(M)${(k)TTHEME_PALETTE}:#*$name*}}) && (( ${#m} )); then
    print -u2 "ttheme: unknown palette '$name' — did you mean: ${(j:, :)m[1,3]}?"
  else
    print -u2 "ttheme: unknown palette '$name' — run \`ttheme\` to list palettes"
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
  local REPLY
  __tt_next
  __tt_wear "$REPLY" "" force
  __tt_announce
}

__tt_pv_norm() { REPLY=${(L)1//[^[:alnum:]]/} }

__tt_pv_seek() {
  local t part key REPLY
  for t in ${(k)TTHEME_PALETTE}; do
    key=""
    for part in "$t" "${TTHEME_GROUP[$t]:-Other}" "${TTHEME_NATIVE[$t]}" "${TTHEME_CATALOG[$t]}" "${(@s:|:)TTHEME_NATIVE_NAMES[$t]}" "${TTHEME_CHARACTER[$t]}"; do
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
  for part in "${(@s:|:)TTHEME_NATIVE_NAMES[$t]}" "${TTHEME_CHARACTER[$t]}"; do
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
  [[ -n $ref && $url == http(s|)://* ]] && (( ${TTHEME_LINKS[(Ie)$TTHEME_ADAPTER]} )) && mark="⧉ "
  REPLY=Background${by:+ · $by}${ref:+ · $mark$ref}$2
  (( ${#REPLY} > room )) && REPLY=Background${by:+ · $by}
  (( ${#REPLY} > room )) && REPLY=Background
  [[ -n $mark && $REPLY == *"$mark$ref"* ]] || return 0
  (( color )) && [[ -n ${TTHEME_SITE_ANSI[${ref%% *}]} ]] && sgr=$'\e[3'${TTHEME_SITE_ANSI[${ref%% *}]}m
  REPLY=${REPLY/"$mark$ref"/$sgr⧉${sgr:+$'\e[39m'} $'\e]8;;'$url$'\e\\'$ref$'\e]8;;\e\\'}
  return 0
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
  local b=$'\e[1m' d=$'\e[2m' z=$'\e[0m' y=$'\e[33m' on=$'\e[7;1m'$ac badge="" lead="" note="" right="" text line plain hex
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
      __tt_pin_base "${pkeys[pk]}"
      __tt_dir_label "$REPLY"
      note=$REPLY
    elif (( pk == 1 )); then
      note="Until this tab closes"
    else
      note="New tabs · the default palette"
    fi
    kk=(enter) kl=(confirm)
    right=$b"esc"$z$d" back"$z
  elif [[ -n $tune ]]; then
    badge='IMAGE EDIT' kk=(↑↓ ←→ '=' +) kl=(field step reset "reset all")
    if (( tf == 2 )); then
      kl[2]=move kk+=(1-9) kl+=(place)
    elif (( tf == 4 )); then
      kl[2]=switch kk=(${kk:#'='}) kl=("${(@)kl[1,2]}" "reset all")
    else
      kk+=(⇧←→) kl+=(×10)
    fi
    if (( bgoff[$tpick] )); then
      kk+=(space enter) kl+=(show keep)
    else
      kk+=(c space enter) kl+=(colors hide keep)
    fi
    __tt_pv_bg_images $tune
    (( REPLY > 1 )) && { kk+=(', .' D); kl+=("image ×$REPLY" remove) }
    __tt_pv_bg_findable $tune && { kk+=(f); kl+=(find) }
    right=$b"esc"$z$d" undo"$z
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
      kk=(enter) kl=(apply)
      [[ $mode == pin ]] && kl[1]=pin
      if __tt_pv_bg_state ${rval[cur]}; then
        kk+=(tab) kl+=("tune bg")
      elif __tt_pv_bg_findable ${rval[cur]}; then
        kk+=(tab) kl+=("find bg")
      fi
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
  return 0
}

__tt_pv_help() {
  local back="the tab" z=$'\e[0m' b=$'\e[1m' blank
  [[ -n ${TTHEME_PALETTE[$cn]} ]] && back=$cn
  local -a hk=(Move Series Filter "" Example Apply) hv=(
    "↑↓  home  end  pgup  pgdn"
    "←→  ·  enter or space on a series"
    "Any text  ·  bksp  ·  ctrl-u clears"
    "Names and titles, in Japanese too"
    "⇧←→  ${(Lj:, :)TTHEME_SCENES}"
    "enter  ·  esc restores $back"
  )
  if (( bgcw )); then
    hk+=("Tune bg" "" "" "" "" "" "")
    hv+=("tab  ·  finds one on the boorus, or takes your own, if none" "↑↓ field  ←→ step  ⇧←→ ×10  1-9 place" "=  resets a field  ·  +  resets all" "space hides  ·  enter keeps  ·  esc undoes" "c  tone  ↔  the picture's own colors" ",  .  other pictures  ·  D removes one" "f  adds one from the boorus or your own")
  fi
  hk+=(Config "")
  hv+=("alt-c  ·  ↑↓ setting  ←→ value" "enter saves  ·  esc undoes")
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
    f)
      __tt_pv_bg_findable $tune || return 0
      name=$tune
      __tt_pv_untune
      __tt_pv_bg_find $name
      __tt_pv_tune_open $name
      ;;
    $'\r'|$'\n') __tt_pv_tune_keep ;;
    esc) __tt_pv_untune ;;
    '?') help=1 ;;
  esac
  return 0
}

__tt_pv_tune_keep() {
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
  __tt_pv_bg_strip_off
  tune="" tpick="" tsnaps=() bgname=""
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
    up) cf=$(( cf > 1 ? cf - 1 : ${#cvars} )) ;;
    down) cf=$(( cf < ${#cvars} ? cf + 1 : 1 )) ;;
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
  __tt_pv_bg_close
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
  __tt_map_fit $1
  (( ${#reply} > room )) && reply=("${(@)reply[1,room-1]}" "   …")
  reach=("${reply[@]}" "")
  __tt_dir_label "$base"
  base=$REPLY
  for k in $was; do
    __tt_clip "${d}Replaces ${k% · *} on $base · ${k##* · }$z" $1
    reach+=("$REPLY")
  done
  __tt_pin_scope "$key"
  __tt_clip "→ $base · $REPLY" $(( $1 - ${(m)#pick} - 2 ))
  rsub=$REPLY
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
  __tt_pv_lw
  lw=$reply[1] sw=$reply[2]
  split=$(( sw > 0 )) sc=$(( pw - 1 - sw ))
  h=$(( ph - 5 ))
  [[ -n $tune ]] && (( ! split )) && h=$(( ph - 14 ))
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
    (( bgcw )) && out+=$'\e_Ga=d,d=A,q=2\e\\'
    resized=0 wiped=1
  fi
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
    print -rn -- $'\e[H\e[0m\e['$lw'X'$line$tail
    printf '\e[1;%dH\e[?2026l' $(( 4 + ${(m)#flt} ))
    return 0
  fi
  out+=$line$'\e[K'$tail$'\n\e[K\n'
  (( N > h && top > 1 )) && out+="   "$dd"…"$zz
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
      fi
    elif (( k == h && N > h && top + h <= N )); then
      line="   "$dd"…"$zz
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
    elif [[ -n $tune ]]; then
      (( bgoff[$tpick] )) && state=off
      __tt_pv_bg_title $(( sw - ${#tune} - 6 ))
      __tt_pv_head 1 $sc $se $tune "$REPLY" $state
      __tt_pv_bg_panel $tpick 4 $sc $se
    elif (( conf )); then
      __tt_tilde "$TTHEME_CONFIG"
      src=$REPLY
      (( 8 + ${#src} > sw )) && src=""
      __tt_pv_head 1 $sc $se Config "" "$src"
      __tt_pv_conf_panel 4 $sc $se
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
    elif [[ -n $tune ]]; then
      (( bgoff[$tpick] )) && state=off
      held=(${=bgpics[$tune]})
      src=""
      if (( ${#held} > 1 )); then
        k=${held[(Ie)${${tpick#$tune}#:}]}
        (( k )) || k=${held[(Ie)${bgact[$tune]}]}
        src=" · $k/${#held}"
      fi
      __tt_pv_bg_title $(( lw - ${#tune} - 6 )) "$src"
      __tt_pv_head $(( ph - 10 )) 1 $lw $tune "$REPLY" $state
      __tt_pv_bg_panel $tpick $(( ph - 9 )) 1 $lw
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
    (( gstep )) && { gstep=$(( gstep - 1 )); tick=1; return 1 }
    (( SECONDS >= exnext )) && { __tt_pv_roll; gstep=8; tick=1; return 1 }
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
    Z) key=stab ;;
    *) key=nop ;;
  esac
}

__tt_pv_pick() {
  case $key in
    $'\x03') return 1 ;;
    esc) pick="" ;;
    left|stab) pk=$(( (pk + ${#plabel} - 2) % ${#plabel} + 1 )) ;;
    right|$'\t') pk=$(( pk % ${#plabel} + 1 )) ;;
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
    right) [[ ${rtype[cur]} == (hdr|cat) && -z ${exp[${rval[cur]}]} ]] && __tt_pv_toggle ;;
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
      [[ ${rtype[cur]} == thm ]] || return 0
      name=${rval[cur]}
      if __tt_pv_bg_state $name || { __tt_pv_bg_findable $name && __tt_pv_bg_find $name }; then
        __tt_pv_tune_open $name
      elif __tt_pv_bg_findable $name; then
        :
      elif (( bgcw )); then
        msg="No background image for $name" msgt=200
      fi
      ;;
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
  local mode=$1 pdir=${2:-$PWD}
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
  local -A bgpic=() bgpics=() bgact=() bgview=() bgswap=() bgthumb=() tsnaps=() pvseek=() bgcolors=()
  local conf=0 cf=1
  local -a plabel=(" This tab " " Default ") pkeys=() reach=() csnap=()
  local -a cvars=(TTHEME_TAB_PALETTE TTHEME_ANNOUNCE TTHEME_FX TTHEME_SORT TTHEME_BG_BLUR TTHEME_BG_COLORS) clabel=("New tabs" Announce "Search fx" Sort Blur Colors)
  local -a cchoice=("off seq" "1 0" "typewriter decode glitch" "abc series" "0 1 2 3 4" "tone original") cshow=("off seq" "on off" "typewriter decode glitch" "abc series" "off 1px 2px 3px 4px" "tone original")
  local -A cnote=(
    TTHEME_TAB_PALETTE:seq "New tabs rotate through palettes" TTHEME_TAB_PALETTE:off "New tabs keep the terminal theme"
    TTHEME_ANNOUNCE:1 "Shows the palette notice" TTHEME_ANNOUNCE:0 "Silences the palette notice"
    TTHEME_FX:typewriter "The search hint types itself" TTHEME_FX:decode "The search hint decodes" TTHEME_FX:glitch "The search hint glitches in"
    TTHEME_SORT:abc "Series and palettes by name" TTHEME_SORT:series "Series in the order added"
    TTHEME_BG_BLUR:0 "Pictures stay sharp" TTHEME_BG_BLUR:1 "Pictures soften a little behind the text"
    TTHEME_BG_BLUR:2 "Pictures soften behind the text" TTHEME_BG_BLUR:3 "Pictures blur behind the text"
    TTHEME_BG_BLUR:4 "Pictures blur well behind the text"
    TTHEME_BG_COLORS:tone "New pictures are tinted in one color of the palette"
    TTHEME_BG_COLORS:original "New pictures keep their own colors"
  )
  __tt_pv_conf_rows
  [[ $mode == pin ]] && __tt_pin_scopes "$pdir"
  [[ $mode == init ]] && pkdef=2
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
    while :; do
      printf '\e[?2026h'
      if (( tick )); then
        __tt_pv_draw hint
      else
        __tt_pv_focus
        [[ ${rtype[cur]} == thm ]] && an=${rval[cur]}
        __tt_pv_draw
      fi
      tick=0
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
    printf '\e[?7h\e[?1049l\e[?25h\e[?2026l'
    [[ -n $tty ]] && stty "$tty" 2>/dev/null
    TTHEME_RAW=0
    [[ -n $tune ]] && __tt_pv_untune
    (( conf )) && __tt_pv_unconf
    __tt_pv_bg_save
    if [[ -n $spec ]]; then
      TTHEME_SPEC=$spec
      if [[ $mode == pin ]]; then
        __tt_pin_save "$sel" "${pkeys[picked]}" "$orig"
        [[ $TTHEME_SPEC == "$orig" ]] || __tt_announce
        __tt_sync
      elif (( picked == 2 )); then
        __tt_announce
        __tt_keep "$sel" force
      else
        __tt_announce
        __tt_shown "$sel" force && __tt_reload
      fi
    else
      (( ${#bgedit} + ${#bgswap} )) && [[ -n ${TTHEME_PALETTE[$cn]} ]] && { __tt_shown "$cn" && __tt_reload }
    fi
  }
  return 0
}

ttheme() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  if (( $# > 1 && ${${argv[2,-1]}[(I)(-h|--help)]} )); then
    __tt_verb_help $1
    return
  fi
  case $1 in
    -h|--help) __tt_help; return 0 ;;
    -V|--version) __tt_cli --version; return ;;
    help) __tt_verb_help $2; return 0 ;;
    -*) print -u2 "ttheme: unknown option $1 — see \`ttheme help\`"; return 1 ;;
  esac
  if (( $# )) && [[ -z ${TTHEME_VERB_ABOUT[$1]} ]]; then
    print -u2 "ttheme: unknown command '$1' — see \`ttheme help\`"
    return 1
  fi
  __tt_fresh
  (( $+functions[ttheme] )) || { print -u2 "ttheme: uninstalled — \`npx @kecan0406/ttheme@latest init\` sets it up again"; return 1 }
  if ! __tt_paints && (( ! $# || ${TTHEME_TAB_VERBS[(Ie)$1]} )); then
    __tt_unpainted
    return 1
  fi
  if (( ! $# )); then
    (( ${#TTHEME_PALETTE} )) || { __tt_empty; return }
    __tt_menu
    return 0
  fi

  case $1 in
    browse|list|add|remove|update|market|new|edit|check|share) __tt_catalog "$@"; return ;;
    on|off) __tt_switch "$@"; return ;;
    info) TTHEME_ZSH=$ZSH_VERSION __tt_cli "$@"; return ;;
  esac
  __tt_arity "$@" || return
  [[ $1 == config ]] && { __tt_config; return }
  (( ${#TTHEME_PALETTE} )) || { __tt_empty; return }

  local REPLY
  case $1 in
    use)
      __tt_resolve "$2" || return 1
      __tt_wear "${TTHEME_PALETTE[$REPLY]}" "$REPLY" force
      __tt_announce ;;
    next) __tt_rotate ;;
    default)
      __tt_resolve "$2" || return 1
      __tt_keep "$REPLY" ;;
    preview) __tt_preview ;;
    pin)
      if [[ -n $2 ]]; then
        REPLY=$2
        [[ $REPLY == \~ || $REPLY == \~/* ]] && REPLY=$HOME${REPLY#\~}
        [[ -d $REPLY ]] || { print -u2 -r -- "ttheme pin: no such directory: $2"; return 1 }
      fi
      __tt_preview pin ${REPLY:+${REPLY:a}} ;;
    unpin) __tt_unpin "${@:2}" ;;
    pins) __tt_pins_map ;;
  esac
}

if (( ${+functions[compdef]} )); then
  __tt_complete() {
    emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
    local -a reply
    if (( CURRENT == 2 )); then
      compadd -- $TTHEME_VERBS help
    elif [[ $words[2] == remove || ( $words[2] == (use|default|edit|check|share) && $CURRENT == 3 ) ]]; then
      compadd -- $TTHEME_ORDER
    elif [[ $words[2] == new && $words[CURRENT-1] == --from ]]; then
      compadd -- $TTHEME_ORDER
    elif [[ $words[2] == new && $words[CURRENT-1] == --in ]]; then
      _files -/
    elif [[ $words[2] == new ]]; then
      compadd -- --from --in
    elif [[ $words[2] == market && $CURRENT == 3 ]]; then
      compadd -- add remove search init
    elif [[ $words[2] == market && $words[3] == (add|init) && $CURRENT == 4 ]]; then
      _files -/
    elif [[ $words[2] == (pin|unpin) && $CURRENT == 3 ]]; then
      _files -/
    elif [[ $words[2] == add && $words[CURRENT-1] == --market ]]; then
      _files -/
    elif [[ $words[2] == add ]]; then
      reply=(${${${(M)${(f)"$(__tt_cli list --json 2>/dev/null)"}:#*\"name\": *}#*\"name\": \"}%%\"*})
      compadd -- --market ${reply:|TTHEME_ORDER}
    fi
  }
  compdef __tt_complete ttheme
fi

() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  __tt_active || return 0
  [[ -n $TMUX ]] && __tt_tmux
  () {
    local REPLY
    if [[ -n $TTHEME_SPEC ]]; then
      :
    elif [[ $TTHEME_TAB_PALETTE == off ]]; then
      [[ -n $TTHEME_HEARD ]] || __tt_listen
      __tt_start_bg && __tt_wearing $REPLY && TTHEME_SPEC=$REPLY
    else
      __tt_next
      TTHEME_SPEC=$REPLY
      __tt_apply "$TTHEME_SPEC"
    fi
    __tt_dir_sync
  }
  autoload -Uz add-zsh-hook add-zle-hook-widget
  zle -N __tt_line_init
  add-zle-hook-widget line-init __tt_line_init
  add-zsh-hook chpwd __tt_chpwd
  add-zsh-hook precmd __tt_prompt
  if (( ! TTHEME_TMUX )); then
    add-zsh-hook preexec __tt_mux
    add-zsh-hook precmd __tt_unmux
  fi
  if __tt_follows_focus || (( TTHEME_TMUX )); then
    add-zsh-hook precmd __tt_precmd
    add-zsh-hook preexec __tt_preexec
    __tt_bind_focus
  else
    __tt_sync
  fi
  __tt_follows_prompt && add-zsh-hook precmd __tt_prompted
  __tt_announce
}

() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  local f
  for f in $TTHEME_HOME/ttheme.zsh $TTHEME_HOME/palettes.zsh $TTHEME_HOME/adapters/_osc.zsh $TTHEME_HOME/adapters/_wired.zsh $TTHEME_HOME/adapters/_bg.zsh $TTHEME_HOME/adapters/$TTHEME_ADAPTER.zsh; do
    [[ -r $f && ! $f.zwc -nt $f ]] || continue
    zcompile -UR -- $f.$$.zwc $f 2>/dev/null && command mv -f -- $f.$$.zwc $f.zwc 2>/dev/null
    [[ ! -e $f.$$.zwc ]] || command rm -f -- $f.$$.zwc
  done
}
