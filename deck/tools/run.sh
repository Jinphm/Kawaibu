#!/bin/sh
# build + chụp + kiểm tra. Usage: sh deck/tools/run.sh [slideNo ...]
export PHOSPHOR_DIR=${PHOSPHOR_DIR:-/tmp/claude-0/-home-user-Kawaibu/b4e870e8-8d4f-512f-86a1-830734052d0e/scratchpad/icons/node_modules/@phosphor-icons/core/assets}
node "$(dirname "$0")/build.mjs" >/dev/null && node "$(dirname "$0")/shoot.mjs" "$@"
