#!/bin/bash
cd "$(dirname "$0")/.."
SUITES="engine legal eval transition turnflow determinism battleflow melody slime eleven score harness riffparity skilltree"
for s in $SUITES; do
  out=$(npm run --silent test:$s 2>&1)
  code=$?
  tail=$(echo "$out" | tail -3 | tr '\n' ' | ')
  echo "[$s] exit=$code :: $tail"
done
echo "[bundle] $(npm run --silent check:bundle 2>&1 | tail -2 | tr '\n' ' ')  exit=$?"
