source $TTHEME_HOME/adapters/_bg.zsh

typeset -g TTHEME_WEZTERM_SHOWN="" TTHEME_WEZTERM_VIEW=""

__tt_keepable() { (( ${TTHEME_TERMINALS[(Ie)wezterm]} )) }

__tt_follows_focus() { return 0 }

__tt_wezterm_var() {
  local REPLY
  __tt_b64s "$2"
  __tt_out $'\e]1337;SetUserVar='$1'='$REPLY$'\a'
}

__tt_shown() {
  [[ $2 != force && $TTHEME_WEZTERM_SHOWN == $1 ]] && return 1
  TTHEME_WEZTERM_SHOWN=$1
  __tt_wezterm_var ttheme_shown $1
  return 1
}

__tt_bg_shown() { REPLY=$TTHEME_WEZTERM_SHOWN }

__tt_bg_refresh() { __tt_wezterm_var ttheme_shown $TTHEME_WEZTERM_SHOWN }

__tt_bg_lasting() { return 1 }

__tt_bg_cells() {
  local REPLY resp
  __tt_ask $'\e[16t' || return 0
  resp=$REPLY
  [[ $resp == *'[6;'<1->';'<1->t ]] || return 0
  resp=${${resp##*\[6;}%t}
  bgch=${resp%;*} bgcw=${resp#*;}
}

__tt_pv_bg_findable() { (( bgcw )) && __tt_keepable }

__tt_bg_hide() {
  local -a p=(${=TTHEME_PALETTE[${1%:*}]})
  __tt_wezterm_var ttheme_view "$p[1]||1|1|1|0|0|0|0|5"
  TTHEME_WEZTERM_VIEW=find
}

__tt_pv_bg_show() {
  (( bgcw )) || return 0
  local name=$1 img="" size fit=contain view="" REPLY
  local -i W=$(( pw * bgcw )) H=$(( ph * bgch )) focus=-1
  local -a p=(${=TTHEME_PALETTE[${name%:*}]}) wh reply
  (( ${#p} >= 20 )) || return 0
  (( $2 )) && TTHEME_WEZTERM_VIEW=-
  bgname=$name
  __tt_bg_load $name
  if (( te && tedirty )) || [[ $name != "$bginc" || "${bgsize[$name]} ${bgpos[$name]} ${bgop[$name]} ${bgoff[$name]}" != "${bgload[$name]}" ]]; then
    size=${bgsize[$name]}
    if [[ $size == fill ]]; then
      img=${bgfill[$name]} size=100 fit=cover
    elif [[ "$size ${bgpos[$name]}" == "${bgshotkey[$name]}" && -r ${bgshot[$name]} ]]; then
      img=${bgshot[$name]} size=100 fit=cover
    else
      img=${bgsrc[$name]} focus=${bgfocus[$name]}
    fi
    (( bgoff[$name] )) && img=""
    __tt_pv_bg_draft $name "$img"
    [[ -n $reply[1] ]] && p=(${=reply[1]})
    img=$reply[2]
    view="$p[1]||1|$W|$H|0|0|0|0|5"
    if [[ -n $img ]] && __tt_bg_dim "$img"; then
      wh=(${=bgdim[$img]})
      __tt_bg_frame $wh[1] $wh[2] $W $H $size ${bgpos[$name]} $fit $focus
      view="$p[1]|$img|$reply[3]|$W|$H|${REPLY// /|}|${bgpos[$name]}"
    fi
  fi
  [[ $view == "$TTHEME_WEZTERM_VIEW" ]] && return 0
  TTHEME_WEZTERM_VIEW=$view
  __tt_wezterm_var ttheme_view "$view"
}

__tt_pv_bg_close() {
  (( bgcw )) && { printf '\e_Ga=d,d=A,q=2\e\\'; __tt_bg_forget }
  [[ -n $TTHEME_WEZTERM_VIEW ]] || return 0
  TTHEME_WEZTERM_VIEW=""
  __tt_wezterm_var ttheme_view ""
}
