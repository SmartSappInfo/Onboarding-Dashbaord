#!/bin/bash
set -e

# Google Cloud Scheduler for automation heartbeat (delay nodes + campaign jobs).
# Targets Firebase App Hosting (Cloud Run). Pairs with apphosting.yaml CRON_SECRET → cron-secret.

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'
BOLD='\033[1m'
RESET='\033[0m'

JOB_NAME="${JOB_NAME:-automation-heartbeat}"
SCHEDULE="${SCHEDULE:-* * * * *}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-studio}"
SECRET_NAME="${SECRET_NAME:-cron-secret}"

echo -e "${BOLD}${CYAN}Automation heartbeat — Cloud Scheduler setup${RESET}"

echo -e "\n${BLUE}[1/6] GCP project${RESET}"
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}No active GCP project. Run: gcloud config set project <PROJECT_ID>${RESET}"
  exit 1
fi
echo -e "Project: ${BOLD}${GREEN}$PROJECT_ID${RESET}"

echo -e "\n${BLUE}[2/6] App Hosting URL${RESET}"
SERVICE_URL=$(npx firebase-tools apphosting:backends:list --project="$PROJECT_ID" 2>/dev/null | grep -o -E 'https://[^ ]+\.hosted\.app' | head -n 1 || true)
if [ -z "$SERVICE_URL" ]; then
  SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format="value(status.url)" --project="$PROJECT_ID" 2>/dev/null || true)
fi
if [ -z "$SERVICE_URL" ]; then
  DISCOVERED=$(gcloud run services list --format="value(SERVICE,REGION,URL)" --project="$PROJECT_ID" 2>/dev/null | head -n 1)
  if [ -z "$DISCOVERED" ]; then
    echo -e "${RED}No Cloud Run / App Hosting URL found. Deploy the app first.${RESET}"
    exit 1
  fi
  SERVICE_NAME=$(echo "$DISCOVERED" | awk '{print $1}')
  REGION=$(echo "$DISCOVERED" | awk '{print $2}')
  SERVICE_URL=$(echo "$DISCOVERED" | awk '{print $3}')
fi
CRON_ENDPOINT_URL="${SERVICE_URL}/api/cron/automation-heartbeat"
echo -e "Backend: ${BOLD}${GREEN}$SERVICE_URL${RESET}"
echo -e "Cron:    ${BOLD}${CYAN}$CRON_ENDPOINT_URL${RESET}"

echo -e "\n${BLUE}[3/6] Secret Manager (${SECRET_NAME})${RESET}"
if [ -n "$CRON_SECRET" ]; then
  echo -e "Using CRON_SECRET from environment."
else
  CRON_SECRET=$(openssl rand -hex 32)
  echo -e "Generated new secret (save this for local testing if needed)."
fi

if gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo -n "$CRON_SECRET" | gcloud secrets versions add "$SECRET_NAME" --data-file=- --project="$PROJECT_ID"
  echo -e "${GREEN}Added new version to existing secret.${RESET}"
else
  echo -n "$CRON_SECRET" | gcloud secrets create "$SECRET_NAME" --data-file=- --project="$PROJECT_ID" --replication-policy="automatic"
  echo -e "${GREEN}Created secret ${SECRET_NAME}.${RESET}"
fi

echo -e "\n${BLUE}[4/6] Grant App Hosting access to secret${RESET}"
if command -v firebase >/dev/null 2>&1; then
  firebase apphosting:secrets:grantaccess "$SECRET_NAME" --backend "$SERVICE_NAME" --project "$PROJECT_ID" 2>/dev/null || \
    npx firebase-tools apphosting:secrets:grantaccess "$SECRET_NAME" --backend "$SERVICE_NAME" --project "$PROJECT_ID" || \
    echo -e "${YELLOW}Grant access manually: firebase apphosting:secrets:grantaccess $SECRET_NAME --backend $SERVICE_NAME${RESET}"
else
  npx firebase-tools apphosting:secrets:grantaccess "$SECRET_NAME" --backend "$SERVICE_NAME" --project "$PROJECT_ID" 2>/dev/null || \
    echo -e "${YELLOW}Run: firebase apphosting:secrets:grantaccess $SECRET_NAME --backend $SERVICE_NAME${RESET}"
fi

echo -e "\n${BLUE}[5/6] Enable Cloud Scheduler API (if needed)${RESET}"
gcloud services enable cloudscheduler.googleapis.com --project="$PROJECT_ID" >/dev/null 2>&1 || true

echo -e "\n${BLUE}[6/6] Scheduler job (${JOB_NAME})${RESET}"
JOB_EXISTS=$(gcloud scheduler jobs list --location="$REGION" --filter="name:$JOB_NAME" --format="value(name)" 2>/dev/null || true)
if [ -n "$JOB_EXISTS" ]; then
  gcloud scheduler jobs update http "$JOB_NAME" \
    --location="$REGION" \
    --schedule="$SCHEDULE" \
    --uri="$CRON_ENDPOINT_URL" \
    --http-method=GET \
    --update-headers="Authorization=Bearer $CRON_SECRET" \
    --time-zone="UTC" \
    --description="Every-minute automation heartbeat (delays + campaign jobs)." >/dev/null
  echo -e "${GREEN}Updated scheduler job.${RESET}"
else
  gcloud scheduler jobs create http "$JOB_NAME" \
    --location="$REGION" \
    --schedule="$SCHEDULE" \
    --uri="$CRON_ENDPOINT_URL" \
    --http-method=GET \
    --headers="Authorization=Bearer $CRON_SECRET" \
    --time-zone="UTC" \
    --description="Every-minute automation heartbeat (delays + campaign jobs)." >/dev/null
  echo -e "${GREEN}Created scheduler job.${RESET}"
fi

echo -e "\n${BOLD}${GREEN}Done.${RESET} Redeploy App Hosting so CRON_SECRET is picked up from Secret Manager."
echo -e "Smoke test: ${BOLD}gcloud scheduler jobs run $JOB_NAME --location=$REGION${RESET}"
echo -e "Or: curl -s -H \"Authorization: Bearer \$CRON_SECRET\" \"$CRON_ENDPOINT_URL\""
