#!/bin/bash

# Quick script to run industry E2E tests
# Usage: ./src/e2e/RUN_INDUSTRY_TESTS.sh [test-file]

echo "🚀 Running Industry E2E Tests..."
echo ""

# Check if .env.test exists
if [ ! -f ".env.test" ]; then
    echo "⚠️  Warning: .env.test file not found"
    echo "   Copy .env.test.example to .env.test and configure test credentials"
    echo ""
fi

# Run specific test file if provided, otherwise run all industry tests
if [ -n "$1" ]; then
    echo "Running specific test: $1"
    pnpm exec playwright test "$1" --headed
else
    echo "Running all industry E2E tests..."
    pnpm exec playwright test src/e2e/workspace-creation-industry.spec.ts src/e2e/industry-feature-visibility.spec.ts --headed
fi

echo ""
echo "✅ Tests completed!"
echo "   View report: pnpm exec playwright show-report"
