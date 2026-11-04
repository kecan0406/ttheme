#!/usr/bin/env zsh
emulate -L zsh
setopt err_return pipe_fail

cd ${${(%):-%x}:A:h:h}

local stamp=$(git rev-parse --git-path ttheme-checked)
local begun=$stamp.begun

snapshot() {
  local index=$(mktemp)
  cp -- $(git rev-parse --git-path index) $index
  GIT_INDEX_FILE=$index git add -A
  GIT_INDEX_FILE=$index git write-tree
  rm -f -- $index
}

listed() {
  (( $# )) || return 0
  print -rl -- "  "${^@[1,8]}
  (( $# <= 8 )) || print -r -- "  … and $(( $# - 8 )) more"
}

push() {
  setopt extended_glob
  local lane='(site/*|docs/*|[^/]#.md|*/AGENTS.md|.claude/rules/*.md|.agents/skills/*.md)'
  local checked="" ref sha remote base tree now log
  local -a changed outside differ
  [[ -r $stamp ]] && checked=$(<$stamp)
  while read -r ref sha remote base; do
    [[ $remote == refs/heads/main && -n ${sha//0} ]] || continue
    tree=$(git rev-parse "$sha^{tree}")
    if [[ $tree == "$checked" ]]; then
      print -u2 "pre-push: mise run ci passed on this tree"
      continue
    fi
    if [[ -n $checked && $(git log -1 --format=%s $sha) == 'release: '* && $(git rev-parse -q --verify "$sha^^{tree}") == "$checked" ]]; then
      changed=(${(f)"$(git diff --name-only "$sha^" $sha)"})
      if (( ! ${#${changed:#(package.json|CHANGELOG.md)}} )); then
        print -u2 "pre-push: a release commit over the tree mise run ci passed"
        continue
      fi
    fi
    if [[ -n ${base//0} ]] && ! git merge-base --is-ancestor $base $sha 2>/dev/null; then
      print -u2 "pre-push: refused — main has commits this push lacks: git fetch, rebase onto origin/main and push again"
      return 1
    fi
    if [[ -n ${base//0} ]]; then
      changed=(${(f)"$(git diff --name-only $base $sha)"})
    else
      changed=(${(f)"$(git ls-tree -r --name-only $sha)"})
    fi
    outside=(${changed:#$~lane})
    if (( $#outside )) && [[ -n $checked ]] && differ=(${(f)"$(git diff --name-only $checked $sha 2>/dev/null)"}) && (( ! ${#${differ:#$~lane}} )); then
      outside=()
    fi
    if (( $#outside )); then
      print -u2 "pre-push: refused — mise run ci has not passed on the tree this push puts on main, and it changes more than site/, docs/, Markdown and the instruction files:"
      listed $outside >&2
      if [[ -n $checked ]] && differ=(${(f)"$(git diff --name-only $checked $sha 2>/dev/null)"}); then
        print -u2 "the tree mise run ci passed last differs from it in:"
        listed $differ >&2
      fi
      print -u2 "run mise run format, then mise run ci, commit what they changed and push again"
      return 1
    fi
    now=$(snapshot)
    if [[ $now != $tree ]]; then
      print -u2 "pre-push: refused — the working tree differs from the commit this push puts on main, and mise run ci:site checks the working tree:"
      listed ${(f)"$(git diff --name-only $tree $now)"} >&2
      print -u2 "commit or stash what differs and push again"
      return 1
    fi
    print -u2 "pre-push: this push changes only site/, docs/, Markdown and the instruction files, so mise run ci:site checks it in place of ci…"
    log=$(mktemp)
    if mise run ci:site > $log 2>&1; then
      rm -f -- $log
      print -u2 "pre-push: mise run ci:site passed"
    else
      cat -- $log >&2
      rm -f -- $log
      print -u2 "pre-push: refused — mise run ci:site failed above: fix what it names, commit and push again"
      return 1
    fi
  done
}

case $1 in
  begin)
    snapshot > $begun
    ;;
  end)
    if [[ -r $begun && $(snapshot) == $(<$begun) ]]; then
      mv -f -- $begun $stamp
    else
      rm -f -- $begun
      print "ci passed, but the tree changed while it ran, so mise run release checks it again"
    fi
    ;;
  clean)
    [[ $(snapshot) == $(git rev-parse 'HEAD^{tree}') ]] && return 0
    print -u2 "release: the working tree differs from HEAD — commit or stash first"
    return 1
    ;;
  fresh)
    [[ -r $stamp && $(<$stamp) == $(git rev-parse 'HEAD^{tree}') ]]
    ;;
  push)
    push
    ;;
  *)
    print -u2 "usage: checked.zsh begin|end|clean|fresh|push"
    return 1
    ;;
esac
