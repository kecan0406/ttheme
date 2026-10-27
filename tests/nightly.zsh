#!/usr/bin/env zsh
emulate -L zsh
setopt pipe_fail

typeset -g LABEL=nightly

open_issue() {
  gh issue list --label $LABEL --state open --limit 100 --json number,title --jq ".[] | select(.title == \"$1\") | .number" | head -1
}

main() {
  local title=$1 code=$2 log=$3 number body
  local run=${GITHUB_SERVER_URL:-https://github.com}/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID
  [[ -n $title && -n $code ]] || { print -u2 "usage: nightly.zsh <title> <exit code> [log]"; return 2 }
  gh label create $LABEL --color BFD4F2 --description 'A nightly run against real terminals or random walks of the model found this' --force > /dev/null 2>&1 || :
  number=$(open_issue $title)
  if (( code == 0 )); then
    [[ -n $number ]] || return 0
    gh issue comment $number --body "Passed again in $run, so this closes."
    gh issue close $number
    return 0
  fi
  body="Run: $run"$'\n\n```\n'"$( [[ -r $log ]] && tail -c 60000 $log)"$'\n```'
  if [[ -n $number ]]; then
    gh issue comment $number --body $body
  else
    gh issue create --title $title --label $LABEL --body $body
  fi
}

main $@
