#!/bin/bash

# Test by Feature Script
# Run tests organized by feature area

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
  echo -e "${GREEN}[TEST]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Firebase emulator is running
check_emulator() {
  print_status "Checking Firebase emulator..."
  
  if ! nc -z localhost 8080 2>/dev/null; then
    print_warning "Firebase emulator not running on port 8080"
    print_warning "Start it with: firebase emulators:start --only firestore"
    return 1
  fi
  
  print_status "Firebase emulator is running ✓"
  return 0
}

# Run tests for a specific feature
run_feature_tests() {
  local feature=$1
  local pattern=$2
  
  print_status "Running $feature tests..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  if pnpm vitest run "$pattern" --reporter=verbose; then
    print_status "$feature tests PASSED ✓"
    return 0
  else
    print_error "$feature tests FAILED ✗"
    return 1
  fi
}

# Main script
main() {
  local feature=${1:-"all"}
  local failed_features=()
  
  echo ""
  print_status "SmartSapp Feature Test Runner"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  
  # Check emulator (optional - tests can use mocks)
  # check_emulator || print_warning "Continuing without emulator (tests will use mocks)"
  
  case $feature in
    "core")
      run_feature_tests "Core Infrastructure" "src/lib/__tests__/01-core" || failed_features+=("core")
      ;;
    
    "entities")
      run_feature_tests "Entity Management" "src/lib/__tests__/02-entities" || failed_features+=("entities")
      ;;
    
    "workspaces")
      run_feature_tests "Workspace Management" "src/lib/__tests__/03-workspaces" || failed_features+=("workspaces")
      ;;
    
    "tags")
      run_feature_tests "Tagging System" "src/lib/__tests__/04-tags" || failed_features+=("tags")
      ;;
    
    "pipelines")
      run_feature_tests "Pipeline Management" "src/lib/__tests__/05-pipelines" || failed_features+=("pipelines")
      ;;
    
    "messaging")
      run_feature_tests "Messaging System" "src/lib/__tests__/06-messaging" || failed_features+=("messaging")
      ;;
    
    "automation")
      run_feature_tests "Automation System" "src/lib/__tests__/07-automation" || failed_features+=("automation")
      ;;
    
    "forms")
      run_feature_tests "Forms & Surveys" "src/lib/__tests__/08-forms" || failed_features+=("forms")
      ;;
    
    "import-export")
      run_feature_tests "Import/Export" "src/lib/__tests__/09-import-export" || failed_features+=("import-export")
      ;;
    
    "components")
      run_feature_tests "UI Components" "src/components/__tests__" || failed_features+=("components")
      ;;
    
    "property")
      run_feature_tests "Property-Based Tests" "src/lib/__tests__/11-property" || failed_features+=("property")
      ;;
    
    "adapter")
      print_status "Running Contact Adapter tests..."
      run_feature_tests "Contact Adapter" "src/lib/__tests__/contact-adapter" || failed_features+=("adapter")
      ;;
    
    "tag-actions")
      print_status "Running Tag Actions tests..."
      run_feature_tests "Tag Actions" "src/lib/__tests__/tag-actions" || failed_features+=("tag-actions")
      ;;
    
    "all")
      print_status "Running ALL feature tests..."
      echo ""
      
      run_feature_tests "Contact Adapter" "src/lib/__tests__/contact-adapter" || failed_features+=("adapter")
      run_feature_tests "Workspace Management" "src/lib/__tests__/workspace" || failed_features+=("workspaces")
      run_feature_tests "Tagging System" "src/lib/__tests__/tag" || failed_features+=("tags")
      run_feature_tests "Entity Management" "src/lib/__tests__/entity" || failed_features+=("entities")
      run_feature_tests "Messaging System" "src/lib/__tests__/messaging" || failed_features+=("messaging")
      run_feature_tests "Automation System" "src/lib/__tests__/automation" || failed_features+=("automation")
      run_feature_tests "UI Components" "src/components/__tests__" || failed_features+=("components")
      ;;
    
    *)
      print_error "Unknown feature: $feature"
      echo ""
      echo "Usage: $0 [feature]"
      echo ""
      echo "Available features:"
      echo "  core          - Core infrastructure tests"
      echo "  entities      - Entity management tests"
      echo "  workspaces    - Workspace management tests"
      echo "  tags          - Tagging system tests"
      echo "  pipelines     - Pipeline management tests"
      echo "  messaging     - Messaging system tests"
      echo "  automation    - Automation system tests"
      echo "  forms         - Forms & surveys tests"
      echo "  import-export - Import/export tests"
      echo "  components    - UI component tests"
      echo "  property      - Property-based tests"
      echo "  adapter       - Contact adapter tests"
      echo "  tag-actions   - Tag actions tests"
      echo "  all           - Run all feature tests"
      echo ""
      exit 1
      ;;
  esac
  
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  if [ ${#failed_features[@]} -eq 0 ]; then
    print_status "All tests PASSED ✓"
    exit 0
  else
    print_error "Some tests FAILED ✗"
    echo ""
    print_error "Failed features:"
    for feature in "${failed_features[@]}"; do
      echo "  - $feature"
    done
    exit 1
  fi
}

# Run main function
main "$@"
