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
  [[ -n $TTHEME_SSH_SPEC ]] && __tt_ssh_back
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
  for hook in precmd:__tt_prompt precmd:__tt_precmd precmd:__tt_prompted precmd:__tt_unmux preexec:__tt_preexec preexec:__tt_ran chpwd:__tt_chpwd; do
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
typeset -g TTHEME_SSH_SPEC="" TTHEME_SSH_BACK=""

__tt_tilde() { REPLY=${1/#$HOME\//\~/} }

__tt_ssh_ok() {
  setopt localoptions extendedglob
  [[ $1 == ssh:[[:alnum:]._*?:-]## ]]
}

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
    [[ $line == ([~/]|ssh:)*[[:space:]]* ]] || continue
    name=${line##*[[:space:]]} key=${${line%[[:space:]]*}%%[[:space:]]##}
    if [[ $key == ssh:* ]]; then
      key=ssh:${(L)key#ssh:}
      __tt_ssh_ok $key || continue
      TTHEME_PINS[$key]=$name
    else
      [[ $key == \~ ]] && key=$HOME
      TTHEME_PINS[${key/#\~\//$HOME/}]=$name
    fi
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
  if [[ -n $NVIM || -n $VIM_TERMINAL || -n $INSIDE_EMACS || $TERM_PROGRAM == vscode ]]; then
    typeset -g TTHEME_ADAPTER=editor
  elif [[ $TERM_PROGRAM == WarpTerminal ]]; then
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
typeset -gi TTHEME_RECHECK=0 TTHEME_FOCUS=0 TTHEME_FRONT=-1 TTHEME_RAN=0

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

__tt_mend() {
  local REPLY
  local -a p=(${(L)=TTHEME_SPEC})
  local -A got
  TTHEME_RAN=0
  [[ -n $TTHEME_PAINTED ]] && (( ${#p} >= 20 )) && __tt_reverts || return 0
  __tt_ask $'\e]11;?\e\\\e]12;?\e\\' || return 0
  __tt_colors "$REPLY"
  [[ $p[1] == - || ${got[11]:-$p[1]} == $p[1] ]] && [[ ${got[12]:-$p[3]} == $p[3] ]] && return 0
  __tt_apply "$TTHEME_SPEC"
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
    [[ $k == /* && -n ${TTHEME_PALETTE[$TTHEME_PINS[$k]]} ]] || continue
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

__tt_ssh_host() {
  setopt localoptions extendedglob
  local w o host=""
  local -a words=(${(z)1})
  local -i i=1 tty=0 ended=0
  while [[ ${words[i]} == ([[:alpha:]_][[:alnum:]_]#=*|command|exec|noglob|nocorrect|-) ]]; do (( ++i )); done
  [[ ${${(Q)words[i]}:t} == ssh ]] || return 1
  for (( ++i; i <= ${#words}; i++ )); do
    case ${words[i]} in
      ('&&'|'||'|';'|';;'|';&'|';|') break ;;
      ('2>'|'2>>'|'2>|'|'2>&') (( ++i )); continue ;;
      ('&'|'&!'|'&|'|'|'|'|&'|[0-9]#[\<\>]*|'&>'*) return 1 ;;
    esac
    w=${(Q)words[i]}
    if (( ! ended )) && [[ $w == -?* ]]; then
      [[ $w == -- ]] && { ended=1; continue }
      o=${w#-}
      while [[ -n $o ]]; do
        case ${o[1]} in
          (t) (( ++tty )) ;;
          ([fGNnsTVOQW]) return 1 ;;
          ([BbcDEeFIiJLlmoPpRSw]) [[ -n ${o[2,-1]} ]] || (( ++i )); break ;;
        esac
        o=${o[2,-1]}
      done
      continue
    fi
    if [[ -n $host ]]; then
      (( tty )) || return 1
      break
    fi
    host=$w
  done
  [[ $host == ssh://* ]] && host=${${host#ssh://}%:<->}
  REPLY=${(L)${${host##*@}#\[}%\]}
  [[ -n $REPLY ]]
}

__tt_ssh_rule() {
  local k best=""
  [[ -n ${TTHEME_PALETTE[${TTHEME_PINS[ssh:$1]}]} ]] && { REPLY=ssh:$1; return 0 }
  for k in ${(k)TTHEME_PINS}; do
    [[ $k == ssh:*[*?]* && -n ${TTHEME_PALETTE[$TTHEME_PINS[$k]]} && $1 == ${~k#ssh:} ]] || continue
    (( ${#k} > ${#best} )) && best=$k
  done
  [[ -n $best ]] || return 1
  REPLY=$best
}

__tt_ssh_back() {
  local back=$TTHEME_SSH_BACK worn=$TTHEME_SSH_SPEC
  TTHEME_SSH_BACK="" TTHEME_SSH_SPEC=""
  [[ $TTHEME_SPEC == "$worn" && $back != "$worn" ]] || return 0
  if [[ -n $back ]]; then
    __tt_wear "$back"
  else
    __tt_osc_reset
    TTHEME_SPEC=
  fi
}

__tt_ran() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  local REPLY name
  TTHEME_RAN=1
  [[ ${${(z)3}[1]:t} == tmux ]] && TTHEME_MUXED=1
  [[ $3 == *ssh* ]] && __tt_ssh_host "$3" && __tt_ssh_rule "$REPLY" || return 0
  name=$TTHEME_PINS[$REPLY]
  TTHEME_SSH_BACK=$TTHEME_SPEC TTHEME_SSH_SPEC=$TTHEME_PALETTE[$name]
  [[ $TTHEME_SSH_SPEC == "$TTHEME_SPEC" ]] || __tt_wear "$TTHEME_SSH_SPEC" "$name"
  return 0
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
  (( TTHEME_RAN )) && __tt_mend
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
  if [[ $1 == ssh:* ]]; then
    REPLY="while connected"
  elif [[ $1 == *"/**" ]]; then
    REPLY="and below"
  else
    REPLY="this directory"
  fi
}

__tt_pin_where() {
  if [[ $1 == ssh:* ]]; then
    REPLY="ssh ${1#ssh:}"
  else
    __tt_pin_base "$1"
    __tt_dir_label "$REPLY"
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
  if [[ $1 == ssh:* ]]; then
    plabel=(" This host ") pkeys=("$1") pkdef=1
    [[ $1 == *[*?]* ]] && plabel=(" Every match ")
    return 0
  fi
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
  local name=$1 key=$2 k base spec=$3 REPLY
  if [[ $key == /* ]]; then
    __tt_pin_base "$key"
    base=$REPLY
    for k in ${(k)TTHEME_PINS}; do
      [[ $k == /* ]] || continue
      __tt_pin_base "$k"
      [[ $REPLY == "$base" ]] && unset "TTHEME_PINS[$k]"
    done
  fi
  TTHEME_PINS[$key]=$name
  if ! __tt_pins_write; then
    print -u2 "ttheme pin: could not write $TTHEME_PINS_FILE"
    return 1
  fi
  if [[ $key == /* ]]; then
    [[ -n $TTHEME_PIN ]] || TTHEME_BASE_SPEC=$3
    if __tt_dir_rule "$PWD"; then
      spec=${TTHEME_PALETTE[$TTHEME_PINS[$REPLY]]}
      TTHEME_PIN=$REPLY TTHEME_PIN_SPEC=$spec
    else
      spec=$TTHEME_BASE_SPEC
      TTHEME_PIN="" TTHEME_PIN_SPEC=""
    fi
  fi
  if [[ $spec != "$TTHEME_SPEC" ]]; then
    if [[ -n $spec ]]; then
      __tt_wear "$spec"
    else
      __tt_osc_reset
      TTHEME_SPEC=
    fi
  fi
  __tt_pin_where "$key"
  k=$REPLY
  __tt_pin_scope "$key"
  if __tt_color; then
    printf '\033[2mPinned · %s → %s · %s\033[0m\n' "$name" "$k" "$REPLY"
  else
    print -r -- "Pinned · $name → $k · $REPLY"
  fi
  if [[ $key == /* && $TTHEME_PIN != "$key" ]]; then
    __tt_here_line Here
    print -r -- "$REPLY"
  fi
}

__tt_unpin_drop() {
  local k REPLY where
  local -a gone=()
  local -i dirs=0
  for k in "$@"; do
    [[ -n ${TTHEME_PINS[$k]} ]] || continue
    [[ $k == /* ]] && dirs=1
    __tt_pin_where "$k"
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
  (( dirs )) || return 0
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
  if [[ $1 == ssh:* ]]; then
    k=ssh:${(L)1#ssh:}
    if [[ -z ${TTHEME_PINS[$k]} ]]; then
      print -u2 -r -- "ttheme unpin: nothing pinned to ssh ${k#ssh:}"
      return 1
    fi
    __tt_unpin_drop $k
    return
  fi
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

__tt_map_ssh() {
  local k name flag
  for k in ${(oi)${(M)${(k)TTHEME_PINS}:#ssh:*}}; do
    name=$TTHEME_PINS[$k] flag=""
    [[ -n ${TTHEME_PALETTE[$name]} ]] || flag="not installed"
    lp+=("") lpw+=(0) ll+=("ssh ${k#ssh:}") lat+=("$k") lpal+=("$name") lnote+=("while connected") lflag+=("$flag")
  done
}

__tt_map_tree() {
  local home=${HOME:a} here=${PWD:a} htip="" REPLY
  local -A own=() below=() parent=() mark=() tstrip=()
  local -a roots=() lp=() lpw=() ll=() lat=() lpal=() lnote=() lflag=() reply
  local -i width=$(( COLUMNS > 0 ? COLUMNS : 80 ))
  __tt_map_build ""
  __tt_map_ssh
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
  local k
  local -a reply
  __tt_order
  for k in $reply; do
    printf '%s\t%s\t%s\n' "$k" "${TTHEME_GROUP[$k]:-Other}" "${TTHEME_SRC[$k]:-unknown}"
  done
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
  local was="$TTHEME_STARTUP ${TTHEME_PALETTE[$TTHEME_STARTUP]}"
  __tt_cli "$@" || return
  [[ $1 == (list|share) ]] && return 0
  __tt_catalog_done "$was"
}

__tt_catalog_done() {
  [[ -r $TTHEME_HOME/palettes.zsh ]] || return 0
  __tt_palettes_load && __tt_reloaded
  [[ "$TTHEME_STARTUP ${TTHEME_PALETTE[$TTHEME_STARTUP]}" == "$1" ]] && return 0
  __tt_follow "$1"
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
  if (( te )); then
    __tt_pv_shows $tename
    (( resized )) || [[ $REPLY == "$bgname" ]] || __tt_pv_bg_show "$REPLY"
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

__tt_pv_bar() {
  local z=$'\e[0m' d=$'\e[2m' on=$'\e[7;1m'$ac line=" " title hint="tab next"
  local -i i at=${TTHEME_HUB_TABS[(Ie)preview]} len=${#TTHEME_HUB_TITLES}
  (( color )) || z= d= on=
  [[ ${rtype[cur]} == thm ]] && hint="⇧tab switch"
  for title in $TTHEME_HUB_TITLES; do
    (( len += ${#title} + 2 ))
  done
  for (( i = 1; i <= ${#TTHEME_HUB_TITLES}; i++ )); do
    title=${TTHEME_HUB_TITLES[i]}
    (( i > 1 )) && line+=" "
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
      right=$b"esc"$z$d" undo"$z
    elif [[ $temode == (type|compare) ]]; then
      right=$b"esc"$z$d" back"$z
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
  return 0
}

__tt_pv_help() {
  local back="the tab" z=$'\e[0m' b=$'\e[1m' blank
  [[ -n ${TTHEME_PALETTE[$cn]} ]] && back=$cn
  local -a hk=() hv=()
  if (( te )); then
    hk=(Move Image "" "" "" Palette "" "" "" Apply Save Cancel)
    hv=(
      "↑↓ j k  the image, the palette, then Apply  ·  home  end"
      "Images  ←→  , .  pick one  ·  D removes it  ·  f  finds one"
      "enter on the empty frame  ·  finds the first one"
      "←→ step  ⇧←→ ×10  1-9 place  ·  =  resets  ·  +  all"
      "space  hides  ·  c  colors"
      "←→  normal or bright  ·  enter tab  tune it  ·  #  a color"
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
    *) key=nop ;;
  esac
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
  printf '\e[?2026h\e[?25l'
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
  tename=$name tfocus=0 tespec="" tesz="" teframe=() tedirty=0 temode=list tetop=0 msgt=0
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
  te=0 tfocus=0 tename="" tespec="" tesz="" teframe=() tetop=0 help=0 pick=""
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
  local -i col=$1 end=$2 r0=$3 r1=$4 R W T I=3 V at i n y tfs=$tf lo=15
  (( color )) || z= d= b=
  R=$(( r1 - r0 + 1 )) W=$(( end - col + 1 ))
  [[ $temode == list ]] || lo=21
  [[ -n $tune ]] || __tt_pv_bg_findable $tename && I=17
  T=$(( R - I - 3 ))
  (( T > 26 )) && T=26
  (( T < 21 )) && T=$lo
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
    if [[ -n $tune ]]; then
      (( bgoff[$tpick] )) && st=off || st=on
      __tt_pv_bg_title $(( W - 14 ))
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
      if [[ -n $tune ]]; then
        bgstrip="$(( y + 2 )) $col $end"
        (( tfocus == 1 )) || tf=0
        __tt_pv_bg_panel $tpick $(( y + 9 )) $col $end
        tf=$tfs
      else
        __tt_pv_te_tile $(( y + 3 )) $col
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
    out+=$'\e['$y';'$col'H'${teframe[9 + i]}$z
  done
  y=$(( r0 + V - 1 - tetop ))
  (( y >= r0 && y <= r1 )) || return 0
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
  local -A bgpic=() bgpics=() bgact=() bgview=() bgswap=() bgthumb=() tsnaps=() pvseek=() bgcolors=()
  local conf=0 cf=1
  local -a plabel=(" Default " " This tab ") pkeys=() reach=() csnap=() teframe=()
  local te=0 tfocus=0 tetop=0 tename="" tedirty=0 temode=list tespec="" tesz=""
  local -i TE_IN=0 TE_OUT=0 TE_PID=0 pvgone=0
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
      if (( tick && ! te )); then
        __tt_pv_draw hint
      else
        __tt_pv_focus
        [[ ${rtype[cur]} == thm ]] && an=${rval[cur]}
        __tt_pv_draw
      fi
      tick=0
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
    if [[ -t 0 && -t 1 ]]; then
      __tt_preview hub
    else
      __tt_menu
    fi
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
      if [[ $2 == ssh:* ]]; then
        REPLY=ssh:${(L)2#ssh:}
        [[ $REPLY != ssh: ]] || { __tt_misuse pin "missing the host after ssh:"; return }
        [[ $REPLY != *@* ]] || { print -u2 -r -- "ttheme pin: an ssh pin names the host alone — ssh:${REPLY##*@}"; return 1 }
        __tt_ssh_ok $REPLY || { print -u2 -r -- "ttheme pin: not a host: ${2#ssh:} — letters, digits, . - : and the wildcards * ?"; return 1 }
      elif [[ -n $2 ]]; then
        REPLY=$2
        [[ $REPLY == \~ || $REPLY == \~/* ]] && REPLY=$HOME${REPLY#\~}
        [[ -d $REPLY ]] || { print -u2 -r -- "ttheme pin: no such directory: $2"; return 1 }
        REPLY=${REPLY:a}
      fi
      __tt_preview pin ${REPLY:+$REPLY} ;;
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
      reply=(${${(M)${(k)TTHEME_PINS}:#ssh:*}#ssh:})
      if compset -P 'ssh:'; then
        if [[ $words[2] == unpin ]]; then
          compadd -- $reply
        elif (( $+functions[_ssh_hosts] )); then
          _ssh_hosts
        fi
      else
        _files -/
        [[ $words[2] == pin || ${#reply} -gt 0 ]] && compadd -S '' -- ssh:
      fi
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
    add-zsh-hook preexec __tt_ran
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
