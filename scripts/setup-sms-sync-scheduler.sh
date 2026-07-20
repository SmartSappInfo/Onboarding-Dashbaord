#!/usr/bin/env bash
# Targets Firebase App Hosting (Cloud Run). Pairs with apphosting.yaml CRON_SECRET → cron-secret.
# This script sets up a Cloud Scheduler job to ping the /api/cron/messaging-status-sync endpoint every minute.

set -e

# Default settings
DEFAULT_REGION="us-central1"
JOB_NAME="messaging-status-sync-cron"
SCHEDULE="* * * * *" # Every minute
SECRET_NAME="cron-secret"

# ANSI color codes
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

echo -e "${BOLD}${CYAN}Setup: Messaging Status Sync Scheduler (Firebase App Hosting)${RESET}\n"

# 1. Project verification
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}Error: No active gcloud project. Run 'gcloud config set project <your-project>'${RESET}"
  exit 1
fi
echo -e "Project: ${BOLD}${GREEN}$PROJECT_ID${RESET}"

# 2. Get target URL
read -p "Enter your Firebase App Hosting custom domain (e.g., https://app.mycompany.com): " SERVICE_URL
if [ -z "$SERVICE_URL" ]; then
  echo -e "${RED}URL is required.${RESET}"
  exit 1
fi

CRON_ENDPOINT_URL="${SERVICE_URL}/api/cron/messaging-status-sync"
echo -e "Cron Endpoint: ${BOLD}${CYAN}$CRON_ENDPOINT_URL${RESET}"

# 3. Retrieve or Create CRON_SECRET
echo -e "\n${BOLD}Retrieving CRON_SECRET from Secret Manager...${RESET}"
CRON_SECRET=$(gcloud secrets versions access latest --secret="$SECRET_NAME" --project="$PROJECT_ID" 2>/dev/null || true)

if [ -z "$CRON_SECRET" ]; then
  echo -e "${YELLOW}Secret not found. Generating a new one...${RESET}"
  CRON_SECRET=$(openssl rand -hex 32)
  if gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo -n "$CRON_SECRET" | gcloud secrets versions add "$SECRET_NAME" --data-file=- --project="$PROJECT_ID"
    echo -e "${GREEN}Added new version to existing secret.${RESET}"
  else
    echo -n "$CRON_SECRET" | gcloud secrets create "$SECRET_NAME" --data-file=- --project="$PROJECT_ID" --replication-policy="automatic"
    echo -e "${GREEN}Created secret ${SECRET_NAME}.${RESET}"
  fi
else
  echo -e "Secret retrieved successfully."
fi

# 3.5 Grant App Hosting access to secret
read -p "Enter your Firebase App Hosting backend name (default: studio): " SERVICE_NAME
SERVICE_NAME=${SERVICE_NAME:-studio}

echo -e "\n${BOLD}Granting App Hosting access to secret...${RESET}"
if command -v firebase >/dev/null 2>&1; then
  firebase apphosting:secrets:grantaccess "$SECRET_NAME" --backend "$SERVICE_NAME" --project "$PROJECT_ID" 2>/dev/null || \
    npx firebase-tools apphosting:secrets:grantaccess "$SECRET_NAME" --backend "$SERVICE_NAME" --project "$PROJECT_ID" || \
    echo -e "${YELLOW}Grant access manually: firebase apphosting:secrets:grantaccess $SECRET_NAME --backend $SERVICE_NAME${RESET}"
else
  npx firebase-tools apphosting:secrets:grantaccess "$SECRET_NAME" --backend "$SERVICE_NAME" --project "$PROJECT_ID" 2>/dev/null || \
    echo -e "${YELLOW}Run: firebase apphosting:secrets:grantaccess $SECRET_NAME --backend $SERVICE_NAME${RESET}"
fi

# 4. Create or Update Cloud Scheduler Job
read -p "Cloud Scheduler region (default: $DEFAULT_REGION): " REGION
REGION=${REGION:-$DEFAULT_REGION}

echo -e "\n${BOLD}Configuring Cloud Scheduler Job: $JOB_NAME${RESET}"

if gcloud scheduler jobs describe "$JOB_NAME" --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "Updating existing job..."
  gcloud scheduler jobs update http "$JOB_NAME" \
    --location="$REGION" \
    --project="$PROJECT_ID" \
    --schedule="$SCHEDULE" \
    --uri="$CRON_ENDPOINT_URL" \
    --http-method=GET \
    --update-headers="Authorization=Bearer $CRON_SECRET" \
    --time-zone="UTC"
else
  echo "Creating new job..."
  gcloud scheduler jobs create http "$JOB_NAME" \
    --location="$REGION" \
    --project="$PROJECT_ID" \
    --schedule="$SCHEDULE" \
    --uri="$CRON_ENDPOINT_URL" \
    --http-method=GET \
    --headers="Authorization=Bearer $CRON_SECRET" \
    --time-zone="UTC"
fi

echo -e "\n${BOLD}${GREEN}Done.${RESET} The status sync cron will now run every minute."
echo -e "You can trigger it manually with:"
echo -e "gcloud scheduler jobs run $JOB_NAME --location=$REGION"
