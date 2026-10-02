source $TTHEME_HOME/adapters/_bg.zsh

zmodload -F zsh/files b:zf_rm b:zf_mkdir 2>/dev/null

typeset -g TTHEME_KONSOLE_SHOWN="" TTHEME_KONSOLE_NAME="" TTHEME_KONSOLE_OWN="" TTHEME_KONSOLE_VIEW="" TTHEME_KONSOLE_VIEWED=""
typeset -gi TTHEME_KONSOLE_VIEWS=0

__tt_konsole_wired() { (( ${TTHEME_TERMINALS[(Ie)konsole]} )) }

__tt_keepable() { __tt_konsole_wired }

__tt_takes_default() { __tt_konsole_wired && __tt_osc_reset }

__tt_reverts() { return 1 }

__tt_follows_focus() { return 0 }

__tt_scheme() {
  local -a p=(${=TTHEME_PALETTE[$1]})
  local -A v=(${=TTHEME_KONSOLE_SCHEMES})
  local stem=${${1/@/--}/\//--}
  REPLY=ttheme-$stem
  [[ -n $v[$stem] && -r ${XDG_DATA_HOME:-$HOME/.local/share}/konsole/$REPLY.$v[$stem].colorscheme ]] && REPLY+=.$v[$stem]
  REPLY="ColorScheme=$REPLY;UseCustomCursorColor=true;customCursorColor=$p[3]"
}

__tt_konsole_ini() {
  local line group=""
  REPLY=""
  [[ -r $1 ]] || return 1
  for line in "${(@f)$(<$1)}"; do
    if [[ $line == \[*\] ]]; then
      group=${${line#\[}%\]}
    elif [[ $group == $2 && $line == $3=* ]]; then
      REPLY=${line#*=}
      return 0
    fi
  done
  return 1
}

__tt_konsole_own() {
  local file scheme="" use="" cursor="" found dir REPLY
  local -i depth=0
  __tt_konsole_ini ${XDG_CONFIG_HOME:-$HOME/.config}/konsolerc 'Desktop Entry' DefaultProfile && file=$REPLY
  while (( depth++ < 8 )) && [[ -n $file && $file != FALLBACK/ ]]; do
    found=""
    for dir in ${XDG_DATA_HOME:-$HOME/.local/share} ${(s.:.)${XDG_DATA_DIRS:-/usr/local/share:/usr/share}}; do
      [[ -r $dir/konsole/${file%.profile}.profile ]] && { found=$dir/konsole/${file%.profile}.profile; break }
    done
    [[ -n $found ]] || break
    [[ -z $scheme ]] && __tt_konsole_ini $found Appearance ColorScheme && scheme=$REPLY
    [[ -z $use ]] && __tt_konsole_ini $found 'Cursor Options' UseCustomCursorColor && use=$REPLY
    [[ -z $cursor ]] && __tt_konsole_ini $found 'Cursor Options' CustomCursorColor && cursor=$REPLY
    file=""
    __tt_konsole_ini $found General Parent && file=$REPLY
  done
  TTHEME_KONSOLE_OWN="ColorScheme=${scheme:-Breeze};UseCustomCursorColor=false"
  if [[ $use == true && $cursor == <0-255>,<0-255>,<0-255>(|,*) ]]; then
    local -a c=(${(s:,:)cursor})
    printf -v REPLY '#%02x%02x%02x' $c[1] $c[2] $c[3]
    TTHEME_KONSOLE_OWN="ColorScheme=${scheme:-Breeze};UseCustomCursorColor=true;customCursorColor=$REPLY"
  fi
}

__tt_konsole_new() {
  if ! __tt_konsole_wired; then
    [[ -n $TTHEME_KONSOLE_OWN ]] || __tt_konsole_own
    REPLY=$TTHEME_KONSOLE_OWN
  elif [[ -n $TTHEME_STARTUP && -n ${TTHEME_PALETTE[$TTHEME_STARTUP]} ]]; then
    __tt_scheme $TTHEME_STARTUP
  else
    REPLY=$TTHEME_KONSOLE_BASE
  fi
}

__tt_konsole_show() {
  [[ $3 != force && $1 == "$TTHEME_KONSOLE_SHOWN" ]] && return 0
  local REPLY=$1
  __tt_out $'\e]50;'$REPLY$'\a'
  TTHEME_KONSOLE_SHOWN=$1 TTHEME_KONSOLE_NAME=$2
}

__tt_konsole_rgb() { REPLY="$(( 16#${1:1:2} )),$(( 16#${1:3:2} )),$(( 16#${1:5:2} ))" }

__tt_konsole_faint() {
  REPLY="$(( (16#${1:1:2} + 16#${2:1:2} + 1) / 2 )),$(( (16#${1:3:2} + 16#${2:3:2} + 1) / 2 )),$(( (16#${1:5:2} + 16#${2:5:2} + 1) / 2 ))"
}

__tt_konsole_view() {
  local -a p=(${=1}) lines
  local dir=${XDG_DATA_HOME:-$HOME/.local/share}/konsole name=$2 REPLY
  local -i i
  (( ${#p} >= 20 )) && [[ $p[1] == \#?????? ]] || return 1
  __tt_konsole_rgb $p[1]
  lines=('[Background]' "Color=$REPLY" '' '[BackgroundFaint]' "Color=$REPLY" '' '[BackgroundIntense]' "Color=$REPLY" '')
  for (( i = 0; i < 8; i++ )); do
    __tt_konsole_rgb $p[i+5]
    lines+=("[Color$i]" "Color=$REPLY" '')
    __tt_konsole_faint $p[i+5] $p[1]
    lines+=("[Color${i}Faint]" "Color=$REPLY" '')
    __tt_konsole_rgb $p[i+13]
    lines+=("[Color${i}Intense]" "Color=$REPLY" '')
  done
  __tt_konsole_rgb $p[2]
  lines+=('[Foreground]' "Color=$REPLY" '')
  __tt_konsole_faint $p[2] $p[1]
  lines+=('[ForegroundFaint]' "Color=$REPLY" '')
  __tt_konsole_rgb $p[2]
  lines+=('[ForegroundIntense]' "Color=$REPLY" '' '[General]' 'Blur=false' 'ColorRandomization=false' "Description=ttheme · $name" 'Opacity=1' 'Wallpaper=' '')
  [[ -d $dir ]] || zf_mkdir -p $dir 2>/dev/null || return 1
  name=ttheme-view.$$.$(( ++TTHEME_KONSOLE_VIEWS ))
  __tt_put $dir/$name.colorscheme "${lines[@]}" || return 1
  [[ -z $TTHEME_KONSOLE_VIEWED ]] || zf_rm -f -- $TTHEME_KONSOLE_VIEWED 2>/dev/null
  TTHEME_KONSOLE_VIEWED=$TTHEME_KONSOLE_VIEW TTHEME_KONSOLE_VIEW=$dir/$name.colorscheme
  reply=("ColorScheme=$name;UseCustomCursorColor=true;customCursorColor=$p[3]")
}

__tt_konsole_bye() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  [[ -z $TTHEME_KONSOLE_VIEW ]] || zf_rm -f -- $TTHEME_KONSOLE_VIEW 2>/dev/null
  [[ -z $TTHEME_KONSOLE_VIEWED ]] || zf_rm -f -- $TTHEME_KONSOLE_VIEWED 2>/dev/null
  return 0
}

__tt_cli_env() {
  local REPLY=$TTHEME_KONSOLE_SHOWN
  [[ -n $REPLY || -n $TTHEME_PAINTED ]] || __tt_konsole_new
  [[ -n $REPLY ]] && pass+=(TTHEME_KONSOLE_LOOK=$REPLY)
}

__tt_osc_apply() {
  local -a p=(${=1}) reply
  (( ${#p} >= 20 )) || return 1
  local REPLY
  __tt_name_of "$1"
  if __tt_konsole_wired && [[ -n ${TTHEME_PALETTE[$REPLY]} ]]; then
    local name=$REPLY
    __tt_scheme $name
    __tt_konsole_show "$REPLY" $name force
  elif __tt_konsole_view "$1" "$REPLY"; then
    __tt_konsole_show "$reply[1]" "" force
  else
    if [[ $p[1] == - ]]; then
      __tt_out $'\e]10;'$p[2]$'\e\\'
    else
      __tt_out $'\e]11;'$p[1]$'\e\\\e]10;'$p[2]$'\e\\'
    fi
    TTHEME_KONSOLE_SHOWN=""
  fi
  export TTHEME_PAINTED=1
  (( TTHEME_TMUX )) && tmux set -q @ttheme_bg "$p[1]" 2>/dev/null
  __tt_worn "$1"
  return 0
}

__tt_osc_reset() {
  local REPLY name=""
  __tt_konsole_wired && [[ -n ${TTHEME_PALETTE[$TTHEME_STARTUP]} ]] && name=$TTHEME_STARTUP
  __tt_konsole_new
  __tt_konsole_show "$REPLY" "$name" force
  unset TTHEME_PAINTED
  (( TTHEME_TMUX )) && tmux set -qu @ttheme_bg 2>/dev/null
  __tt_worn ""
  return 0
}

__tt_reloaded() {
  local REPLY name=""
  __tt_konsole_wired || return 0
  if [[ -z $TTHEME_PAINTED ]]; then
    [[ -n ${TTHEME_PALETTE[$TTHEME_STARTUP]} ]] && name=$TTHEME_STARTUP
    __tt_konsole_new
  else
    __tt_name_of "$TTHEME_SPEC"
    name=$REPLY
    [[ -n ${TTHEME_PALETTE[$name]} ]] || return 0
    __tt_scheme $name
  fi
  __tt_konsole_show "$REPLY" $name
  return 0
}

__tt_pv_leave() {
  [[ $painted != "$orig" ]] || return 0
  if [[ -n $orig ]]; then
    __tt_apply "$orig"
  else
    __tt_osc_reset
  fi
  painted=$orig
}

__tt_bg_shown() {
  REPLY=$TTHEME_KONSOLE_NAME
  [[ -n $REPLY ]]
}

__tt_bg_refresh() {
  local REPLY name=$TTHEME_KONSOLE_NAME
  [[ -n $name ]] && __tt_palettes_load || return 0
  __tt_scheme $name
  __tt_konsole_show "$REPLY" $name
  return 0
}

__tt_bg_cells() {
  local REPLY resp
  __tt_ask $'\e[16t' || return 0
  resp=$REPLY
  [[ $resp == *'[6;'<1->';'<1->t ]] || return 0
  resp=${${resp##*\[6;}%t}
  bgch=${resp%;*} bgcw=${resp#*;}
}

__tt_bg_crop() {
  __tt_bg_send $1
  REPLY="$REPLY $4"
}

() {
  emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}
  local REPLY
  [[ -o interactive ]] || return 0
  autoload -Uz add-zsh-hook
  add-zsh-hook zshexit __tt_konsole_bye
  [[ -t 1 && -z $TTHEME_PAINTED && -z $TMUX && -n $TTHEME_STARTUP && -n ${TTHEME_PALETTE[$TTHEME_STARTUP]} ]] && __tt_konsole_wired || return 0
  __tt_scheme $TTHEME_STARTUP
  __tt_konsole_show "$REPLY" $TTHEME_STARTUP force
}
