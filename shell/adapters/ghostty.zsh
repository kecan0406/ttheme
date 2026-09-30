source $TTHEME_HOME/adapters/_bg.zsh

typeset -g TTHEME_GHOSTTY_TABS=$TTHEME_STATE_DIR/ghostty TTHEME_GHOSTTY_FRONT="" TTHEME_GHOSTTY_BLUR="" TTHEME_GHOSTTY_HEARD="" TTHEME_GHOSTTY_CODE=""
typeset -gF TTHEME_GHOSTTY_ASKED=0 TTHEME_GHOSTTY_WANT=0 TTHEME_GHOSTTY_HUSH=0 TTHEME_GHOSTTY_TOLD=0 TTHEME_GHOSTTY_NONE_AT=0
typeset -gi TTHEME_GHOSTTY_IDLE=1 TTHEME_GHOSTTY_TICK=0 TTHEME_GHOSTTY_NONE=0 TTHEME_GHOSTTY_FOLLOWS=-1 TTHEME_GHOSTTY_WFD=0 TTHEME_GHOSTTY_WATCHER=0
typeset -gA TTHEME_GHOSTTY_SEEN=() TTHEME_GHOSTTY_RUN=()
typeset -g TTHEME_GHOSTTY_JS='ObjC.import("AppKit");function run(v){var p=+v[0],E=$.NSAppleEventDescriptor,G="com.mitchellh.ghostty",f=function(s){return(s.charCodeAt(0)<<24)|(s.charCodeAt(1)<<16)|(s.charCodeAt(2)<<8)|s.charCodeAt(3)},a=p?$.NSRunningApplication.runningApplicationWithProcessIdentifier(p):$.NSRunningApplication.runningApplicationsWithBundleIdentifier(G).firstObject;if(!a||a.isNil())return p?"gone":"none";var s=$.NSString.stringWithContentsOfFileEncodingError(a.bundleURL.path.js+"/Contents/Resources/Ghostty.sdef",4,null);if(s.isNil()||s.js.indexOf("code=\"Gtty\"")<0)return"blind";var t=E.descriptorWithProcessIdentifier(a.processIdentifier);function q(c,o){var d=E.recordDescriptor;d.setDescriptorForKeyword(E.descriptorWithTypeCode(f("prop")),f("want"));d.setDescriptorForKeyword(o,f("from"));d.setDescriptorForKeyword(E.descriptorWithEnumCode(f("prop")),f("form"));d.setDescriptorForKeyword(E.descriptorWithTypeCode(f(c)),f("seld"));return d.coerceToDescriptorType(f("obj "))}function g(o){var e=E.appleEventWithEventClassEventIDTargetDescriptorReturnIDTransactionID(f("core"),f("getd"),t,-1,0);e.setParamDescriptorForKeyword(o,f("----"));var r=e.sendEventWithOptionsTimeoutError(3,5,null);return!r||r.isNil()||!r.paramDescriptorForKeyword(f("errn")).isNil()?null:r.paramDescriptorForKeyword(f("----"))}var n=E.nullDescriptor,m=q("GTfT",q("GWsT",q("GFWn",n))),w=g(q("pisf",n)),y=g(q("Gtty",m)),i=g(q("Gpid",m));if(!w||!y||!i||w.isNil()||y.isNil()||i.isNil())return"none";return(w.booleanValue?1:0)+" "+y.stringValue.js+" "+i.int32Value}'
typeset -g TTHEME_GHOSTTY_WATCH='ObjC.import("AppKit");ObjC.import("CoreGraphics");ObjC.import("unistd");function run(v){var p=+v[0],u=$.getppid(),E=$.NSAppleEventDescriptor,W=$.NSWorkspace.sharedWorkspace,L=$.NSRunLoop.currentRunLoop,o=$.NSFileHandle.fileHandleWithStandardOutput,a=$.NSRunningApplication.runningApplicationWithProcessIdentifier(p),f=function(s){return(s.charCodeAt(0)<<24)|(s.charCodeAt(1)<<16)|(s.charCodeAt(2)<<8)|s.charCodeAt(3)},S=$.kCGWindowListOptionOnScreenOnly|$.kCGWindowListExcludeDesktopElements,A=$.kCGWindowListOptionOnScreenAboveWindow,w=0,b=-1,h=false,z=0,k=0,c={};if(!a||a.isNil())return;var t=E.descriptorWithProcessIdentifier(p);function q(y,x){var d=E.recordDescriptor;d.setDescriptorForKeyword(E.descriptorWithTypeCode(f("prop")),f("want"));d.setDescriptorForKeyword(x,f("from"));d.setDescriptorForKeyword(E.descriptorWithEnumCode(f("prop")),f("form"));d.setDescriptorForKeyword(E.descriptorWithTypeCode(f(y)),f("seld"));return d.coerceToDescriptorType(f("obj "))}function g(x){var e=E.appleEventWithEventClassEventIDTargetDescriptorReturnIDTransactionID(f("core"),f("getd"),t,-1,0);e.setParamDescriptorForKeyword(x,f("----"));var r=e.sendEventWithOptionsTimeoutError(3,5,null);return!r||r.isNil()||!r.paramDescriptorForKeyword(f("errn")).isNil()?null:r.paramDescriptorForKeyword(f("----"))}var m=q("GTfT",q("GWsT",q("GFWn",E.nullDescriptor)));function mine(d){return d.objectForKey("kCGWindowOwnerPID").intValue===p&&d.objectForKey("kCGWindowLayer").intValue===0}function top(){var l=ObjC.castRefToObject($.CGWindowListCopyWindowInfo(S,0));for(var j=0;j<+l.count;j++){var d=l.objectAtIndex(j);if(mine(d))return d.objectForKey("kCGWindowNumber").intValue}return 0}function n(k,x){return+$.CFArrayGetCount($.CGWindowListCreate(k,x))}function idle(){return Math.min($.CGEventSourceSecondsSinceLastEventType(0,1),$.CGEventSourceSecondsSinceLastEventType(0,10),$.CGEventSourceSecondsSinceLastEventType(0,12))}function now(){return $.NSDate.date.timeIntervalSince1970.toFixed(6)}function say(s){o.writeData($(s+"\n").dataUsingEncoding(4))}while(!a.terminated&&$.getppid()===u){var x=w?n(A,w):-2,v=!w||x!==b||!n($.kCGWindowListOptionIncludingWindow,w);if(v||z++%40===0){L.runUntilDate($.NSDate.date);h=W.frontmostApplication.processIdentifier===p;var e=top();w=e;b=e?n(A,e):-1;if(!e){var d=$.NSRunningApplication.runningApplicationWithProcessIdentifier(p);if(!d||d.isNil())break}if(h&&e&&e!==k){k=e;var at=now();if(c[e])say("1 "+c[e]+" "+at);var y=g(q("Gtty",m)),i=g(q("Gpid",m));if(y&&i&&!y.isNil()&&!i.isNil()){var r=y.stringValue.js+" "+i.int32Value;if(r!==c[e])say("1 "+r+" "+now());if(top()===e)c[e]=r}}}if(!h)k=0;delay(!w?1:!h?0.25:idle()<1.5?0.05:0.15)}}'

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
  local REPLY shown conf=${TTHEME_CONFIG:h}/backgrounds/shown.conf
  local -a at
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
  __tt_ghostty_take "$REPLY"
}

