source $TTHEME_HOME/adapters/_bg.zsh

typeset -g TTHEME_WARP_SETTINGS=$HOME/.warp/settings.toml TTHEME_WARP_THEMES=$HOME/.warp/themes TTHEME_WARP_WORN=""
typeset -g TTHEME_WARP_TABS=$TTHEME_STATE_DIR/warp TTHEME_WARP_DB="" TTHEME_WARP_ID="" TTHEME_WARP_LAST="" TTHEME_WARP_LOOK="" TTHEME_WARP_SEEN=""
typeset -g TTHEME_WARP_SHOWING="" TTHEME_WARP_VIEW="" TTHEME_WARP_CODE="" TTHEME_WARP_RECORDS=""
typeset -gi TTHEME_WARP_VIEWS=0 TTHEME_WARP_BUSY=0 TTHEME_WARP_FOLLOWS=-1 TTHEME_WARP_UP=0 TTHEME_WARP_SQLPID=0 TTHEME_WARP_MIXED=0 TTHEME_WARP_HOLD=0
typeset -gF TTHEME_WARP_WARM=0 TTHEME_WARP_PRIMED=0 TTHEME_WARP_LIVED=0
typeset -ga TTHEME_WARP_LAID=()
typeset -gA TTHEME_WARP_WAITED=()
typeset -g TTHEME_WARP_SQL='with t as (select id, window_id, row_number() over (partition by window_id order by id) - 1 as ix from tabs) select lower(hex(p.uuid)) from app a join windows w on w.id = a.active_window_id join t on t.window_id = w.id and t.ix = w.active_tab_index join pane_nodes n on n.tab_id = t.id and n.is_leaf join pane_leaves l on l.pane_node_id = n.id and l.is_focused join terminal_panes p on p.id = n.id'
if [[ $OSTYPE != darwin* ]]; then
  TTHEME_WARP_SETTINGS=${XDG_CONFIG_HOME:-$HOME/.config}/warp-terminal/settings.toml
  TTHEME_WARP_THEMES=${XDG_DATA_HOME:-$HOME/.local/share}/warp-terminal/themes
fi

zmodload -F zsh/files b:zf_rm b:zf_mkdir 2>/dev/null
zmodload -F zsh/zselect b:zselect 2>/dev/null
zmodload -F zsh/datetime p:EPOCHREALTIME 2>/dev/null

__tt_paints() { __tt_warp_wired }

__tt_warp_wired() { (( ${TTHEME_TERMINALS[(Ie)warp]} )) && [[ -r $TTHEME_WARP_SETTINGS ]] }

