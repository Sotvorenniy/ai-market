#!/bin/bash
# PreToolUse(Edit|Write) guard for the spec-creator agent.
# allow -> a Markdown file directly inside a folder named "specs" (root specs/ or <module>/specs/), README.md excluded
# deny  -> everything else

source "$(dirname "$0")/guard-lib.sh"
only_for spec-creator

rel=$(relative_path)

case "$rel" in
  *..*) decide deny "Path traversal is not allowed." ;;
  /*) decide deny "spec-creator writes only inside the project ($rel is outside)." ;;
esac

name=${rel##*/}
parent=${rel%/*}
[[ $parent == "$rel" ]] && parent=""

if [[ $name == README.md ]]; then
  decide deny "spec-creator does not edit spec-folder READMEs. Put the index line in the Spec Report hand-off."
fi
if [[ ( $parent == specs || $parent == */specs ) && $name == *.md ]]; then
  decide allow "spec-creator may write a spec file."
fi

decide deny "spec-creator writes only Markdown spec files directly inside a specs/ folder ($rel is not one). Suggest other changes in the Spec Report hand-off."
