source $TTHEME_HOME/adapters/_bg.zsh

typeset -g TTHEME_GHOSTTY_TABS=$TTHEME_STATE_DIR/ghostty TTHEME_GHOSTTY_FRONT="" TTHEME_GHOSTTY_BLUR=""
typeset -gF TTHEME_GHOSTTY_ASKED=0 TTHEME_GHOSTTY_WANT=0 TTHEME_GHOSTTY_HUSH=0
typeset -gi TTHEME_GHOSTTY_IDLE=1 TTHEME_GHOSTTY_TICK=0 TTHEME_GHOSTTY_NONE=0 TTHEME_GHOSTTY_FOLLOWS=-1
typeset -gA TTHEME_GHOSTTY_SEEN=() TTHEME_GHOSTTY_RUN=()
typeset -g TTHEME_GHOSTTY_JS='ObjC.import("AppKit");function run(v){var p=+v[0],E=$.NSAppleEventDescriptor,G="com.mitchellh.ghostty",f=function(s){return(s.charCodeAt(0)<<24)|(s.charCodeAt(1)<<16)|(s.charCodeAt(2)<<8)|s.charCodeAt(3)},a=p?$.NSRunningApplication.runningApplicationWithProcessIdentifier(p):$.NSRunningApplication.runningApplicationsWithBundleIdentifier(G).firstObject;if(!a||a.isNil())return"none";var s=$.NSString.stringWithContentsOfFileEncodingError(a.bundleURL.path.js+"/Contents/Resources/Ghostty.sdef",4,null);if(s.isNil()||s.js.indexOf("code=\"Gtty\"")<0)return"blind";var t=E.descriptorWithProcessIdentifier(a.processIdentifier);function q(c,o){var d=E.recordDescriptor;d.setDescriptorForKeyword(E.descriptorWithTypeCode(f("prop")),f("want"));d.setDescriptorForKeyword(o,f("from"));d.setDescriptorForKeyword(E.descriptorWithEnumCode(f("prop")),f("form"));d.setDescriptorForKeyword(E.descriptorWithTypeCode(f(c)),f("seld"));return d.coerceToDescriptorType(f("obj "))}function g(o){var e=E.appleEventWithEventClassEventIDTargetDescriptorReturnIDTransactionID(f("core"),f("getd"),t,-1,0);e.setParamDescriptorForKeyword(o,f("----"));var r=e.sendEventWithOptionsTimeoutError(3,5,null);return!r||r.isNil()||!r.paramDescriptorForKeyword(f("errn")).isNil()?null:r.paramDescriptorForKeyword(f("----"))}var n=E.nullDescriptor,m=q("GTfT",q("GWsT",q("GFWn",n))),w=g(q("pisf",n)),y=g(q("Gtty",m)),i=g(q("Gpid",m));if(!w||!y||!i||w.isNil()||y.isNil()||i.isNil())return"none";return(w.booleanValue?1:0)+" "+y.stringValue.js+" "+i.int32Value}'

__tt_follows_focus() { return 0 }

__tt_follows_prompt() { return 0 }

__tt_keepable() { return 0 }

__tt_bg_shown() { __tt_ghostty_shown }

