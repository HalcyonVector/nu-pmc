# Makefile — V5 ship-readiness CI harness
# Usage:
#   make verify        — runs full sieve, exits 0 if ship-ready, 1 if findings
#   make verify-quick  — runs only the role × route matrix (fastest signal)
#   make verify-sql    — runs only SQL correctness sieve
#   make verify-gui    — runs only the GUI link audit

.PHONY: verify verify-quick verify-sql verify-matrix verify-gui clean-test

verify: verify-sql verify-matrix verify-gui
	@echo ""
	@echo "✓✓✓ V5 SHIP-READINESS VERIFIED ✓✓✓"

verify-quick: verify-matrix

verify-sql:
	@echo "── Phase 1: SQL correctness sieve ────"
	@bash tools/live-db-audit.sh
	@echo ""

verify-matrix:
	@echo "── Phase 2: Role × Route matrix (335 routes × 17 roles) ────"
	@rm -f tools/matrix-results.json
	@MATRIX_MODULES=auth,system,onboarding,site,design-services,workflow,finance,reporting \
	  bash tools/run-matrix-harness.sh > tools/last-run.log 2>&1; \
	  RC=$$?; \
	  node -e " \
	    const r = require('./tools/matrix-results.json'); \
	    const findings = r['FALSE-POS'].length + r['FALSE-POS-AUDIT-WRITE'].length + \
	                     r['FALSE-NEG'].length + r['ERROR-500'].length + r['UNAUTH'].length; \
	    if (findings === 0) { \
	      console.log('  ✓', r.total, 'checks, ZERO findings'); \
	      console.log('     P:', r['TRUE-POS'], 'N:', r['TRUE-NEG'], 'I404:', r['INCONCLUSIVE-404'], 'IB:', r['INCONCLUSIVE-BODY'], 'IE:', r['INCONCLUSIVE-EXTERNAL']); \
	      process.exit(0); \
	    } else { \
	      console.log('  ✗', findings, 'findings — see tools/last-run.log'); \
	      process.exit(1); \
	    } \
	  "
	@echo ""

verify-gui:
	@echo "── Phase 4: GUI link correctness ────"
	@node tools/phase4-gui-links.js | tail -20
	@echo ""

clean-test:
	@pkill -9 mysqld 2>/dev/null || true
	@pkill -9 -f "node server" 2>/dev/null || true
	@rm -rf /tmp/mysql-nu/data
	@rm -f /tmp/mysql-nu/mysql.sock /tmp/mysql-nu/mysqld.pid /tmp/mysql-nu/data/aria_log_control
	@rm -f tools/matrix-results.json tools/last-run.log
	@echo "test environment cleaned"
