source "$TTHEME_HOME/adapters/_bg.zsh"

typeset -g TTHEME_WARP_NAME=warp TTHEME_WARP_APP=dev.warp.Warp-Stable TTHEME_WARP_DIR=warp-terminal
case ${__CFBundleIdentifier-}/${TERM_PROGRAM_VERSION-} in
  dev.warp.Warp-Stable/*) ;;
  dev.warp.Warp-Preview/* | */*.preview_[0-9]*)
    TTHEME_WARP_NAME=warp-preview TTHEME_WARP_APP=dev.warp.Warp-Preview TTHEME_WARP_DIR=warp-terminal-preview ;;
  dev.warp.Warp-Dev/* | */*.dev_[0-9]*)
    TTHEME_WARP_NAME=warp-dev TTHEME_WARP_APP=dev.warp.Warp-Dev TTHEME_WARP_DIR=warp-terminal-dev ;;
  dev.warp.WarpOss/*)
    TTHEME_WARP_NAME=warp-oss TTHEME_WARP_APP=dev.warp.WarpOss TTHEME_WARP_DIR=warp-oss ;;
esac
typeset -g TTHEME_WARP_SETTINGS=$HOME/.$TTHEME_WARP_NAME/settings.toml TTHEME_WARP_THEMES=$HOME/.$TTHEME_WARP_NAME/themes TTHEME_WARP_WORN=""
typeset -g TTHEME_WARP_TABS=$TTHEME_STATE_DIR/$TTHEME_WARP_NAME TTHEME_WARP_DB="" TTHEME_WARP_ID="" TTHEME_WARP_LAST="" TTHEME_WARP_SEEN=""
typeset -g TTHEME_WARP_HELD="" TTHEME_WARP_PAIR='{ light = "light", dark = "dark" }'
typeset -gi TTHEME_WARP_OS=0
typeset -g TTHEME_WARP_SHOWING="" TTHEME_WARP_VIEW="" TTHEME_WARP_CODE=""
typeset -gi TTHEME_WARP_VIEWS=0 TTHEME_WARP_FOLLOWS=-1 TTHEME_WARP_UP=0 TTHEME_WARP_SQLPID=0 TTHEME_WARP_HOLD=0
typeset -gF TTHEME_WARP_LIVED=0
typeset -ga TTHEME_WARP_LAID=() TTHEME_WARP_MADE=()
typeset -gA TTHEME_WARP_WAITED=() TTHEME_WARP_KNOWN=()
typeset -g TTHEME_WARP_SQL='with t as (select id, window_id, row_number() over (partition by window_id order by id) - 1 as ix from tabs) select lower(hex(p.uuid)) from app a join windows w on w.id = a.active_window_id join t on t.window_id = w.id and t.ix = w.active_tab_index join pane_nodes n on n.tab_id = t.id and n.is_leaf join pane_leaves l on l.pane_node_id = n.id and l.is_focused join terminal_panes p on p.id = n.id'
if [[ $OSTYPE != darwin* ]]; then
  TTHEME_WARP_SETTINGS=${XDG_CONFIG_HOME:-$HOME/.config}/$TTHEME_WARP_DIR/settings.toml
  TTHEME_WARP_THEMES=${XDG_DATA_HOME:-$HOME/.local/share}/$TTHEME_WARP_DIR/themes
fi

zmodload -F zsh/files b:zf_rm b:zf_mkdir 2>/dev/null
zmodload -F zsh/zselect b:zselect 2>/dev/null
zmodload -F zsh/datetime p:EPOCHREALTIME 2>/dev/null

__tt_paints() { __tt_warp_wired }

__tt_warp_wired() { (( ${TTHEME_TERMINALS[(Ie)warp]} )) && [[ -r $TTHEME_WARP_SETTINGS ]] }

__tt_unpainted() {
  if [[ -t 0 && -t 1 && -r $TTHEME_WARP_SETTINGS ]] && (( ! ${TTHEME_TERMINALS[(Ie)warp]} )) && __tt_cli wire warp; then
    __tt_palettes_load && __tt_hook
    return 0
  fi
  print -u2 "ttheme: Warp takes a palette only through the settings.toml init wires — wire it with \`npx @kecan0406/ttheme@latest init\`"
  return 1
}

__tt_keepable() { return 0 }

__tt_reverts() { return 1 }

__tt_follows_prompt() { return 0 }

__tt_prompted() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  __tt_warp_publish
  __tt_warp_follow
  __tt_warp_follows || __tt_sync
}

__tt_poked() {
  local -i TTHEME_WARP_HOLD=1
  __tt_fresh woke
  __tt_warp_publish
}

__tt_cli_env() {
  local REPLY
  __tt_warp_tab
  [[ -n $REPLY ]] && __tt_warp_here && pass+=(TTHEME_WARP_WEARS=$REPLY)
}

__tt_hear() {
  if [[ -n $TTHEME_PAINTED ]] && __tt_warp_wearing && [[ -n ${TTHEME_PALETTE[$REPLY]} ]]; then
    REPLY=${TTHEME_PALETTE[$REPLY]%% *}
  elif [[ -n $TTHEME_STARTUP && -n ${TTHEME_PALETTE[$TTHEME_STARTUP]} ]]; then
    REPLY=${TTHEME_PALETTE[$TTHEME_STARTUP]%% *}
  else
    REPLY=""
    return 1
  fi
}

__tt_warp_value() {
  setopt localoptions extendedglob
  local -a files=($TTHEME_WARP_THEMES/ttheme-${${1/@/--}/\//--}.${TTHEME_MODE_WORN:-dark}.[0-9a-f](#c8).yaml(Nom))
  (( ${#files} )) || { REPLY=""; return 1 }
  __tt_warp_ref ${files[1]:t} $1
}

__tt_warp_ref() {
  local f=$TTHEME_WARP_THEMES/$1 name=$2 line
  [[ -r $f ]] && IFS= read -r line < $f && [[ $line == 'name: "'*'"' ]] && name=${${line#name: \"}%\"}
  REPLY="{ custom = { name = \"$name\", path = \"$1\" } }"
}

__tt_warp_read() {
  setopt localoptions extendedglob
  local f=$TTHEME_WARP_SETTINGS line
  local -a at=(0 0 0)
  integer i s=0
  reply=() REPLY="" TTHEME_WARP_WORN="" TTHEME_WARP_HELD="" TTHEME_WARP_OS=0
  [[ -r $f ]] || return 1
  reply=("${(@f)$(<$f)}")
  for (( i = 1; i <= $#reply; i++ )); do
    line=${reply[i]}
    if (( s )); then
      [[ $line == [[:space:]]#\[* ]] && break
      if [[ $line == theme[[:space:]]#=* ]]; then
        at[2]=$i
      elif [[ $line == selected_system_themes[[:space:]]#=* ]]; then
        at[3]=$i
      elif [[ $line == system_theme[[:space:]]#=[[:space:]]#true* ]]; then
        TTHEME_WARP_OS=1
      fi
    elif [[ $line == [[:space:]]#'[appearance.themes]'[[:space:]]# ]]; then
      s=$i at[1]=$i
    fi
  done
  TTHEME_WARP_LINES=($at)
  (( at[2] )) && REPLY=${${reply[at[2]]#theme}##[[:space:]]#=[[:space:]]#}
  (( at[3] )) && TTHEME_WARP_HELD=${${reply[at[3]]#selected_system_themes}##[[:space:]]#=[[:space:]]#}
  [[ $REPLY == '{ custom = { name = "'*'", path = "ttheme-'* ]] && TTHEME_WARP_WORN=${${${REPLY#*name = \"}%%\"*}%% · *}
  return 0
}

__tt_warp_says() {
  [[ $REPLY == "$1" ]] || return 1
  if [[ $1 == *'path = "ttheme-'* ]]; then
    (( ! TTHEME_WARP_OS )) || [[ $TTHEME_WARP_HELD == "{ light = $1, dark = $1 }" ]]
  else
    [[ $TTHEME_WARP_HELD != *'path = "ttheme-'* ]]
  fi
}

__tt_warp_set() {
  local REPLY
  local -a reply TTHEME_WARP_LINES
  __tt_bg_settle
  __tt_warp_read && __tt_warp_says "$1" && return 0
  [[ $1 == *'path = "ttheme-'* ]] && __tt_warp_ripe $TTHEME_WARP_THEMES/${${1#*path = \"}%%\"*}
  __tt_warp_write "$1"
}

__tt_warp_ripe() {
  local -a at was
  local -i wait
  zstat -F %s.%N -A at +mtime -- $1 2>/dev/null || return 1
  (( EPOCHREALTIME - at[1] < 0.75 )) || return 0
  zstat -F %s.%N -A was +mtime -- $TTHEME_WARP_SETTINGS 2>/dev/null || was=(0)
  wait=$(( ((at[1] + 0.26 > was[1] + 0.7 ? at[1] + 0.26 : was[1] + 0.7) - EPOCHREALTIME) * 100 + 1 ))
  (( wait > 0 )) && zselect -t $wait
  return 0
}

__tt_warp_write() {
  local REPLY pair base=$TTHEME_HOME/$TTHEME_WARP_NAME.base held=$TTHEME_HOME/$TTHEME_WARP_NAME.system
  local -a at reply TTHEME_WARP_LINES
  integer back=0
  __tt_warp_read || return 1
  __tt_warp_says "$1" && return 0
  if [[ $1 == *'path = "ttheme-'* ]]; then
    if [[ $REPLY != *'path = "ttheme-'* ]]; then
      __tt_put $base "$REPLY" || return 1
    fi
    if (( TTHEME_WARP_OS )); then
      [[ $TTHEME_WARP_HELD == *'path = "ttheme-'* ]] || __tt_put $held "$TTHEME_WARP_HELD" || return 1
      pair="{ light = $1, dark = $1 }"
    fi
  elif [[ $TTHEME_WARP_HELD == *'path = "ttheme-'* ]]; then
    [[ -r $held ]] && pair=$(<$held)
    [[ -n $pair ]] || pair=$TTHEME_WARP_PAIR
    back=1
  fi
  [[ -e $TTHEME_WARP_SETTINGS.ttheme.bak ]] || __tt_put $TTHEME_WARP_SETTINGS.ttheme.bak "${reply[@]}"
  at=($TTHEME_WARP_LINES)
  if [[ -n $pair ]]; then
    if (( at[3] )); then
      reply[at[3]]="selected_system_themes = $pair"
    else
      reply[at[1]]=("${reply[at[1]]}" "selected_system_themes = $pair")
      (( at[2] )) && at[2]=$(( at[2] + 1 ))
    fi
  fi
  if (( at[2] )); then
    reply[at[2]]="theme = $1"
  elif (( at[1] )); then
    reply[at[1]]=("${reply[at[1]]}" "theme = $1")
  else
    reply+=("" "[appearance.themes]" "theme = $1")
  fi
  __tt_put $TTHEME_WARP_SETTINGS "${reply[@]}" || return 1
  (( back )) && zf_rm -f -- $held 2>/dev/null
  __tt_warp_relink
}

__tt_warp_relink() {
  local -a to
  [[ -L $TTHEME_WARP_SETTINGS && ! -d $TTHEME_WARP_SETTINGS ]] && zmodload -F zsh/files b:zf_ln b:zf_mv b:zf_rm 2>/dev/null &&
    zstat -L -A to +link -- $TTHEME_WARP_SETTINGS 2>/dev/null || return 0
  zf_rm -f -- $TTHEME_WARP_SETTINGS.$$ 2>/dev/null
  [[ -n $TTHEME_WRITES ]] && print -rl -- $TTHEME_WARP_SETTINGS.$$ $TTHEME_WARP_SETTINGS >> $TTHEME_WRITES
  zf_ln -s -- $to[1] $TTHEME_WARP_SETTINGS.$$ 2>/dev/null && zf_mv -f -- $TTHEME_WARP_SETTINGS.$$ $TTHEME_WARP_SETTINGS 2>/dev/null ||
    zf_rm -f -- $TTHEME_WARP_SETTINGS.$$ 2>/dev/null
  return 0
}

__tt_warp_wearing() {
  local -a reply TTHEME_WARP_LINES
  __tt_warp_read || return 1
  REPLY=$TTHEME_WARP_WORN
  [[ -n $REPLY ]]
}

__tt_warp_want() {
  local pal=$1 view=$2 base=$TTHEME_HOME/$TTHEME_WARP_NAME.base
  if [[ -n $pal && -n ${TTHEME_PALETTE[$pal]} ]]; then
    if [[ -n $view && -r $TTHEME_WARP_THEMES/$view ]]; then
      __tt_warp_ref $view $pal
    else
      __tt_warp_value $pal
    fi
  elif [[ -n $TTHEME_STARTUP && -n ${TTHEME_PALETTE[$TTHEME_STARTUP]} ]]; then
    __tt_warp_value $TTHEME_STARTUP
  elif [[ -e $base ]]; then
    REPLY=$(<$base)
    [[ -n $REPLY ]] || REPLY='"dark"'
  else
    __tt_warp_wearing || return 1
    REPLY='"dark"'
  fi
  return 0
}

__tt_warp_wear() {
  local value=$1
  [[ $value != *'path = "ttheme-'* || -e $TTHEME_WARP_THEMES/${${value#*path = \"}%%\"*} ]] || return 1
  __tt_warp_set "$value" || return 1
  [[ $value == *'path = "ttheme-'* ]] || zf_rm -f -- $TTHEME_HOME/$TTHEME_WARP_NAME.base 2>/dev/null
  return 0
}

__tt_warp_here() {
  local fd f=$TTHEME_WARP_TABS/.active
  (( ! TTHEME_WARP_HOLD )) || return 1
  [[ -r $f && -e $TTHEME_WARP_TABS/.follow && -n $WARP_TERMINAL_SESSION_UUID ]] || return 0
  [[ "$(<$f)" == "$WARP_TERMINAL_SESSION_UUID" ]] && return 0
  zsystem flock -t 0 -f fd $TTHEME_WARP_TABS/.follow 2>/dev/null || return 1
  zsystem flock -u $fd
  return 0
}

__tt_warp_publish() {
  local REPLY
  __tt_bg_settle
  if (( ! $# )); then
    __tt_warp_tab
    __tt_warp_record "$REPLY"
  else
    __tt_warp_record "$@"
  fi
}

__tt_warp_record() {
  local id=$WARP_TERMINAL_SESSION_UUID f line
  [[ ${#id} == 32 && -e $TTHEME_HOME ]] || return 0
  f=$TTHEME_WARP_TABS/$id line="$$ ${TTHEME_STARTUP:--} ${1:--} ${2:--} ${TTHEME_PALETTES_AT:--} ${TTHEME_PINS_AT:--}"
  [[ -r $f && "$(<$f)" == "$line" ]] && return 0
  [[ -d $TTHEME_WARP_TABS ]] || zf_mkdir -p $TTHEME_WARP_TABS 2>/dev/null || return 0
  __tt_put $f "$line" 2>/dev/null
}

__tt_warp_db() {
  setopt localoptions extendedglob
  local -a db
  [[ -n $TTHEME_WARP_DB ]] && return 0
  if [[ $OSTYPE == darwin* ]]; then
    db=($HOME/Library/Group\ Containers/*.dev.warp/Library/Application\ Support/$TTHEME_WARP_APP/warp.sqlite(N) $HOME/Library/Application\ Support/$TTHEME_WARP_APP/warp.sqlite(N))
  else
    db=(${XDG_STATE_HOME:-$HOME/.local/state}/$TTHEME_WARP_DIR/warp.sqlite(N))
  fi
  TTHEME_WARP_DB=${db[1]}
  [[ -n $TTHEME_WARP_DB ]]
}

__tt_warp_follows() {
  setopt localoptions extendedglob
  (( TTHEME_WARP_FOLLOWS < 0 )) || return $(( ! TTHEME_WARP_FOLLOWS ))
  TTHEME_WARP_FOLLOWS=0
  [[ -o interactive && $WARP_TERMINAL_SESSION_UUID == [0-9a-f](#c32) ]] && (( $+commands[sqlite3] )) && __tt_warp_db || return 1
  TTHEME_WARP_FOLLOWS=1
}

__tt_warp_follow() {
  local fd lock=$TTHEME_WARP_TABS/.follow
  __tt_warp_follows || return 0
  if [[ ! -e $lock ]]; then
    [[ -d $TTHEME_WARP_TABS ]] || zf_mkdir -p $TTHEME_WARP_TABS 2>/dev/null || return 0
    : >>| $lock 2>/dev/null || return 0
  fi
  zsystem flock -t 0 -f fd $lock 2>/dev/null || return 0
  zsystem flock -u $fd
  zsh -fc 'source $1; __tt_warp_follower' zsh $TTHEME_HOME/ttheme.zsh </dev/null >/dev/null 2>&1 &!
}

__tt_warp_active() {
  setopt localoptions extendedglob
  local line
  REPLY=""
  if (( ! TTHEME_WARP_SQLPID )) || ! kill -0 $TTHEME_WARP_SQLPID 2>/dev/null; then
    coproc sqlite3 -readonly -batch -cmd '.timeout 300' $TTHEME_WARP_DB 2>/dev/null
    TTHEME_WARP_SQLPID=$!
  fi
  if print -rp -- "$TTHEME_WARP_SQL; select 'end';" 2>/dev/null; then
    while read -rp -t 1 line; do
      [[ $line == end ]] && { [[ $REPLY == [0-9a-f](#c32) ]]; return }
      REPLY=$line
    done
  fi
  TTHEME_WARP_SQLPID=0 REPLY=""
  return 1
}

__tt_warp_stamp() {
  local -a at
  zstat -F %s.%N -A at +mtime -- $TTHEME_WARP_DB-wal 2>/dev/null || zstat -F %s.%N -A at +mtime -- $TTHEME_WARP_DB 2>/dev/null || return 1
  REPLY=$at[1]
}

__tt_warp_line() {
  local pal=${3#-} view=${4#-}
  [[ $2 != - && -z $TTHEME_STARTUP ]] && pal="" view=""
  __tt_warp_want "$pal" "$view"
}

__tt_warp_poke() {
  local f=$TTHEME_WARP_TABS/$TTHEME_WARP_ID pins
  local -a rec at=("")
  local -F end
  [[ -n $TTHEME_WARP_ID && -r $f ]] || return 0
  rec=(${=${"$(<$f)"}})
  zstat -F %s.%N -A at +mtime -- $TTHEME_PINS_FILE 2>/dev/null
  pins=${at[1]:--}
  [[ $rec[1] == <-> && "$rec[5] $rec[6]" != "${TTHEME_PALETTES_AT:--} $pins" ]] || return 0
  kill -URG $rec[1] 2>/dev/null || return 0
  [[ $rec[6] == "$pins" || ${TTHEME_WARP_WAITED[$rec[1]]} == "$pins" ]] && return 0
  TTHEME_WARP_WAITED[$rec[1]]=$pins
  end=$(( EPOCHREALTIME + 0.15 ))
  while (( EPOCHREALTIME < end )); do
    zselect -t 1
    rec=(${=${"$(<$f)"}})
    [[ $rec[6] == "$pins" ]] && return 0
  done
  return 0
}

__tt_warp_tick() {
  local line REPLY
  local -a at rec
  integer came=0
  if __tt_warp_stamp && [[ $REPLY != "$TTHEME_WARP_SEEN" ]]; then
    TTHEME_WARP_SEEN=$REPLY
    if __tt_warp_active; then
      (( TTHEME_WARP_UP )) || came=1
      TTHEME_WARP_UP=1
      if [[ $REPLY != "$TTHEME_WARP_ID" ]]; then
        TTHEME_WARP_ID=$REPLY came=1
        __tt_put $TTHEME_WARP_TABS/.active $REPLY 2>/dev/null
      fi
    else
      TTHEME_WARP_UP=0
    fi
  fi
  zstat -F %s.%N -A at +mtime -- $TTHEME_HOME/palettes.zsh 2>/dev/null && [[ $at[1] != "$TTHEME_PALETTES_AT" ]] && __tt_palettes_load
  (( came )) && __tt_warp_poke
  [[ -n $TTHEME_WARP_ID && -r $TTHEME_WARP_TABS/$TTHEME_WARP_ID ]] && rec=(${=${"$(<$TTHEME_WARP_TABS/$TTHEME_WARP_ID)"}})
  line="$TTHEME_WARP_ID ${rec[1,4]}"
  [[ "$line $TTHEME_PALETTES_AT" == "$TTHEME_WARP_LAST" ]] && return 0
  TTHEME_WARP_LAST="$line $TTHEME_PALETTES_AT"
  (( $#rec )) && __tt_warp_line $rec[1,4] && __tt_warp_wear "$REPLY"
  return 0
}

__tt_warp_live() {
  setopt localoptions extendedglob
  local f pid
  integer live=0
  for f in $TTHEME_WARP_TABS/[0-9a-f](#c32)(N); do
    pid=${"$(<$f)"%% *}
    if [[ $pid == <-> ]] && kill -0 $pid 2>/dev/null; then
      live=1
    else
      zf_rm -f -- $f 2>/dev/null
    fi
  done
  (( live ))
}

__tt_warp_code() {
  local -a at
  zstat -F %s.%N -A at +mtime -- $TTHEME_HOME/adapters/warp.zsh 2>/dev/null
  REPLY=$at[1]
}

__tt_warp_follower() {
  emulate -L zsh
  local fd REPLY
  __tt_warp_db && zsystem flock -t 0 -f fd $TTHEME_WARP_TABS/.follow 2>/dev/null || return 0
  trap '' HUP PIPE
  __tt_warp_code
  TTHEME_WARP_CODE=$REPLY TTHEME_WARP_LIVED=$EPOCHREALTIME
  while [[ -e $TTHEME_HOME/palettes.zsh && -e $TTHEME_WARP_DB ]]; do
    __tt_warp_tick
    if (( EPOCHREALTIME - TTHEME_WARP_LIVED >= 5 )); then
      TTHEME_WARP_LIVED=$EPOCHREALTIME
      __tt_warp_live || break
      __tt_warp_code
      if [[ $REPLY != "$TTHEME_WARP_CODE" ]]; then
        coproc :
        zsystem flock -u $fd
        exec zsh -fc 'source $1; __tt_warp_follower' zsh $TTHEME_HOME/ttheme.zsh
      fi
    fi
    zselect -t 10
  done
  zf_rm -f -- $TTHEME_WARP_TABS/.active 2>/dev/null
}

__tt_apply() {
  local REPLY pal
  __tt_name_of "$1"
  pal=$REPLY
  [[ -n ${TTHEME_PALETTE[$pal]} ]] || return 1
  __tt_bg_settle
  TTHEME_WARP_VIEW=""
  __tt_warp_publish $pal
  __tt_warp_here && __tt_warp_want $pal && __tt_warp_wear "$REPLY"
  export TTHEME_PAINTED=1
  return 0
}

__tt_osc_reset() {
  local REPLY
  __tt_bg_settle
  TTHEME_WARP_VIEW=""
  __tt_warp_publish ""
  __tt_warp_here && __tt_warp_want "" && __tt_warp_wear "$REPLY"
  unset TTHEME_PAINTED
  return 0
}

__tt_warp_tab() {
  REPLY=""
  [[ -n $TTHEME_PAINTED && -n $TTHEME_SPEC ]] || return 0
  __tt_name_of "$TTHEME_SPEC"
  [[ -n ${TTHEME_PALETTE[$REPLY]} ]] || REPLY=""
}

__tt_shown() {
  local REPLY pal
  __tt_warp_tab
  pal=$REPLY
  __tt_warp_publish "$pal"
  if [[ $2 == force ]] || ! __tt_warp_follows; then
    __tt_warp_here && __tt_warp_want "$pal" && __tt_warp_wear "$REPLY"
  fi
  return 1
}

__tt_reloaded() {
  __tt_paints && __tt_shown "" force
  return 0
}

__tt_bg_shown() { __tt_warp_wearing }

__tt_bg_refresh() { __tt_warp_unview }

__tt_bg_hide() {
  local -A plain=(${=TTHEME_WARP_PLAIN})
  local file=${plain[${${1/@/--}/\//--}]} REPLY
  [[ -n $file ]] && __tt_warp_ref $file $1 && __tt_warp_set "$REPLY"
  TTHEME_WARP_VIEW=""
}

__tt_bg_cells() {
  local REPLY resp
  local -a px cells
  __tt_ask $'\e[14t\e[18t' || return 0
  resp=$REPLY
  [[ $resp == *'[4;'<1->';'<1->t* && $resp == *'[8;'<1->';'<1->t* ]] || return 0
  px=(${(s:;:)${${resp##*\[4;}%%t*}}) cells=(${(s:;:)${${resp##*\[8;}%%t*}})
  bgch=$(( 2 * px[1] / cells[1] )) bgcw=$(( 2 * px[2] / cells[2] ))
}

__tt_cell() { return 1 }

__tt_bg_transmit() {
  local b64=base64
  local -a wrap=(-w 4096) chunks
  [[ $OSTYPE == darwin* ]] && b64=/usr/bin/base64 wrap=(-b 4096)
  chunks=("${(@f)$($b64 $wrap < $2 2>/dev/null)}")
  [[ -n $chunks[1] ]] || return 0
  printf '\e_Ga=t,f=100,i=%d,m=%d,q=2;%s\e\\' $1 $(( ${#chunks} > 1 )) "$chunks[1]"
  (( ${#chunks} > 2 )) && printf '\e_Gm=1,q=2;%s\e\\' "${(@)chunks[2,-2]}"
  (( ${#chunks} > 1 )) && printf '\e_Gm=0,q=2;%s\e\\' "$chunks[-1]"
  return 0
}

__tt_bg_crop() {
  __tt_bg_send $1
  REPLY="$REPLY $4"
}

__tt_warp_tuned() {
  [[ $1 == *:* ]] && return 0
  __tt_bg_load $1
  [[ "${bgsize[$1]} ${bgpos[$1]} ${bgop[$1]} ${bgoff[$1]}" != "${bgload[$1]}" ]]
}

__tt_warp_saved() {
  local name=$1
  if [[ "${bgsize[$name]} ${bgpos[$name]} ${bgop[$name]}" == "${bgdef[$name]}" ]]; then
    REPLY=${bgbase[$name]}
  elif [[ ${bgsize[$name]} == fill ]]; then
    REPLY=${bgfill[$name]}
  elif [[ "${bgsize[$name]} ${bgpos[$name]}" == "${bgshotkey[$name]}" && -r ${bgshot[$name]} ]]; then
    REPLY=${bgshot[$name]}
  else
    REPLY=${bgsrc[$name]%.png}@${bgsize[$name]}-${TTHEME_BG_POSITIONS[${bgpos[$name]}]}-${2}x$3.png
  fi
}

__tt_warp_laid() {
  setopt localoptions nomultibyte
  local s=$2$'\n'${(L)${TTHEME_PALETTE[$1]}%% *} c
  local -i h=16#811c9dc5 i n
  for (( i = 1; i <= $#s; i++ )); do
    c=${s[i]}
    n=$(( #c ))
    (( n < 0 )) && (( n += 256 ))
    (( h = ((h ^ n) * 16777619) & 16#ffffffff ))
  done
  printf -v REPLY '%s/ttheme-%s.%08x.png' $TTHEME_WARP_THEMES ${${1/@/--}/\//--} $h
}

__tt_warp_view() {
  local name=$1 pal=${1%:*} img="" out="" canvas="" place="" REPLY
  local -a wh fr
  local -i W=$(( pw * bgcw )) H=$(( ph * bgch )) op
  local -A plain=(${=TTHEME_WARP_PLAIN})
  __tt_bg_load $name
  op=$(( ${bgop[$name]} * 100 + 0.5 ))
  [[ -f $TTHEME_WARP_THEMES/${plain[${${pal/@/--}/\//--}]} ]] || return 1
  if (( ! bgoff[$name] )); then
    __tt_warp_saved $name $W $H
    img=$REPLY
    __tt_warp_laid $pal $img
    out=$REPLY
    if [[ ! -r $out && ! -r $img ]]; then
      img=${bgsrc[$name]}
      __tt_bg_dim "$img" && (( W && H )) || return 1
      wh=(${=bgdim[$img]})
      __tt_bg_frame $wh[1] $wh[2] $W $H ${bgsize[$name]} ${bgpos[$name]} contain ${bgfocus[$name]}
      fr=(${=REPLY})
      canvas=${W}x$H
      printf -v place '%dx%d%+d%+d' $fr
    fi
  fi
  __tt_warp_ask view $pal "$out" $op "$img" "$canvas" "$place"
}

__tt_warp_ask() {
  local view="$2 $3 $4" theme
  if [[ $1 == plain ]]; then
    __tt_pv_bg_busy || [[ -n $TTHEME_WARP_SHOWING ]] && __tt_bg_ask "" __tt_warp_plain $2
    return 0
  fi
  ! __tt_pv_bg_busy && [[ $view == "$TTHEME_WARP_VIEW" ]] && return 0
  (( ${+TTHEME_BG_FAILED[$view]} )) && return 1
  theme=${TTHEME_WARP_KNOWN[$view]}
  if [[ -z $theme || ! -e $TTHEME_WARP_THEMES/$theme ]]; then
    theme=ttheme-${${2/@/--}/\//--}.view-$$-$(( ++TTHEME_WARP_VIEWS )).yaml
    TTHEME_WARP_MADE+=($theme) TTHEME_WARP_KNOWN[$view]=$theme
  fi
  [[ -n $3 && ! -r $3 ]] && TTHEME_WARP_LAID+=($3)
  __tt_bg_ask "$view" __tt_warp_job $theme "${(@)argv[2,-1]}"
}

__tt_warp_job() {
  local theme=$1 pal=$2 out=$3 op=$4 img=$5 canvas=$6 place=$7 base line REPLY
  local -a lines
  local -A plain=(${=TTHEME_WARP_PLAIN})
  if [[ ! -e $TTHEME_WARP_THEMES/$theme ]]; then
    base=$TTHEME_WARP_THEMES/${plain[${${pal/@/--}/\//--}]}
    [[ -f $base ]] || return 1
    for line in "${(@f)$(<$base)}"; do
      [[ -n $out && $line == 'name: "'*'"' ]] && line="${line%\"} · picture\""
      lines+=("$line")
      [[ -n $out && $line == details:* ]] && lines+=("background_image:" "  path: \"$out\"" "  opacity: $op")
    done
    __tt_put $TTHEME_WARP_THEMES/$theme "${lines[@]}" || return 1
  fi
  if [[ -n $out && ! -r $out ]]; then
    __tt_cli flatten "$img" "$out" "${${TTHEME_PALETTE[$pal]}%% *}" 1 $canvas $place >/dev/null 2>&1 || return 1
  fi
  __tt_warp_ripe $TTHEME_WARP_THEMES/$theme
  __tt_warp_here || return 0
  __tt_warp_ref $theme $pal
  __tt_warp_write "$REPLY" || return 1
  __tt_warp_record $pal $theme
}

__tt_warp_plain() {
  local REPLY want
  local -a reply TTHEME_WARP_LINES
  __tt_warp_here && __tt_warp_want $1 || return 0
  want=$REPLY
  if ! __tt_warp_read || ! __tt_warp_says "$want"; then
    [[ $want == *'path = "ttheme-'* ]] && __tt_warp_ripe $TTHEME_WARP_THEMES/${${want#*path = \"}%%\"*}
    __tt_warp_write "$want" || return 1
  fi
  __tt_warp_record $1
}

__tt_bg_done() {
  local REPLY theme=${TTHEME_WARP_KNOWN[$1]}
  local -a reply TTHEME_WARP_LINES
  bgname=""
  if [[ -z $1 ]]; then
    TTHEME_WARP_SHOWING="" TTHEME_WARP_VIEW=""
    return 0
  fi
  if __tt_warp_read && [[ -n $theme && $REPLY == *"path = \"$theme\""* ]]; then
    TTHEME_WARP_SHOWING=$theme TTHEME_WARP_VIEW=$1
  elif __tt_warp_here; then
    TTHEME_BG_FAILED[$1]=1
  fi
}

__tt_warp_unview() {
  __tt_bg_settle
  [[ -n $TTHEME_WARP_SHOWING ]] || return 0
  [[ -n $1 ]] && __tt_apply "$1"
  zf_rm -f -- $TTHEME_WARP_THEMES/$TTHEME_WARP_SHOWING 2>/dev/null
  TTHEME_WARP_SHOWING="" TTHEME_WARP_VIEW=""
}

__tt_pv_bg_show() {
  (( bgcw )) || return 0
  local spec=${TTHEME_PALETTE[${1%:*}]} REPLY
  bgname=$1
  if __tt_warp_tuned $1; then
    __tt_warp_view $1 && applied=$spec painted=$spec
  elif [[ $spec == "$applied" ]]; then
    if [[ -n $TTHEME_WARP_SHOWING ]] || __tt_pv_bg_busy; then
      __tt_warp_ask plain ${1%:*}
    elif __tt_warp_wearing && [[ $REPLY == "${1%:*}" ]]; then
      local want
      local -a reply TTHEME_WARP_LINES
      __tt_warp_value ${1%:*}
      want=$REPLY
      __tt_warp_read
      __tt_warp_says "$want" || __tt_warp_set "$want"
    fi
  fi
  return 0
}

__tt_pv_bg_close() {
  __tt_bg_settle
  (( ${+bgedit[$bgname]} )) || [[ -n $bgname && ${bgview[${bgname%:*}]} == "$bgname" ]] || __tt_warp_unview "$applied"
  (( bgcw )) && { printf '\e_Ga=d,d=A,q=2\e\\'; __tt_pv_bg_lost }
  [[ -z $bgcut ]] || { ( zselect -t 1000; rm -rf -- $bgcut ) &!; bgcut="" }
  [[ $msg == "Loading the background" ]] && msg="" msgt=0
  (( ${#TTHEME_WARP_LAID} + ${#TTHEME_WARP_MADE} )) || return 0
  local -a made=($TTHEME_WARP_MADE) laid=($TTHEME_WARP_LAID)
  TTHEME_WARP_MADE=() TTHEME_WARP_LAID=() TTHEME_WARP_KNOWN=()
  ( zselect -t 1000; __tt_warp_sweep $made -- $laid ) &!
}

__tt_warp_sweep() {
  setopt localoptions extendedglob
  local f REPLY
  local -a reply TTHEME_WARP_LINES
  local -A used
  __tt_warp_read
  while (( $# )) && [[ $1 != -- ]]; do
    [[ $REPLY == *"path = \"$1\""* ]] || zf_rm -f -- $TTHEME_WARP_THEMES/$1 2>/dev/null
    shift
  done
  (( $# )) && shift
  for f in $TTHEME_WARP_THEMES/ttheme-*.yaml(N); do
    [[ "$(<$f)" == (#b)*$'\n  path: "'([^\"]##)'"'* ]] && used[$match[1]]=1
  done
  for f; do
    (( ${+used[$f]} )) || zf_rm -f -- $f 2>/dev/null
  done
}
