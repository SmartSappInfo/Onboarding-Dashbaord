#!/bin/bash

# Quick Test Status Script
# Runs a subset of tests to get quick feedback

set -e

echo "🧪 Quick Test Status Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test categories to check
declare -a test_patterns=(
  "src/lib/__tests__/contact-adapter-new-methods.test.ts"
  "src/lib/__tests__/contact-adapter.test.ts"
  "src/lib/__tests__/workspace-actions.test.ts"
  "src/lib/__tests__/csv-parser.test.ts"
  "src/lib/__tests__/email-verification.test.ts"
  "src/components/__tests__/app-sidebar.test.tsx"
  "src/hooks/__tests__/use-template-editor.test.ts"
)

passed=0
failed=0

for pattern in "${test_patterns[@]}"; do
  echo "Testing: $pattern"
  if pnpm vitest run "$pattern" --reporter=dot --silent 2>&1 | grep -q "passed"; then
    echo "  ✅ PASSED"
    ((passed++))
  else
    echo "  ❌ FAILED"
    ((failed++))
  fi
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary: $passed passed, $failed failed"
echo ""

if [ $failed -eq 0 ]; then
  echo "✅ All quick tests passed!"
  exit 0
else
  echo "⚠️  Some tests failed. Run full test suite for details."
  exit 1
fi
