__sb_quiet() {
  precmd_functions=(${precmd_functions:#__sb_quiet})
  __tt_reload_ghostty() { print -r -- reload >> $HOME/reload.log }
}

precmd_functions+=(__sb_quiet)
