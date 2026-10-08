typeset -g TTHEME_HOME=${${(%):-%x}:A:h} TTHEME_PALETTES_AT=""

zmodload -F zsh/stat b:zstat 2>/dev/null

typeset -gA TTHEME_SGR=(
  reset $'\e[0m' /fg $'\e[39m' /bg $'\e[49m' /ink $'\e[39;49m'
  dim $'\e[2m' /dim $'\e[22m'
  bold $'\e[1m' /bold $'\e[22m'
  under $'\e[4m' /under $'\e[24m'
  reverse $'\e[7m' /reverse $'\e[27m'
  accent $'\e[36m' /accent $'\e[39m'
  pill $'\e[7;1;36m' /pill $'\e[22;27;39m'
  match $'\e[1;4;36m' /match $'\e[22;24;39m'
  ok $'\e[32m' /ok $'\e[39m'
  warn $'\e[33m' /warn $'\e[39m'
  error $'\e[31m' /error $'\e[39m'
  fg0 $'\e[30m' fg1 $'\e[31m' fg2 $'\e[32m' fg3 $'\e[33m' fg4 $'\e[34m' fg5 $'\e[35m' fg6 $'\e[36m' fg7 $'\e[37m'
)

__tt_palettes_load() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  local -a at
  unset TTHEME_PALETTE TTHEME_GROUP TTHEME_CATALOG TTHEME_NATIVE TTHEME_SRC
  source $TTHEME_HOME/palettes.zsh || return 1
  zstat -F %s.%N -A at +mtime -- $TTHEME_HOME/palettes.zsh 2>/dev/null
  TTHEME_PALETTES_AT=$at[1]
}

__tt_specs_named() {
  local v REPLY
  reply=()
  for v in TTHEME_SPEC TTHEME_PIN_SPEC TTHEME_BASE_SPEC TTHEME_SSH_SPEC TTHEME_SSH_BACK; do
    [[ -n ${(P)v} ]] || continue
    __tt_name_of "${(P)v}"
    [[ -n ${TTHEME_PALETTE[$REPLY]} ]] && reply+=($v $REPLY)
  done
}

__tt_respec() {
  local spec=$TTHEME_SPEC v n worn
  for v n in "$@"; do
    [[ -n ${TTHEME_PALETTE[$n]} ]] || continue
    typeset -g $v=${TTHEME_PALETTE[$n]}
    [[ $v == TTHEME_SPEC ]] && worn=$n
  done
  [[ -n $worn && -n $TTHEME_PAINTED && $TTHEME_SPEC != "$spec" ]] && __tt_wear "$TTHEME_SPEC" $worn
  return 0
}

__tt_fresh() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  local -a at reply
  local was=$TTHEME_STARTUP start="$TTHEME_STARTUP ${TTHEME_PALETTE[$TTHEME_STARTUP]}"
  if ! zstat -F %s.%N -A at +mtime -- $TTHEME_HOME/palettes.zsh 2>/dev/null; then
    [[ -e $TTHEME_HOME ]] || __tt_gone
    return 0
  fi
  if [[ $at[1] != "$TTHEME_PALETTES_AT" ]]; then
    __tt_specs_named
    __tt_palettes_load && { __tt_respec $reply; __tt_follow "$start" && __tt_sync; __tt_reloaded }
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

: ${TTHEME_MOUSE:=on}

: ${TTHEME_BG_BLUR:=0}

: ${TTHEME_BG_COLORS:=tone}

: ${TTHEME_WARP_FAST:=on}

: ${TTHEME_MARKET_LOOKUP:=on}

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
    __tt_hear || { [[ -n $TTHEME_OWED ]] && TTHEME_RECHECK=1; return 1 }
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
  print -u2 'ttheme: no palettes installed yet — run `ttheme` in a terminal to pick some, or `ttheme add <palette>`'
  return 1
}

__tt_name_of() { REPLY=${${(k)TTHEME_PALETTE[(re)$1]}:-custom} }

__tt_color() { [[ -t 1 && -z $NO_COLOR && $TERM != dumb ]] }

