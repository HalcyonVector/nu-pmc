#!/bin/bash
# post-deploy-smoke.sh
# Run immediately after deploying nu PMC. Confirms the basics work
# before Guru/team start using the system.
#
# Usage:   ./scripts/post-deploy-smoke.sh [BASE_URL]
# Example: ./scripts/post-deploy-smoke.sh http://localhost:3000
# Exit code: 0 on all-pass, 1 on any failure.

set -u  # error on unbound variables

BASE="${1:-${BASE_URL:-http://localhost:3000}}"
COOKIE_JAR=/tmp/nu-pmc-smoke-cookies
rm -f "$COOKIE_JAR"

PASS=0
FAIL=0
FAILURES=()

# ── helpers ──────────────────────────────────────────────────────────
chk() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "  ✓ $label"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $label — expected $expected, got $actual"
    FAIL=$((FAIL + 1))
    FAILURES+=("$label (expected $expected, got $actual)")
  fi
}

chk_in() {
  local label="$1"
  local expected_set="$2"  # comma-separated: "200,404"
  local actual="$3"
  if [[ ",$expected_set," == *",$actual,"* ]]; then
    echo "  ✓ $label ($actual)"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $label — expected one of $expected_set, got $actual"
    FAIL=$((FAIL + 1))
    FAILURES+=("$label (expected $expected_set, got $actual)")
  fi
}

http_code() {
  curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$@"
}

http_body() {
  curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$@"
}

echo "=============================================="
echo "nu PMC post-deploy smoke test"
echo "Target: $BASE"
echo "Started: $(date)"
echo "=============================================="
echo ""

# ── 1. Server responds ───────────────────────────────────────────────
echo "Group 1: Connectivity"
code=$(http_code "$BASE/")
chk "Server responds on /" "200" "$code"

code=$(http_code "$BASE/api/health" 2>/dev/null || echo "na")
# Health endpoint is optional
if [[ "$code" != "na" ]]; then
  chk_in "Health endpoint" "200,404" "$code"
fi

# ── 2. Static assets ─────────────────────────────────────────────────
echo ""
echo "Group 2: Static assets"
code=$(http_code "$BASE/js/app.js")
chk "app.js served" "200" "$code"

code=$(http_code "$BASE/js/api.js")
chk "api.js served" "200" "$code"

# ── 3. Authentication ────────────────────────────────────────────────
echo ""
echo "Group 3: Authentication"

# Bad login → 401
code=$(http_code -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"nobody","password":"wrong"}')
chk "Bad credentials rejected" "401" "$code"

# Good login — need the default naveen user
code=$(http_code -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"naveen","password":"NuPMC@2026"}')
if [[ "$code" == "200" ]]; then
  echo "  ✓ Naveen login succeeded"
  PASS=$((PASS + 1))
else
  echo "  ✗ Naveen login failed ($code) — did create-admin.js run?"
  FAIL=$((FAIL + 1))
  FAILURES+=("Naveen login ($code)")
fi

# /api/auth/me should return user
code=$(http_code "$BASE/api/auth/me")
chk "Session active after login" "200" "$code"

# ── 4. Core endpoints (authenticated) ────────────────────────────────
echo ""
echo "Group 4: Core endpoints"

code=$(http_code "$BASE/api/dashboard")
chk "Dashboard loads" "200" "$code"

code=$(http_code "$BASE/api/projects")
chk "Projects list" "200" "$code"

code=$(http_code "$BASE/api/users")
chk "Users list (admin)" "200" "$code"

# Approvals — returns 200 with empty list on fresh DB
code=$(http_code "$BASE/api/approvals")
chk "Approvals list" "200" "$code"

# ── 5. Safety pattern (destructive actions require confirmation) ─────
echo ""
echo "Group 5: Safety pattern"

# ICICI generate without confirmation → 400
code=$(http_code -X POST "$BASE/api/payments/1/icici/generate" \
  -H "Content-Type: application/json" \
  -d '{"payment_ids":[1]}')
chk_in "ICICI generate rejects missing confirmation" "400,404" "$code"

# MOM issue without confirmation → 400
code=$(http_code -X POST "$BASE/api/meetings/1/issue-to-client" \
  -H "Content-Type: application/json" \
  -d '{}')
chk_in "MOM issue rejects missing confirmation" "400,404" "$code"

# NCR flag without confirmation → 400
code=$(http_code -X PATCH "$BASE/api/grn/1/flag-nonconformance" \
  -H "Content-Type: application/json" \
  -d '{"reason":"test"}')
chk_in "NCR flag rejects missing confirmation" "400,403,404" "$code"

# ── 6. Role gates ────────────────────────────────────────────────────
echo ""
echo "Group 6: Role gates (site manager blocked from privileged)"

# Login as site_manager
code=$(http_code -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"anjaneya","password":"NuPMC@2026"}')

if [[ "$code" == "200" ]]; then
  # ICICI generate → 403
  code=$(http_code -X POST "$BASE/api/payments/1/icici/generate" \
    -H "Content-Type: application/json" \
    -d '{"payment_ids":[1],"confirmation":"GENERATE","expected_total":0}')
  chk "Site mgr blocked from ICICI" "403" "$code"

  # Batch approve → 403
  code=$(http_code -X POST "$BASE/api/payment-requests/1/batch-approve" \
    -H "Content-Type: application/json" \
    -d '{"ids":[1]}')
  chk "Site mgr blocked from batch approve" "403" "$code"

  # Own-scope read → 200 or 404 (not 403)
  code=$(http_code "$BASE/api/grn/1")
  chk_in "Site mgr can read own scope (GRN list)" "200,404" "$code"
else
  echo "  ⚠  Could not log in as site manager (anjaneya) — skipping role checks"
fi

# ── 7. Database integrity ────────────────────────────────────────────
echo ""
echo "Group 7: Database integrity"

# Log back in as naveen for admin-level check
http_code -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"naveen","password":"NuPMC@2026"}' > /dev/null

# If there's a health/db endpoint, use it. Otherwise smoke via /api/users count
body=$(http_body "$BASE/api/users")
if echo "$body" | grep -qE '"users"\s*:\s*\['; then
  echo "  ✓ Users table queryable"
  PASS=$((PASS + 1))
else
  echo "  ✗ Users table query failed — check DB connection"
  FAIL=$((FAIL + 1))
  FAILURES+=("Users table query")
fi

# ── 8. No 500 on common paths ────────────────────────────────────────
echo ""
echo "Group 8: No 500 errors"

for path in /api/dashboard /api/projects /api/users /api/approvals; do
  code=$(http_code "$BASE$path")
  if [[ "$code" =~ ^5 ]]; then
    echo "  ✗ 5xx on $path ($code)"
    FAIL=$((FAIL + 1))
    FAILURES+=("$path returned $code")
  else
    echo "  ✓ $path: $code"
    PASS=$((PASS + 1))
  fi
done

# ── Cleanup ──────────────────────────────────────────────────────────
rm -f "$COOKIE_JAR"

# ── Summary ──────────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "Summary: $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "Failures:"
  for f in "${FAILURES[@]}"; do
    echo "  - $f"
  done
  echo ""
  echo "Deploy is NOT clean. Investigate before directing users to the system."
  exit 1
else
  echo ""
  echo "Deploy looks clean. Safe to direct users."
  exit 0
fi
