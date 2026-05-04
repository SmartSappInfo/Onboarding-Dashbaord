#!/bin/bash

# This script documents the manual fixes needed for pipeline field removal
# Run each command to see affected lines, then fix manually

echo "=== Finding all currentStageName references ==="
grep -rn "currentStageName" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v ".next"

echo ""
echo "=== Finding all stageId references ==="
grep -rn "\.stageId" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v ".next"

echo ""
echo "=== Finding all pipelineId references in WorkspaceEntity context ==="
grep -rn "\.pipelineId" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v ".next" | grep -v "Deal"

echo ""
echo "=== Summary ==="
echo "Replace currentStageName with lifecycleStatus"
echo "Remove stageId references or query Deal records"
echo "Remove pipelineId references or query Deal records"