__tt_announce() {
  (( TTHEME_ANNOUNCE )) && [[ -t 1 ]] || return 0
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
  printf "\033[48;2;%d;%d;%dm %s ${TTHEME_SGR[reset]}\n${TTHEME_SGR[reverse]}${TTHEME_SGR[bold]}\033[38;2;%d;%d;%dm %s ${TTHEME_SGR[reset]} ${TTHEME_SGR[dim]}· ANSI %s${TTHEME_SGR[reset]}\n" \
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
    printf "${TTHEME_SGR[dim]}Pinned · %s → %s · %s${TTHEME_SGR[reset]}\n" "$name" "$k" "$REPLY"
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
      print -r -- $TTHEME_SGR[dim]"$k"$TTHEME_SGR[reset]
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
          "200~")
            seq=""
            while read -sk 1 -t 0.5 c; do
              seq+=$c
              [[ $c == '~' && $seq == *$'\e[201~' ]] && break
            done
            REPLY=nop
            ;;
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
  local b=$TTHEME_SGR[bold] d=$TTHEME_SGR[dim] z=$TTHEME_SGR[reset] on=$TTHEME_SGR[pill] bar plain keys top k home=${HOME:a} here=${PWD:a} htip="" REPLY
  local -A own=() below=() parent=() mark=() tstrip=()
  local -a roots=() lp=() lpw=() ll=() lat=() lpal=() lnote=() lflag=() reply gone=(${(f)drops[$1]})
  local -i i width=$(( (COLUMNS > 0 ? COLUMNS : 80) - 1 )) room=$(( (LINES > 0 ? LINES : 24) - 3 ))
  (( color )) || b= d= z= on=
  if (( color )); then
    bar=$TTHEME_SGR[pill]" UNPIN "$TTHEME_SGR[reset]" " plain="  UNPIN  "
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
  (( ${#reply} > room )) && reply=("${(@)reply[1,room-1]}" "    …")
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
    tty=$(stty -g 2>/dev/null && stty -echo -icanon -ixon min 1 time 0 2>/dev/null)
    print -rn -- $'\e[?25l\e[?2004h'
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
    print -rn -- "$REPLY"$'\e[J\e[?2004l\e[?25h'
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
  [[ $1 == *$'\e'* ]] && REPLY+=$TTHEME_SGR[reset]
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
    printf -v REPLY "\e[48;2;%d;%d;%d;38;2;%d;%d;%dm %-*s ${TTHEME_SGR[/ink]}" $((16#${bg:0:2})) $((16#${bg:2:2})) $((16#${bg:4:2})) \
      $((16#${fg:0:2})) $((16#${fg:2:2})) $((16#${fg:4:2})) $2 "$1"
  else
    printf -v REPLY "${TTHEME_SGR[dim]} %-*s ${TTHEME_SGR[reset]}" $2 "$1"
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
  local at=$1 pre=$2 tip z=$TTHEME_SGR[reset] REPLY
  local -i i
  local -a ks=(${(oi)${(k)parent[(Re)$1]}}) reply
  (( color )) || z=
  __tt_map_under "$at"
  __tt_map_tip "$REPLY"
  tip=$REPLY
  (( color )) && [[ -z $tip ]] && tip=$TTHEME_SGR[dim]
  for (( i = 1; i <= ${#ks}; i++ )); do
    __tt_map_chain "$ks[i]" "${ks[i]:t}"
    if (( i < ${#ks} )); then
      __tt_map_line "$reply[1]" "$pre$tip├── $z" $(( $3 + 4 )) "$reply[2]/"
      __tt_map_walk "$reply[1]" "$pre$tip│   $z" $(( $3 + 4 ))
    else
      __tt_map_line "$reply[1]" "$pre$tip└── $z" $(( $3 + 4 )) "$reply[2]/"
      __tt_map_walk "$reply[1]" "$pre    " $(( $3 + 4 ))
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
  local b=$TTHEME_SGR[bold] d=$TTHEME_SGR[dim] y=$TTHEME_SGR[warn] r=$TTHEME_SGR[error] z=$TTHEME_SGR[reset] lab line tag tip note REPLY
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
  local k name flag tip=$TTHEME_SGR[dim] z=$TTHEME_SGR[reset]
  local -a ks=(${(oi)${(M)${(k)TTHEME_PINS}:#ssh:*}})
  local -i i
  (( ${#ks} )) || return 0
  (( color )) || tip= z=
  lp+=("") lpw+=(0) ll+=(ssh) lat+=(ssh:) lpal+=("") lnote+=("") lflag+=("")
  for (( i = 1; i <= ${#ks}; i++ )); do
    k=$ks[i] name=$TTHEME_PINS[$ks[i]] flag=""
    [[ -n ${TTHEME_PALETTE[$name]} ]] || flag="not installed"
    if (( i < ${#ks} )); then
      lp+=("$tip├── $z")
    else
      lp+=("$tip└── $z")
    fi
    lpw+=(4) ll+=("${k#ssh:}") lat+=("$k") lpal+=("$name") lnote+=("while connected") lflag+=("$flag")
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
    __tt_clip $TTHEME_SGR[dim]"ttheme pin picks one here · ttheme unpin drops one · $REPLY"$TTHEME_SGR[reset] $width
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
    printf "${TTHEME_SGR[dim]}%s${TTHEME_SGR[reset]}\n" "${(@f)note}"
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
  __tt_cli_env
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
  local was=$TTHEME_PALETTES_AT
  local -a reply
  __tt_specs_named
  if __tt_palettes_load && [[ $TTHEME_PALETTES_AT != "$was" ]]; then
    __tt_respec $reply
    __tt_reloaded
  fi
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
  local blur tab
  if [[ ! -e $TTHEME_CONFIG ]]; then
    mkdir -p ${TTHEME_CONFIG:h} || return 1
    __tt_put $TTHEME_CONFIG "$TTHEME_CONFIG_TEMPLATE"
  fi
  blur=${(M)${(@f)"$(<$TTHEME_CONFIG)"}:#': ${TTHEME_BG_BLUR:='*}
  tab=${(M)${(@f)"$(<$TTHEME_CONFIG)"}:#': ${TTHEME_TAB_PALETTE:='*}
  ${=${VISUAL:-${EDITOR:-vi}}} $TTHEME_CONFIG || return
  [[ ${(M)${(@f)"$(<$TTHEME_CONFIG)"}:#': ${TTHEME_BG_BLUR:='*} == "$blur" ]] || __tt_redraw
  [[ ${(M)${(@f)"$(<$TTHEME_CONFIG)"}:#': ${TTHEME_TAB_PALETTE:='*} == "$tab" ]] || { __tt_cli sync && __tt_reload }
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

source $TTHEME_HOME/preview.zsh

__tt_hook() {
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
    -v|--version) __tt_cli --version; return ;;
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
    __tt_unpainted && __tt_paints || return 1
  fi
  if (( ! $# )); then
    if [[ -t 0 && -t 1 ]]; then
      if (( ${#TTHEME_PALETTE} )); then
        __tt_preview hub
      else
        __tt_catalog browse
      fi
    else
      (( ${#TTHEME_PALETTE} )) || { __tt_empty; return }
      __tt_menu
    fi
    return 0
  fi

  case $1 in
    list|add|remove|update|market|new) __tt_catalog "$@"; return ;;
    edit|check|share)
      local REPLY
      __tt_name_of "$TTHEME_SPEC"
      TTHEME_WORN=${TTHEME_PALETTE[$REPLY]:+$REPLY} __tt_catalog "$@"
      return ;;
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
    default)
      __tt_resolve "$2" || return 1
      __tt_keep "$REPLY" ;;
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
  __tt_hook
  __tt_announce
}

() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  local f
  for f in $TTHEME_HOME/ttheme.zsh $TTHEME_HOME/preview.zsh $TTHEME_HOME/palettes.zsh $TTHEME_HOME/adapters/_osc.zsh $TTHEME_HOME/adapters/_wired.zsh $TTHEME_HOME/adapters/_bg.zsh $TTHEME_HOME/adapters/$TTHEME_ADAPTER.zsh; do
    [[ -r $f && ! $f.zwc -nt $f ]] || continue
    zcompile -UR -- $f.$$.zwc $f 2>/dev/null && command mv -f -- $f.$$.zwc $f.zwc 2>/dev/null
    [[ ! -e $f.$$.zwc ]] || command rm -f -- $f.$$.zwc
  done
}
