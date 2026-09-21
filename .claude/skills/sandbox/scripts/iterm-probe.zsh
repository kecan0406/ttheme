typeset -g SB_PROFILES="${ZDOTDIR:-$HOME}/Library/Application Support/iTerm2/DynamicProfiles"
typeset -g SB_IT2=${IT2_APP_PATH:-/Applications/iTerm.app}/Contents/Resources/utilities/it2

sb_itc() {
  local h=${1#\#}
  printf '{"Red Component":%.6f,"Green Component":%.6f,"Blue Component":%.6f,"Alpha Component":1,"Color Space":"P3"}' \
    $(( 16#${h[1,2]} / 255.0 )) $(( 16#${h[3,4]} / 255.0 )) $(( 16#${h[5,6]} / 255.0 ))
}

sb_profile() {
  local f=$SB_PROFILES/sandbox.json
  jq ".Profiles[0] |= ($1)" $f > $f.tmp && command mv -f -- $f.tmp $f
}

sb_wear() {
  local f=$SB_PROFILES/sandbox.json
  jq --arg name "ttheme · $1" --slurpfile t $SB_PROFILES/ttheme.json \
    '.Profiles[0] += ($t[0].Profiles[] | select(.Name == $name) | del(.Name, .Guid))' $f > $f.tmp &&
    command mv -f -- $f.tmp $f
}

sb_var() {
  local REPLY
  __sb_ask $'\e]1337;ReportVariable='"$(print -rn -- $1 | base64)"$'\a' 30 || return 1
  REPLY=${${REPLY#*ReportVariable=}%%($'\a'|$'\e\\')*}
  print -r -- "$(print -rn -- $REPLY | base64 -d)"
}

sb_it2() { $SB_IT2 $@ }

sb_tab() {
  local dir=${ZDOTDIR:-$HOME}/tabs
  mkdir -p $dir
  local -a taken=($dir/*.(zsh|run)(N))
  local n=$(( $#taken + 1 ))
  print -r -- "$1" > $dir/$n.zsh
  sb_it2 tab new --window $(sb_var tab.window.id) ${2:+--profile} ${2:+$2} > /dev/null
  REPLY=$n
}

sb_tab_wait() {
  local i
  for i in {1..300}; do
    [[ -e ${ZDOTDIR:-$HOME}/tabs/$1.status ]] && return 0
    sleep 0.1
  done
  print -u2 "sb_tab_wait $1: the tab never finished"
  return 1
}

__sb_tab_run() {
  local t
  for t in ${ZDOTDIR:-$HOME}/tabs/*.zsh(N); do
    command mv -- $t ${t:r}.run 2> /dev/null || continue
    source ${t:r}.run 2>> ${ZDOTDIR:-$HOME}/run.err
    print -r -- $? > ${t:r}.status
    return 0
  done
  return 1
}

sb_ttheme() {
  local f=$SB_PROFILES/ttheme.json
  jq --arg name "ttheme · $1" "(.Profiles[] | select(.Name == \$name)) |= ($2)" $f > $f.tmp && command mv -f -- $f.tmp $f
}
