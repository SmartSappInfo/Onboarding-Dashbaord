#!/bin/bash
set -e

# Setup script for hourly background email verification via Google Cloud Scheduler
# Designed for Firebase App Hosting (running on Google Cloud Run)

# Color variables for premium UI output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0;30m' # No Color
BOLD='\033[1m'
RESET='\033[0m'

echo -e "${BOLD}${CYAN}============================================================${RESET}"
echo -e "${BOLD}${CYAN}   SmartSapp Hourly Email Verification Scheduler Setup      ${RESET}"
echo -e "${BOLD}${CYAN}============================================================${RESET}"

# 1. Detect Active Project ID
echo -e "\n${BLUE}[1/5] Detecting GCP Project ID...${RESET}"
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}Error: No active GCP project found. Please run: gcloud config set project <PROJECT_ID>${RESET}"
  exit 1
fi
echo -e "Found Active GCP Project: ${BOLD}${GREEN}$PROJECT_ID${RESET}"

# 2. Detect Cloud Run Service and URL
echo -e "\n${BLUE}[2/5] Locating App Hosting backend hosted URL...${RESET}"
SERVICE_NAME="studio"
REGION="us-central1"

echo -e "Attempting to retrieve Firebase App Hosting URL..."
SERVICE_URL=$(npx firebase-tools apphosting:backends:list --project="$PROJECT_ID" 2>/dev/null | grep -o -E "https://[^ ]+\.hosted\.app" | head -n 1 || true)

if [ -z "$SERVICE_URL" ]; then
  echo -e "${YELLOW}Could not resolve App Hosting URL automatically via firebase-tools.${RESET}"
  echo -e "Falling back to underlying Cloud Run service URL..."
  SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format="value(status.url)" 2>/dev/null || true)
fi

if [ -z "$SERVICE_URL" ]; then
  echo -e "${YELLOW}Warning: Could not find service '${SERVICE_NAME}' in '${REGION}'.${RESET}"
  echo -e "Attempting to auto-discover any Cloud Run services in the project..."
  
  DISCOVERED=$(gcloud run services list --format="value(SERVICE,REGION,URL)" 2>/dev/null | head -n 1)
  if [ -z "$DISCOVERED" ]; then
    echo -e "${RED}Error: No Cloud Run services found in project. Is the app deployed?${RESET}"
    exit 1
  fi
  
  SERVICE_NAME=$(echo "$DISCOVERED" | awk '{print $1}')
  REGION=$(echo "$DISCOVERED" | awk '{print $2}')
  SERVICE_URL=$(echo "$DISCOVERED" | awk '{print $3}')
fi

echo -e "Found backend target: ${BOLD}${GREEN}$SERVICE_URL${RESET} (Region: $REGION)"
CRON_ENDPOINT_URL="${SERVICE_URL}/api/verify-email/cron"
echo -e "Target Cron API: ${BOLD}${CYAN}$CRON_ENDPOINT_URL${RESET}"

# 3. Setup CRON_SECRET token
echo -e "\n${BLUE}[3/5] Setting up security credentials (CRON_SECRET)...${RESET}"
DEFAULT_SECRET=$(openssl rand -hex 16)
echo -e "Please enter your desired ${BOLD}CRON_SECRET${RESET} (Press enter to generate a secure random one):"
read -r -p "> " USER_SECRET

if [ -z "$USER_SECRET" ]; then
  CRON_SECRET="$DEFAULT_SECRET"
  echo -e "Generated secure random secret: ${BOLD}${YELLOW}$CRON_SECRET${RESET}"
else
  CRON_SECRET="$USER_SECRET"
  echo -e "Using provided secret."
fi

# 4. Create or Update Cloud Scheduler Job
echo -e "\n${BLUE}[4/5] Configuring Google Cloud Scheduler Job...${RESET}"
JOB_NAME="hourly-email-verification"

# Check if job already exists
JOB_EXISTS=$(gcloud scheduler jobs list --location="$REGION" --filter="name:$JOB_NAME" --format="value(name)" 2>/dev/null || true)

if [ -n "$JOB_EXISTS" ]; then
  echo -e "Scheduler job '${JOB_NAME}' already exists. Updating it..."
  gcloud scheduler jobs update http "$JOB_NAME" \
    --location="$REGION" \
    --schedule="0 * * * *" \
    --uri="$CRON_ENDPOINT_URL" \
    --http-method=GET \
    --update-headers="Authorization=Bearer $CRON_SECRET" \
    --time-zone="UTC" \
    --description="Hourly trigger for background contact email verification sweep." > /dev/null
  echo -e "${GREEN}Successfully updated Google Cloud Scheduler job!${RESET}"
else
  echo -e "Creating new Scheduler job '${JOB_NAME}'..."
  gcloud scheduler jobs create http "$JOB_NAME" \
    --location="$REGION" \
    --schedule="0 * * * *" \
    --uri="$CRON_ENDPOINT_URL" \
    --http-method=GET \
    --headers="Authorization=Bearer $CRON_SECRET" \
    --time-zone="UTC" \
    --description="Hourly trigger for background contact email verification sweep." > /dev/null
  echo -e "${GREEN}Successfully created Google Cloud Scheduler job!${RESET}"
fi

# 5. Instructions for environment variable setup
echo -e "\n${BLUE}[5/5] Required Action: Configure App Environment Variable${RESET}"
echo -e "You MUST configure ${BOLD}CRON_SECRET${RESET} as an environment variable in your App Hosting backend."
echo -e "To do this via Firebase CLI, run the following command:"
echo -e "${BOLD}${YELLOW}  firebase apphosting:secrets:set cron-secret${RESET}"
echo -e "Then associate it in your App Hosting settings, or set it directly in the Firebase Console under App Hosting settings."
echo -e "Value to set: ${BOLD}${GREEN}$CRON_SECRET${RESET}"

echo -e "\n${BOLD}${GREEN}============================================================${RESET}"
echo -e "${BOLD}${GREEN}   Setup Complete! Hourly background worker is active.       ${RESET}"
echo -e "${BOLD}${GREEN}============================================================${RESET}"
echo -e "To manually run the job right now to test it, run:"
echo -e "  ${BOLD}gcloud scheduler jobs run $JOB_NAME --location=$REGION${RESET}\n"