__tt_ghostty_key() { REPLY=${${1#/dev/}//\//-} }

__tt_ghostty_wears() {
  REPLY=""
  [[ -n $1 ]] && __tt_name_of "$1"
  [[ -n ${TTHEME_PALETTE[$REPLY]} ]] || REPLY=""
}

__tt_ghostty_modules() {
  zmodload -F zsh/files b:zf_rm b:zf_mkdir
  zmodload -F zsh/zselect b:zselect
  zmodload -F zsh/datetime p:EPOCHREALTIME p:EPOCHSECONDS
} 2>/dev/null

__tt_ghostty_follows() {
  local -a at
  (( TTHEME_GHOSTTY_FOLLOWS < 0 )) || return $(( ! TTHEME_GHOSTTY_FOLLOWS ))
  TTHEME_GHOSTTY_FOLLOWS=0
  [[ $TERM_PROGRAM == ghostty && -o interactive && -n $TTY ]] && (( $+commands[osascript] && ! TTHEME_TMUX )) || return 1
  if zstat -A at +mtime -- $TTHEME_GHOSTTY_TABS/.blind 2>/dev/null && [[ "$(<$TTHEME_GHOSTTY_TABS/.blind)" == "${TERM_PROGRAM_VERSION:--}" ]]; then
    zmodload -F zsh/datetime p:EPOCHSECONDS 2>/dev/null
    (( EPOCHSECONDS - at[1] < 86400 )) && return 1
  fi
  TTHEME_GHOSTTY_FOLLOWS=1
}

__tt_ghostty_publish() {
  local f line REPLY
  __tt_ghostty_follows || return 0
  line="$$ ${TTHEME_STARTUP:--} ${1:--} $TTY"
  __tt_ghostty_key $TTY
  f=$TTHEME_GHOSTTY_TABS/$REPLY
  [[ -r $f && "$(<$f)" == "$line" ]] && return 0
  if [[ ! -d $TTHEME_GHOSTTY_TABS ]]; then
    zmodload -F zsh/files b:zf_mkdir 2>/dev/null
    zf_mkdir -p $TTHEME_GHOSTTY_TABS 2>/dev/null || return 0
  fi
  __tt_put $f "$line" 2>/dev/null
  return 0
}

__tt_worn() {
  local REPLY
  (( TTHEME_RAW )) && return 0
  __tt_ghostty_wears "$1"
  __tt_ghostty_publish "$REPLY"
}

__tt_prompted() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  local REPLY
  __tt_ghostty_wears "$TTHEME_SPEC"
  __tt_ghostty_publish "$REPLY"
  __tt_ghostty_follow
}

__tt_blurred() {
  __tt_ghostty_follows && [[ -d $TTHEME_GHOSTTY_TABS ]] && : >| $TTHEME_GHOSTTY_TABS/.blur 2>/dev/null
  return 0
}

__tt_ghostty_follow() {
  local fd lock=$TTHEME_GHOSTTY_TABS/.follow
  __tt_ghostty_follows && [[ -d $TTHEME_GHOSTTY_TABS ]] || return 0
  if [[ -e $TTHEME_GHOSTTY_TABS/.blind ]]; then
    TTHEME_GHOSTTY_FOLLOWS=-1
    __tt_ghostty_follows || return 0
  fi
  [[ -e $lock ]] || : >>| $lock 2>/dev/null || return 0
  zsystem flock -t 0 -f fd $lock 2>/dev/null || return 0
  zsystem flock -u $fd
  zsh -fc 'source $1; __tt_ghostty_follower' zsh $TTHEME_HOME/ttheme.zsh </dev/null >/dev/null 2>&1 &!
}

__tt_ghostty_ask() {
  REPLY=$(osascript -l JavaScript -e $TTHEME_GHOSTTY_JS ${TTHEME_GHOSTTY_PID:-0} 2>/dev/null)
  TTHEME_GHOSTTY_ASKED=$EPOCHREALTIME
  [[ -n $REPLY ]]
}

__tt_ghostty_check() {
  local REPLY shown key pal conf=${TTHEME_CONFIG:h}/backgrounds/shown.conf
  local -a at ans rec
  integer n
  __tt_ghostty_modules
  for (( n = 0; n < 3; n++ )); do
    at=("")
    zstat -F %s.%N -A at +mtime -- $conf 2>/dev/null
    shown=$at[1]
    __tt_ghostty_ask || return 0
    at=("")
    zstat -F %s.%N -A at +mtime -- $conf 2>/dev/null
    [[ $at[1] == "$shown" ]] && break
  done
  if [[ $REPLY == blind ]] || { [[ $REPLY == none ]] && (( ++TTHEME_GHOSTTY_NONE >= 5 )) }; then
    __tt_put $TTHEME_GHOSTTY_TABS/.blind "${TERM_PROGRAM_VERSION:--}" 2>/dev/null
    return 1
  fi
  [[ $REPLY == none ]] && return 0
  TTHEME_GHOSTTY_NONE=0
  ans=(${=REPLY})
  if [[ $ans[1] != 1 || -z $ans[2] ]]; then
    TTHEME_GHOSTTY_FRONT=""
    return 0
  fi
  __tt_ghostty_key $ans[2]
  key=$REPLY
  TTHEME_GHOSTTY_FRONT=$key TTHEME_GHOSTTY_IDLE=1
  [[ -r $TTHEME_GHOSTTY_TABS/$key ]] || return 0
  rec=(${=${"$(<$TTHEME_GHOSTTY_TABS/$key)"}})
  [[ $rec[1] == "$ans[3]" ]] || TTHEME_GHOSTTY_IDLE=0
  pal=${rec[3]#-}
  [[ $rec[2] != - && -z $TTHEME_STARTUP ]] && pal=""
  [[ -n $pal && -n ${TTHEME_PALETTE[$pal]} ]] || return 0
  __tt_shown "$pal" force && __tt_reload_ghostty
  return 0
}

__tt_ghostty_tick() {
  local f key
  local -a at rec
  local -F now=$EPOCHREALTIME
  integer seen
  zstat -F %s.%N -A at +mtime -- $TTHEME_HOME/palettes.zsh 2>/dev/null && [[ $at[1] != "$TTHEME_PALETTES_AT" ]] && __tt_palettes_load
  if zstat -F %s.%N -A at +mtime -- $TTHEME_GHOSTTY_TABS/.blur 2>/dev/null && [[ $at[1] != "$TTHEME_GHOSTTY_BLUR" ]]; then
    [[ -n $TTHEME_GHOSTTY_BLUR ]] && TTHEME_GHOSTTY_WANT=$now
    TTHEME_GHOSTTY_BLUR=$at[1]
  fi
  for f in $TTHEME_GHOSTTY_TABS/[^.]*(N); do
    key=${f:t}
    rec=(${=${"$(<$f)"}})
    zstat -F %s.%N -A at +atime -- ${rec[4]:-/nonexistent} 2>/dev/null || continue
    if [[ $at[1] == "${TTHEME_GHOSTTY_SEEN[$key]}" ]]; then
      TTHEME_GHOSTTY_RUN[$key]=0
      continue
    fi
    seen=${+TTHEME_GHOSTTY_SEEN[$key]}
    TTHEME_GHOSTTY_SEEN[$key]=$at[1]
    (( seen )) || continue
    if [[ $key == "$TTHEME_GHOSTTY_FRONT" ]]; then
      TTHEME_GHOSTTY_HUSH=$now
    elif (( ++TTHEME_GHOSTTY_RUN[$key] < 5 )); then
      TTHEME_GHOSTTY_WANT=$now
    fi
  done
  if (( TTHEME_GHOSTTY_HUSH && now - TTHEME_GHOSTTY_HUSH >= 0.3 && now - TTHEME_GHOSTTY_ASKED >= (TTHEME_GHOSTTY_IDLE ? 10 : 2) )); then
    TTHEME_GHOSTTY_HUSH=0 TTHEME_GHOSTTY_WANT=$now
  fi
  (( TTHEME_GHOSTTY_WANT && now - TTHEME_GHOSTTY_ASKED >= 0.2 )) || return 0
  TTHEME_GHOSTTY_WANT=0
  __tt_ghostty_check
}

__tt_ghostty_live() {
  local f pid
  integer live=0
  (( TTHEME_GHOSTTY_PID )) && ! kill -0 $TTHEME_GHOSTTY_PID 2>/dev/null && return 1
  for f in $TTHEME_GHOSTTY_TABS/[^.]*(N); do
    pid=${"$(<$f)"%% *}
    if [[ $pid == <-> ]] && kill -0 $pid 2>/dev/null; then
      live=1
    else
      zf_rm -f -- $f 2>/dev/null
      unset "TTHEME_GHOSTTY_SEEN[${f:t}]" "TTHEME_GHOSTTY_RUN[${f:t}]"
    fi
  done
  (( live ))
}

__tt_ghostty_follower() {
  emulate -L zsh
  local fd REPLY
  __tt_ghostty_modules
  zsystem flock -t 0 -f fd $TTHEME_GHOSTTY_TABS/.follow 2>/dev/null || return 0
  trap '' HUP
  __tt_ghostty_owner $PPID
  TTHEME_GHOSTTY_PID=$REPLY
  __tt_ghostty_check || return 0
  while [[ -e $TTHEME_HOME/palettes.zsh ]]; do
    __tt_ghostty_tick || break
    (( ++TTHEME_GHOSTTY_TICK % 50 )) || __tt_ghostty_live || break
    zselect -t 10
  done
}

__tt_reset_reloaded() {
  local REPLY
  integer i
  __tt_osc_reset
  [[ -n $1 ]] && (( ${TTHEME_TERMINALS[(Ie)ghostty]} && ! TTHEME_TMUX )) || return 0
  for (( i = 0; i < 20; i++ )); do
    __tt_query_bg || return 0
    [[ ${(L)REPLY} == ${(L)1} ]] || return 0
    sleep 0.05
    __tt_osc_reset
  done
}

__tt_shown() {
  local dir=${TTHEME_CONFIG:h}/backgrounds was REPLY
  __tt_ghostty_publish "$1"
  [[ $2 == force ]] || (( TTHEME_FRONT || TTHEME_TMUX )) || return 1
  __tt_bg_shown
  was=$REPLY
  [[ $was == $1 ]] && return 1
  [[ -r $dir/${${1/@/--}/\//--}.conf || ( -n $was && -r $dir/${${was/@/--}/\//--}.conf ) ]] || return 1
  [[ -d $dir ]] || mkdir -p $dir || return 1
  __tt_put $dir/shown.conf "config-file = ?${${1/@/--}/\//--}.conf"
}

__tt_bg_cells() {
  local REPLY resp line v f
  local -i px=2 py=2 fs=0 sc=2
  for f in ${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/config; do
    [[ -r $f ]] || continue
    for line in "${(@f)$(<$f)}"; do
      v=${${line#*=}// /}
      case $line in
        window-padding-x*=*) [[ $v == <->(|,<->) ]] && px=$(( ${v%%,*} > ${v##*,} ? ${v%%,*} : ${v##*,} )) ;;
        window-padding-y*=*) [[ $v == <->(|,<->) ]] && py=$(( ${v%%,*} > ${v##*,} ? ${v%%,*} : ${v##*,} )) ;;
        font-size*=*) [[ $v == <->(|.<->) ]] && fs=${v%%.*} ;;
      esac
    done
  done
  __tt_ask $'\e_Ga=t,f=24,s=1,v=1,i=1,q=2;AAAA\e\\\e_Ga=p,i=1,p=9,P=999998,Q=1,C=1,q=1\e\\\e_Ga=d,d=i,i=1,p=9,q=2\e\\\e[16t' || return 0
  resp=$REPLY
  [[ $resp == *'[6;'<1->';'<1->t ]] || return 0
  [[ $resp == *$'\e_G'*';E'* ]] && bgrel=1
  resp=${${resp##*\[6;}%t}
  bgch=${resp%;*} bgcw=${resp#*;}
  (( fs && bgch * 10 < fs * 20 )) && sc=1
  (( bgrel )) || return 0
  bgmx=$(( (px * sc + bgcw - 1) / bgcw + 1 )) bgmy=$(( (py * sc + bgch - 1) / bgch + 1 ))
}

__tt_bg_crop() {
  __tt_bg_send $1
  REPLY="$REPLY $4"
}