__tt_ghostty_take() {
  local REPLY key pal
  local -a ans rec at
  local -F now=$EPOCHREALTIME
  [[ $1 == gone ]] && return 1
  if [[ $1 == none ]]; then
    (( TTHEME_GHOSTTY_PID )) && ! kill -0 $TTHEME_GHOSTTY_PID 2>/dev/null && return 1
    (( TTHEME_GHOSTTY_NONE )) || TTHEME_GHOSTTY_NONE_AT=$now
    (( ++TTHEME_GHOSTTY_NONE ))
  fi
  if [[ $1 == blind ]] || { [[ $1 == none ]] && (( TTHEME_GHOSTTY_NONE >= 5 && now - TTHEME_GHOSTTY_NONE_AT >= 30 )) }; then
    __tt_put $TTHEME_GHOSTTY_TABS/.blind "${TERM_PROGRAM_VERSION:--}" 2>/dev/null
    return 1
  fi
  [[ $1 == none ]] && return 0
  TTHEME_GHOSTTY_NONE=0
  ans=(${=1})
  if [[ $ans[1] != 1 || -z $ans[2] ]]; then
    TTHEME_GHOSTTY_FRONT=""
    return 0
  fi
  if [[ -n $ans[4] ]]; then
    at=("")
    zstat -F %s.%N -A at +mtime -- ${TTHEME_CONFIG:h}/backgrounds/shown.conf 2>/dev/null
    [[ -n $at[1] ]] && (( at[1] > ans[4] )) && return 0
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
  [[ -n $TTHEME_GHOSTTY_CODE ]] && zstat -F %s.%N -A at +mtime -- $TTHEME_HOME/adapters/ghostty.zsh 2>/dev/null && [[ $at[1] != "$TTHEME_GHOSTTY_CODE" ]] && return 1
  zstat -F %s.%N -A at +mtime -- $TTHEME_HOME/palettes.zsh 2>/dev/null && [[ $at[1] != "$TTHEME_PALETTES_AT" ]] && __tt_palettes_load
  if zstat -F %s.%N -A at +mtime -- $TTHEME_GHOSTTY_TABS/.blur 2>/dev/null && [[ $at[1] != "$TTHEME_GHOSTTY_BLUR" ]]; then
    [[ -n $TTHEME_GHOSTTY_BLUR ]] && (( now - TTHEME_GHOSTTY_TOLD >= 1 )) && TTHEME_GHOSTTY_WANT=$now
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
    elif (( ++TTHEME_GHOSTTY_RUN[$key] < 5 && now - TTHEME_GHOSTTY_TOLD >= 1 )); then
      TTHEME_GHOSTTY_WANT=$now
    fi
  done
  if (( ! TTHEME_GHOSTTY_WFD && TTHEME_GHOSTTY_HUSH && now - TTHEME_GHOSTTY_HUSH >= 0.3 && now - TTHEME_GHOSTTY_ASKED >= (TTHEME_GHOSTTY_IDLE ? 10 : 2) )); then
    TTHEME_GHOSTTY_HUSH=0 TTHEME_GHOSTTY_WANT=$now
  fi
  (( TTHEME_GHOSTTY_WANT && now - TTHEME_GHOSTTY_ASKED >= 0.2 && ( ! TTHEME_GHOSTTY_WFD || now - TTHEME_GHOSTTY_WANT >= 0.4 ) )) || return 0
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

__tt_ghostty_watch() {
  (( TTHEME_GHOSTTY_PID )) || return 0
  coproc osascript -l JavaScript -e $TTHEME_GHOSTTY_WATCH $TTHEME_GHOSTTY_PID 2>/dev/null
  TTHEME_GHOSTTY_WATCHER=$!
  exec {TTHEME_GHOSTTY_WFD}<&p
}

__tt_ghostty_heard() {
  local chunk line
  integer rc
  sysread -t 0 -i $TTHEME_GHOSTTY_WFD chunk 2>/dev/null
  rc=$?
  if (( rc == 2 || rc == 5 )); then
    exec {TTHEME_GHOSTTY_WFD}<&-
    TTHEME_GHOSTTY_WFD=0 TTHEME_GHOSTTY_HEARD=""
    return 0
  fi
  TTHEME_GHOSTTY_HEARD+=$chunk
  while [[ $TTHEME_GHOSTTY_HEARD == *$'\n'* ]]; do
    line=${TTHEME_GHOSTTY_HEARD%%$'\n'*}
    TTHEME_GHOSTTY_HEARD=${TTHEME_GHOSTTY_HEARD#*$'\n'}
    TTHEME_GHOSTTY_TOLD=$EPOCHREALTIME TTHEME_GHOSTTY_WANT=0
    __tt_ghostty_take "$line" || return 1
  done
  return 0
}

__tt_ghostty_follower() {
  emulate -L zsh
  local fd REPLY
  local -a at
  __tt_ghostty_modules
  zsystem flock -t 0 -f fd $TTHEME_GHOSTTY_TABS/.follow 2>/dev/null || return 0
  trap '' HUP
  zstat -F %s.%N -A at +mtime -- $TTHEME_HOME/adapters/ghostty.zsh 2>/dev/null && TTHEME_GHOSTTY_CODE=$at[1]
  __tt_ghostty_owner $PPID
  TTHEME_GHOSTTY_PID=$REPLY
  __tt_ghostty_check || return 0
  __tt_ghostty_watch
  while [[ -e $TTHEME_HOME/palettes.zsh ]]; do
    __tt_ghostty_tick || break
    (( ++TTHEME_GHOSTTY_TICK % 50 )) || __tt_ghostty_live || break
    if (( TTHEME_GHOSTTY_WFD )); then
      zselect -t 50 -r $TTHEME_GHOSTTY_WFD && { __tt_ghostty_heard || break }
    else
      zselect -t 10
    fi
  done
  (( TTHEME_GHOSTTY_WATCHER )) && kill $TTHEME_GHOSTTY_WATCHER 2>/dev/null
  return 0
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

__tt_ghostty_took() {
  local f=${TTHEME_CONFIG:h}/backgrounds/shown.conf
  local -A st
  local -F t
  zmodload -F zsh/datetime p:EPOCHREALTIME 2>/dev/null
  t=$EPOCHREALTIME
  while zstat -H st -F %s.%N -- $f 2>/dev/null && [[ ! $st[atime] > $st[mtime] ]]; do
    (( EPOCHREALTIME - t < 0.1 )) || return 0
  done
  t=$EPOCHREALTIME
  while (( EPOCHREALTIME - t < 0.003 )); do :; done
}

__tt_wear() {
  local REPLY=$2 name
  [[ -n $REPLY ]] || __tt_name_of "$1"
  name=$REPLY
  TTHEME_SPEC=$1
  if [[ -n ${TTHEME_PALETTE[$name]} ]] && __tt_shown "$name" $3; then
    TTHEME_GHOSTTY_SENT=0
    __tt_reload
    (( TTHEME_GHOSTTY_SENT )) && __tt_ghostty_took
    __tt_apply "$1"
    return 0
  fi
  __tt_apply "$1"
  return 1
}

__tt_pv_claim() {
  TTHEME_GHOSTTY_SENT=0
  __tt_shown "$1" force && __tt_reload && (( TTHEME_GHOSTTY_SENT )) && __tt_ghostty_took
  return 0
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
