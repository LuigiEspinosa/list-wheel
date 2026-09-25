#!/usr/bin/env bash
# list-wheel's deploy on the box: reset the checkout to one commit on `main` and bring the stack up
# from it. `.github/workflows/deploy.yml` reaches it over SSH, and it is the forced command of that
# workflow's key once the Operator applies Pending Operator action 9 of `ops/contract-serving.md` in
# LuigiEspinosa/cuatro-portfolio (DW-94, Operator ruling 2026-09-24). It mirrors that repository's
# `ops/deploy-remote.sh` as of `6e9a216` and differs in the checkout it resets and the compose line.
#
# It takes one input, the target commit, from one of two places.
#
# - Its argument. While the key is unrestricted, the box's login shell runs the workflow's command
#   string, which fetches `main`, reads this file out of the target commit and runs it with the sha.
#   That is how the first deploy after this file lands brings it onto the box, before any
#   `authorized_keys` line can name it.
# - SSH_ORIGINAL_COMMAND. Under `restrict,command="/bin/bash /home/deploy/list-wheel/ops/deploy-remote.sh"`
#   sshd runs this file in place of whatever the client asked for and hands the request over in that
#   variable. Its last word is read as the sha, and nothing in it is executed.
#
# Either way the target is refused unless it is 40 lowercase hex characters, an ancestor of
# `origin/main` after a fetch, and a commit that carries this file, so a leaked key can redeploy a
# commit already on `main` and do nothing else. A commit older than this file is refused because a
# reset to it deletes the file the key's line names and stops every later deploy (DW-131). The sha
# stays the last word of the workflow's command string, and this file stays at this path, because
# the key's line names it. Story 4.3, which retires the build on the box, edits this
# file. `ops/deploy-remote.test.mjs` runs it both ways against a scratch repository, and reads the
# line above as the forced command.

set -euo pipefail

refuse() {
  echo "deploy-remote: refused: $1" >&2
  exit 1
}

main() {
  local target source
  if [ "$#" -gt 0 ]; then
    target="$1" source='its argument'
  else
    target="${SSH_ORIGINAL_COMMAND-}" source='SSH_ORIGINAL_COMMAND'
  fi
  target="${target##*[[:space:]]}"
  [[ "$target" =~ ^[0-9a-f]{40}$ ]] || refuse "the target read from $source is not a full lowercase commit sha"

  cd "$HOME/list-wheel"
  # The destination is named so the ancestor check reads a current `origin/main` whatever the
  # checkout's fetch configuration, and without `+`, so a rewritten `main` fails the deploy.
  git fetch origin main:refs/remotes/origin/main
  git merge-base --is-ancestor "$target" origin/main || refuse "$target is not on origin/main"
  git cat-file -e "$target:ops/deploy-remote.sh" || refuse "$target carries no ops/deploy-remote.sh"
  echo "deploy-remote: deploying $target, read from $source"

  # `reset --hard` rather than `pull`: a pull fails or merges if the box checkout has drifted, and a
  # deploy that half-applies is worse than one that refuses. To the target rather than to
  # `origin/main`, which may have moved on since the workflow's gate step checked this commit (DW-93).
  git reset --hard "$target"

  # `--remove-orphans` so a service renamed or removed in a later compose file does not survive on the
  # box as an orphan no deploy touches again. `--build` compiles on the serving box, a knowing breach of
  # the estate's AD-8 recorded as KV-1 in cuatro-portfolio's `ops/known-violations.md` and retired by
  # Story 4.3, chosen over a registry image on 2026-09-13 so this deploy mirrors the Anchor's rather
  # than opening a second shape.
  docker compose up --build -d --remove-orphans
}

# On one line, so bash has read the whole call before `git reset` can replace this file under it.
main "$@"; exit
