#!/bin/bash
# scripts/verify.sh — one command: cold sandbox → proved or broken.
#
# Flow:
#   1. Ensure MariaDB up
#   2. Run scripts/seed-full.sh (idempotent seed)
#   3. Ensure node server up (restart if needed)
#   4. Run every test in tests/ in alphanumeric order
#   5. Summarise
#
# Exit code = number of failing tests. 0 means all green.

set -u
WORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WORK_DIR"

DB_SOCKET="${DB_SOCKET:-/tmp/mysql.sock}"
PORT="${PORT:-3100}"
SESSION_SECRET="${SESSION_SECRET:-smoke-test-secret-very-long-string-1234567890-abcdefg-xyzzy}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "nu PMC — full verify"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. MariaDB
if ! pgrep mariadbd > /dev/null; then
  echo "  starting MariaDB"
  mariadbd --socket=$DB_SOCKET --port=3307 --datadir=/var/lib/mysql --user=root > /tmp/mariadb.log 2>&1 &
  for i in 1 2 3 4 5; do sleep 2; mysql --socket=$DB_SOCKET -uroot -e "SELECT 1" > /dev/null 2>&1 && break; done
fi
mysql --socket=$DB_SOCKET -uroot -e "SELECT 1" > /dev/null 2>&1 || { echo "✗ MariaDB failed to start"; exit 9; }
echo "✓ MariaDB up"

# 2. Seed
echo "━━━ seeding ━━━"
bash "$WORK_DIR/scripts/seed-full.sh" > /tmp/seed.log 2>&1
if [ $? -ne 0 ]; then
  echo "✗ seed failed — see /tmp/seed.log"
  tail -10 /tmp/seed.log
  exit 9
fi
echo "✓ seed OK"

# 3. Node server
if ! pgrep -f "node server.js" > /dev/null; then
  echo "  starting node"
  export DB_HOST=127.0.0.1 DB_PORT=3307 DB_SOCKET=$DB_SOCKET DB_NAME=nu_pmc DB_USER=root DB_PASSWORD=""
  export PORT=$PORT SESSION_SECRET=$SESSION_SECRET
  nohup node server.js > /tmp/node.log 2>&1 &
  for i in 1 2 3 4 5 6; do sleep 2; curl -sS --max-time 2 http://127.0.0.1:$PORT/ > /dev/null 2>&1 && break; done
fi
curl -sS --max-time 3 http://127.0.0.1:$PORT/ > /dev/null 2>&1 || { echo "✗ node failed"; tail -10 /tmp/node.log; exit 9; }
echo "✓ node up on $PORT"

# 4. Tests
echo "━━━ running tests ━━━"
PASS=0; FAIL=0; FAIL_LIST=""
for t in $(ls "$WORK_DIR"/tests/verify/*.py 2>/dev/null | sort); do
  name=$(basename "$t" .py)
  printf "  %-30s " "$name"
  out=$(python3 "$t" 2>&1)
  # Tests print a final line: "RESULT: N/M pass" or "LEAK" — inspect
  if echo "$out" | grep -qE "RESULT:.*0 fail|RESULT:.*0 LEAK|0/0"; then
    echo "✓"
    PASS=$((PASS+1))
  elif echo "$out" | grep -qE "RESULT:"; then
    # Has a RESULT line but contains non-zero fail — report last RESULT line
    result_line=$(echo "$out" | grep -E "RESULT:" | tail -1)
    echo "✗ $result_line"
    FAIL=$((FAIL+1))
    FAIL_LIST="$FAIL_LIST $name"
  else
    echo "? no RESULT line"
    FAIL=$((FAIL+1))
    FAIL_LIST="$FAIL_LIST $name(malformed)"
  fi
done

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "VERIFY SUMMARY: $PASS pass, $FAIL fail"
[ -n "$FAIL_LIST" ] && echo "  failing:$FAIL_LIST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
exit $FAIL
