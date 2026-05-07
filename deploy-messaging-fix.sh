#!/bin/bash

# Deploy Firebase Messaging Feature Configuration Fix
# This script deploys the security rules and indexes for messaging collections

set -e

echo "🚀 Deploying Firebase Messaging Feature Configuration Fix"
echo "=========================================================="
echo ""
echo "Collections being fixed:"
echo "  ✅ message_campaigns (NEW - rules + indexes)"
echo "  ✅ sender_profiles (FIXED - permission conflicts)"
echo "  ✅ message_templates (FIXED - permission conflicts)"
echo "  ✅ message_styles (FIXED - permission conflicts)"
echo "  ✅ automations (FIXED - permission conflicts)"
echo ""

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Error: Firebase CLI is not installed"
    echo "   Install it with: npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in
if ! firebase projects:list &> /dev/null; then
    echo "❌ Error: Not logged in to Firebase"
    echo "   Run: firebase login"
    exit 1
fi

echo "📋 Step 1: Deploying Firestore Security Rules"
echo "----------------------------------------------"
echo "This will fix permission errors for:"
echo "  - message_campaigns (missing rules)"
echo "  - sender_profiles (get/list conflict)"
echo "  - message_templates (get/list conflict)"
echo "  - message_styles (get/list conflict)"
echo "  - automations (get/list conflict)"
echo ""
firebase deploy --only firestore:rules

if [ $? -eq 0 ]; then
    echo "✅ Security rules deployed successfully"
    echo "   All permission errors should now be resolved!"
else
    echo "❌ Failed to deploy security rules"
    exit 1
fi

echo ""
echo "📊 Step 2: Deploying Firestore Indexes"
echo "----------------------------------------------"
echo "Adding 7 new composite indexes for message_campaigns:"
echo "  1. workspaceId + status + updatedAt"
echo "  2. workspaceId + updatedAt"
echo "  3. workspaceId + channel + updatedAt"
echo "  4. organizationId + status + updatedAt"
echo "  5. status + scheduledAt"
echo "  6. createdBy + updatedAt"
echo "  7. workspaceId + createdAt"
echo ""
firebase deploy --only firestore:indexes

if [ $? -eq 0 ]; then
    echo "✅ Indexes deployment initiated"
    echo ""
    echo "⏳ Note: Index creation can take several minutes to complete."
    echo "   Monitor progress in Firebase Console:"
    echo "   https://console.firebase.google.com/project/_/firestore/indexes"
else
    echo "❌ Failed to deploy indexes"
    exit 1
fi

echo ""
echo "=========================================================="
echo "✅ Deployment Complete!"
echo ""
echo "What was fixed:"
echo "  ✅ message_campaigns - Added complete rules and indexes"
echo "  ✅ sender_profiles - Fixed permission conflicts"
echo "  ✅ message_templates - Fixed permission conflicts"
echo "  ✅ message_styles - Fixed permission conflicts"
echo "  ✅ automations - Fixed permission conflicts"
echo ""
echo "Next Steps:"
echo "1. Wait for indexes to finish building (check Firebase Console)"
echo "2. Test the messaging campaign flow in your application"
echo "3. Verify sender profiles, templates, and styles load correctly"
echo "4. Check that no permission errors appear"
echo ""
echo "See FIRESTORE_RULES_FIX_COMPLETE.md for complete details"
echo "=========================================================="