__tt_unpainted() {
  print -u2 "ttheme: Warp takes a palette only through the settings.toml init wires — wire it with \`npx @kecan0406/ttheme@latest init\`"
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

if (( ! $+functions[TRAPURG] )); then
  TRAPURG() {
    emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
    (( ${#zsh_eval_context} == 1 )) && __tt_warp_poked
    return 0
  }
fi

__tt_warp_poked() {
  local -i TTHEME_WARP_HOLD=1
  __tt_fresh
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
  local file=ttheme-${${1/@/--}/\//--}
  local -a pics=($TTHEME_WARP_THEMES/$file.[0-9a-f](#c8).yaml(Nom))
  (( ${#pics} )) && file=${pics[1]:t:r}
  REPLY="{ custom = { name = \"$1\", path = \"$file.yaml\" } }"
}

__tt_warp_read() {
  setopt localoptions extendedglob
  local f=$TTHEME_WARP_SETTINGS line
  local -a at=(0 0)
  integer i s=0
  reply=() REPLY="" TTHEME_WARP_WORN=""
  [[ -r $f ]] || return 1
  reply=("${(@f)$(<$f)}")
  for (( i = 1; i <= $#reply; i++ )); do
    line=${reply[i]}
    if (( s )); then
      [[ $line == [[:space:]]#\[* ]] && break
      [[ $line == theme[[:space:]]#=* ]] && { at=($s $i); break }
    elif [[ $line == [[:space:]]#'[appearance.themes]'[[:space:]]# ]]; then
      s=$i at=($s 0)
    fi
  done
  TTHEME_WARP_LINES=($at)
  (( at[2] )) && REPLY=${${reply[at[2]]#theme}##[[:space:]]#=[[:space:]]#}
  [[ $REPLY == '{ custom = { name = "'*'", path = "ttheme-'* ]] && TTHEME_WARP_WORN=${${REPLY#*name = \"}%%\"*}
  return 0
}

__tt_warp_set() {
  local REPLY
  local -a at reply TTHEME_WARP_LINES
  __tt_warp_read || return 1
  [[ $REPLY == "$1" ]] && return 0
  if [[ $1 == *'path = "ttheme-'* && -z $TTHEME_WARP_WORN && ! -e $TTHEME_HOME/warp.base ]]; then
    __tt_put $TTHEME_HOME/warp.base "$REPLY" || return 1
  fi
  [[ -e $TTHEME_WARP_SETTINGS.ttheme.bak ]] || __tt_put $TTHEME_WARP_SETTINGS.ttheme.bak "${reply[@]}"
  at=($TTHEME_WARP_LINES)
  if (( at[2] )); then
    reply[at[2]]="theme = $1"
  elif (( at[1] )); then
    reply[at[1]]=("${reply[at[1]]}" "theme = $1")
  else
    reply+=("" "[appearance.themes]" "theme = $1")
  fi
  __tt_put $TTHEME_WARP_SETTINGS "${reply[@]}"
}

__tt_warp_wearing() {
  local -a reply TTHEME_WARP_LINES
  __tt_warp_read || return 1
  REPLY=$TTHEME_WARP_WORN
  [[ -n $REPLY ]]
}

__tt_warp_want() {
  local pal=$1 view=$2 base=$TTHEME_HOME/warp.base
  if [[ -n $pal && -n ${TTHEME_PALETTE[$pal]} ]]; then
    if [[ -n $view && -r $TTHEME_WARP_THEMES/$view ]]; then
      REPLY="{ custom = { name = \"$pal\", path = \"$view\" } }"
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
  local -a at
  integer wait
  if [[ $value == *'path = "ttheme-'* ]]; then
    zstat -F %s.%N -A at +mtime -- $TTHEME_WARP_THEMES/${${value#*path = \"}%%\"*} 2>/dev/null || return 1
    wait=$(( (0.26 - (EPOCHREALTIME - at[1])) * 100 ))
    (( wait > 0 )) && zselect -t $wait
  fi
  __tt_warp_set "$value" || return 1
  [[ $value == *'path = "ttheme-'* ]] || zf_rm -f -- $TTHEME_HOME/warp.base 2>/dev/null
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
  local id=$WARP_TERMINAL_SESSION_UUID f pal=$1 line REPLY
  [[ ${#id} == 32 && -e $TTHEME_HOME ]] || return 0
  if (( ! $# )); then
    __tt_warp_tab
    pal=$REPLY
  fi
  f=$TTHEME_WARP_TABS/$id line="$$ ${TTHEME_STARTUP:--} ${pal:--} ${2:--} ${TTHEME_PALETTES_AT:--} ${TTHEME_PINS_AT:--}"
  [[ -r $f && "$(<$f)" == "$line" ]] && return 0
  [[ -d $TTHEME_WARP_TABS ]] || zf_mkdir -p $TTHEME_WARP_TABS 2>/dev/null || return 0
  __tt_put $f "$line" 2>/dev/null
}

__tt_warp_db() {
  setopt localoptions extendedglob
  local -a db
  [[ -n $TTHEME_WARP_DB ]] && return 0
  if [[ $OSTYPE == darwin* ]]; then
    db=($HOME/Library/Group\ Containers/*.dev.warp/Library/Application\ Support/dev.warp.Warp-Stable/warp.sqlite(N) $HOME/Library/Application\ Support/dev.warp.Warp-Stable/warp.sqlite(N))
  else
    db=(${XDG_STATE_HOME:-$HOME/.local/state}/warp-terminal/warp.sqlite(N))
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

__tt_warp_mixed() {
  setopt localoptions extendedglob
  local f pal view
  local -a rec
  local -A looks
  for f in $TTHEME_WARP_TABS/[0-9a-f](#c32)(N); do
    rec=(${=${"$(<$f)"}})
    pal=${rec[3]#-} view=${rec[4]#-}
    [[ $rec[2] != - && -z $TTHEME_STARTUP ]] && pal="" view=""
    pal="${pal:-$TTHEME_STARTUP} $view"
    looks[$pal]=1
  done
  (( ${#looks} > 1 ))
}

__tt_warp_prime() {
  local fd byte
  sysopen -rw -u fd $TTHEME_WARP_SETTINGS 2>/dev/null || return 0
  sysread -s 1 -i $fd byte && sysseek -u $fd 0 && syswrite -o $fd -- $byte
  exec {fd}>&-
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
  integer recount=0 came=0
  if __tt_warp_stamp && [[ $REPLY != "$TTHEME_WARP_SEEN" ]]; then
    TTHEME_WARP_SEEN=$REPLY
    if __tt_warp_active; then
      (( TTHEME_WARP_UP )) || came=1
      TTHEME_WARP_UP=1
      if [[ $REPLY != "$TTHEME_WARP_ID" ]]; then
        TTHEME_WARP_ID=$REPLY recount=1 came=1
        __tt_put $TTHEME_WARP_TABS/.active $REPLY 2>/dev/null
      fi
    else
      TTHEME_WARP_UP=0
    fi
  fi
  zstat -F %s.%N -A at +mtime -- $TTHEME_HOME/palettes.zsh 2>/dev/null && [[ $at[1] != "$TTHEME_PALETTES_AT" ]] && __tt_palettes_load && recount=1
  zstat -F %s.%N -A at +mtime -- $TTHEME_WARP_TABS 2>/dev/null && [[ $at[1] != "$TTHEME_WARP_RECORDS" ]] && TTHEME_WARP_RECORDS=$at[1] recount=1
  if (( recount )); then
    __tt_warp_mixed
    TTHEME_WARP_MIXED=$(( ! $? ))
  fi
  (( came )) && __tt_warp_poke
  [[ -n $TTHEME_WARP_ID && -r $TTHEME_WARP_TABS/$TTHEME_WARP_ID ]] && rec=(${=${"$(<$TTHEME_WARP_TABS/$TTHEME_WARP_ID)"}})
  line="$TTHEME_WARP_ID ${rec[1,4]}"
  [[ "$line $TTHEME_PALETTES_AT" == "$TTHEME_WARP_LAST" ]] && return 0
  [[ ${TTHEME_WARP_LOOK%% *} == "$TTHEME_WARP_ID" && "$TTHEME_WARP_ID ${rec[3,4]}" != "$TTHEME_WARP_LOOK" ]] && TTHEME_WARP_WARM=$(( EPOCHREALTIME + 3 ))
  TTHEME_WARP_LAST="$line $TTHEME_PALETTES_AT" TTHEME_WARP_LOOK="$TTHEME_WARP_ID ${rec[3,4]}"
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

__tt_pv_conf_rows() {
  cvars+=(TTHEME_WARP_FAST) clabel+=("Warp tabs") cchoice+=("on off") cshow+=("on off")
  cnote+=(
    TTHEME_WARP_FAST:on "About 0.2 s per switch, for about 8% CPU"
    TTHEME_WARP_FAST:off "About 0.6 s per switch"
  )
}

__tt_warp_warming() {
  [[ $TTHEME_WARP_FAST == on ]] && (( TTHEME_WARP_UP && ( TTHEME_WARP_MIXED || EPOCHREALTIME < TTHEME_WARP_WARM ) ))
}

__tt_warp_wait() {
  local REPLY
  local -F now=$EPOCHREALTIME end=$(( EPOCHREALTIME + 0.1 ))
  if ! __tt_warp_warming; then
    zselect -t 10
    return 0
  fi
  while (( now < end )); do
    if (( now - TTHEME_WARP_PRIMED >= 0.25 )); then
      __tt_warp_prime
      TTHEME_WARP_PRIMED=$now
    fi
    zselect -t 2
    __tt_warp_stamp && [[ $REPLY != "$TTHEME_WARP_SEEN" ]] && return 0
    now=$EPOCHREALTIME
  done
  return 0
}

__tt_warp_code() {
  local -a at conf
  zstat -F %s.%N -A at +mtime -- $TTHEME_HOME/adapters/warp.zsh 2>/dev/null
  zstat -F %s.%N -A conf +mtime -- $TTHEME_CONFIG 2>/dev/null
  REPLY="$at[1] $conf[1]"
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
    __tt_warp_wait
  done
  zf_rm -f -- $TTHEME_WARP_TABS/.active 2>/dev/null
}

__tt_apply() {
  local REPLY pal
  __tt_name_of "$1"
  pal=$REPLY
  [[ -n ${TTHEME_PALETTE[$pal]} ]] || return 1
  TTHEME_WARP_VIEW=""
  __tt_warp_publish $pal
  __tt_warp_here && __tt_warp_want $pal && __tt_warp_wear "$REPLY"
  export TTHEME_PAINTED=1
  return 0
}

__tt_osc_reset() {
  local REPLY
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

__tt_bg_bake() {
  local place
  printf -v place '%dx%d%+d%+d' $5 $6 $7 $8
  __tt_cli bake "$1" "$2" "${3}x$4" "$place" >/dev/null 2>&1
}

__tt_bg_hide() {
  __tt_warp_set "{ custom = { name = \"$1\", path = \"ttheme-${${1/@/--}/\//--}.yaml\" } }"
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

__tt_bg_transmit() {
  local data
  integer at=1 n
  data=${"$(base64 < $2 2>/dev/null)"//$'\n'/}
  n=${#data}
  (( n )) || return 0
  printf '\e_Ga=t,f=100,i=%d,m=%d,q=2;%s\e\\' $1 $(( n > 4096 )) "${data[1,4096]}"
  for (( at = 4097; at <= n; at += 4096 )); do
    printf '\e_Gm=%d,q=2;%s\e\\' $(( at + 4096 <= n )) "${data[at,at+4095]}"
  done
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

__tt_warp_loading() {
  msg="Loading the background" msgt=100
  printf '\e[?2026h'
  __tt_pv_draw
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
  local name=$1 pal=${1%:*} img="" out="" canvas="" place="" base theme line at REPLY
  local -a wh fr lines
  local -i W=$(( pw * bgcw )) H=$(( ph * bgch )) op wait
  __tt_bg_load $name
  op=$(( ${bgop[$name]} * 100 + 0.5 ))
  base=$TTHEME_WARP_THEMES/ttheme-${${pal/@/--}/\//--}.yaml
  [[ -r $base ]] || return 1
  if (( ! bgoff[$name] )); then
    __tt_warp_saved $name $W $H
    img=$REPLY
    __tt_warp_laid $pal $img
    out=$REPLY
    if [[ ! -r $img ]]; then
      img=${bgsrc[$name]}
      __tt_bg_dim "$img" && (( W && H )) || return 1
      wh=(${=bgdim[$img]})
      __tt_bg_frame $wh[1] $wh[2] $W $H ${bgsize[$name]} ${bgpos[$name]} contain ${bgfocus[$name]}
      fr=(${=REPLY})
      canvas=${W}x$H
      printf -v place '%dx%d%+d%+d' $fr
    fi
  fi
  [[ "$pal $out $op" == "$TTHEME_WARP_VIEW" ]] && return 0
  __tt_warp_loading
  for line in "${(@f)$(<$base)}"; do
    lines+=("$line")
    [[ -n $out && $line == details:* ]] && lines+=("background_image:" "  path: \"$out\"" "  opacity: $op")
  done
  theme=ttheme-${${pal/@/--}/\//--}.view-$(( ++TTHEME_WARP_VIEWS )).yaml
  __tt_put $TTHEME_WARP_THEMES/$theme "${lines[@]}" || return 1
  at=$EPOCHREALTIME
  if [[ -n $out && ! -r $out ]]; then
    if ! __tt_cli flatten "$img" "$out" "${${TTHEME_PALETTE[$pal]}%% *}" 1 $canvas $place >/dev/null 2>&1; then
      zf_rm -f -- $TTHEME_WARP_THEMES/$theme 2>/dev/null
      return 1
    fi
    TTHEME_WARP_LAID+=($out)
  fi
  wait=$(( 25 - (EPOCHREALTIME - at) * 100 ))
  (( wait > 0 )) && zselect -t $wait
  __tt_warp_set "{ custom = { name = \"$pal\", path = \"$theme\" } }" || return 1
  [[ -z $TTHEME_WARP_SHOWING ]] || zf_rm -f -- $TTHEME_WARP_THEMES/$TTHEME_WARP_SHOWING 2>/dev/null
  TTHEME_WARP_SHOWING=$theme TTHEME_WARP_VIEW="$pal $out $op"
  __tt_warp_publish $pal $theme
}

__tt_warp_unview() {
  [[ -n $TTHEME_WARP_SHOWING ]] || return 0
  local spec=$1
  [[ -n $spec ]] && __tt_apply "$spec"
  zf_rm -f -- $TTHEME_WARP_THEMES/$TTHEME_WARP_SHOWING 2>/dev/null
  TTHEME_WARP_SHOWING="" TTHEME_WARP_VIEW=""
}

__tt_pv_bg_show() {
  (( bgcw && ! TTHEME_WARP_BUSY )) || return 0
  local spec=${TTHEME_PALETTE[${1%:*}]} REPLY
  local -i tuned=0
  __tt_warp_tuned $1 && tuned=1
  if (( tuned )) || [[ $spec == "$applied" && -n $TTHEME_WARP_SHOWING ]]; then
    if zselect -t 15 -r 0 2>/dev/null; then
      bgname=""
      return 0
    fi
  fi
  bgname=$1
  TTHEME_WARP_BUSY=1
  if (( tuned )); then
    __tt_warp_view $1 && applied=$spec painted=$spec
  elif [[ $spec == "$applied" ]]; then
    if [[ -n $TTHEME_WARP_SHOWING ]]; then
      __tt_warp_loading
      __tt_warp_unview "$applied"
    elif __tt_warp_wearing && [[ $REPLY == "${1%:*}" ]]; then
      local want
      local -a reply TTHEME_WARP_LINES
      __tt_warp_value ${1%:*}
      want=$REPLY
      __tt_warp_read
      if [[ $REPLY != "$want" ]]; then
        __tt_warp_loading
        zselect -t 25
        __tt_warp_set "$want"
      fi
    fi
  fi
  [[ $msg == "Loading the background" ]] && msg="" msgt=0
  TTHEME_WARP_BUSY=0
  return 0
}

__tt_pv_bg_close() {
  (( bgcw )) && { printf '\e_Ga=d,d=A,q=2\e\\'; __tt_bg_forget }
  (( ${+bgedit[$bgname]} )) || [[ -n $bgname && ${bgview[${bgname%:*}]} == "$bgname" ]] || __tt_warp_unview "$applied"
  [[ -z $bgcut ]] || { ( zselect -t 1000; rm -rf -- $bgcut ) &!; bgcut="" }
  (( ${#TTHEME_WARP_LAID} )) || return 0
  local -a laid=($TTHEME_WARP_LAID)
  TTHEME_WARP_LAID=()
  ( zselect -t 1000; __tt_warp_sweep $laid ) &!
}

__tt_warp_sweep() {
  setopt localoptions extendedglob
  local f
  local -A used
  for f in $TTHEME_WARP_THEMES/ttheme-*.yaml(N); do
    [[ "$(<$f)" == (#b)*$'\n  path: "'([^\"]##)'"'* ]] && used[$match[1]]=1
  done
  for f; do
    (( ${+used[$f]} )) || zf_rm -f -- $f 2>/dev/null
  done
}
