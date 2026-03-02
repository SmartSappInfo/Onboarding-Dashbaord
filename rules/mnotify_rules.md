# mNotify BMS API v2.0 — AI-Optimized Specification

## PURPOSE

This document defines a complete, normalized, machine-readable guide for interacting with the mNotify BMS API v2.0.

It is designed for:
- AI agents
- Autonomous workflows
- Backend services
- RAG pipelines
- LLM fine-tuning

All rules in this document are authoritative.

---

## BASE CONFIGURATION

Base URL:
https://api.mnotify.com/api

Authentication:
All requests MUST include the API key as a query parameter.

Format:
?key=YOUR_API_KEY

Example:
https://api.mnotify.com/api/template?key=YOUR_API_KEY

---

## GLOBAL RULES (STRICT)

1. All requests are RESTful
2. HTTP verbs must match endpoint purpose
3. All responses are JSON
4. Date format: YYYY-MM-DD hh:mm
5. Phone numbers must be Ghana format:
   - 233XXXXXXXXX OR
   - 0XXXXXXXXX
6. `_id` values returned MUST be stored for future queries
7. Do NOT include optional fields unless explicitly required
8. Sender IDs must be approved before use
9. Credit is deducted per successful campaign
10. Treat IVR and USSD as stateful sessions

---

## MODULE 1: SMS

### 1.1 QUICK BULK SMS

Endpoint:
POST /sms/quick

Purpose:
Send SMS directly to phone numbers without using groups.

Payload:
{
  "recipient": ["0241234567", "0201234567"],
  "sender": "mNotify",
  "message": "Message text",
  "is_schedule": false,
  "schedule_date": ""
}

Rules:
- sender max length: 11 characters
- Do NOT include sms_type unless sending OTP
- If sms_type = "otp", cost = 0.035 credits per campaign

Response:
{
  "status": "success",
  "summary": {
    "_id": "CAMPAIGN_ID",
    "total_sent": 2,
    "credit_used": 2,
    "credit_left": 1483
  }
}

---

### 1.2 GROUP BULK SMS

Endpoint:
POST /sms/group

Purpose:
Send SMS to predefined contact groups.

Payload:
{
  "group_id": ["1", "2"],
  "sender": "mNotify",
  "message_id": "17481",
  "is_schedule": false,
  "schedule_date": ""
}

Rules:
- message_id must exist
- groups must contain contacts

---

### 1.3 SCHEDULED SMS

Get Scheduled SMS:
GET /scheduled

Update Scheduled SMS:
POST /scheduled/{id}

Payload:
{
  "sender": "mNotify",
  "message": "Updated message",
  "schedule_date": "2025-12-30 17:56:00"
}

---

### 1.4 SENDER ID MANAGEMENT

Register Sender ID:
POST /senderid/register

Payload:
{
  "sender_name": "mNotify",
  "purpose": "Reason for registration"
}

Check Sender ID Status:
POST /senderid/status

Payload:
{
  "sender_name": "mNotify"
}

---

## MODULE 2: VOICE CALLS

### 2.1 QUICK BULK VOICE CALL

Endpoint:
POST /voice/quick

Purpose:
Send recorded voice calls.

Rules:
- Use either file OR voice_id, not both
- Audio formats: mp3, wav

Payload (multipart):
campaign=Campaign Name
recipient[]=0241234567
file=@voice.mp3
is_schedule=false
schedule_date=

Response includes:
- campaign _id
- voice_id
- credit_used

---

### 2.2 GROUP BULK VOICE CALL

Endpoint:
POST /voice/group

Purpose:
Send voice calls to groups using an existing voice_id.

---

## MODULE 3: IVR (INBOUND)

### 3.1 INITIATE IVR CALL

Endpoint:
POST /initiate-ivr-call

Payload:
{
  "fromNumber": "233501234567",
  "toNumber": "233541234567",
  "uuid": "uuid-string",
  "uniqueId": "tracking-id"
}

Response:
{
  "status": "success",
  "callId": "call_12345"
}

---

### 3.2 IVR CALLBACK (WEBHOOK)

Method:
GET

Purpose:
Receive IVR interaction data and respond with next action.

Incoming Parameters:
- CallerId
- Extension
- SequenceID
- IsStarting
- DTMF
- Timestamp
- action
- context
- recordingUrl

Response MUST be JSON with action instructions.

Valid Actions:
- playback
- get_digits
- background
- dial
- record
- hangup

Example Response:
{
  "playback": {
    "url": "https://example.com/welcome.wav"
  }
}

---

## MODULE 4: VOICE IVR SCENARIOS (OUTBOUND)

### 4.1 SCENARIOS

Get all scenarios:
GET /ivr-scenarios

Get single scenario:
GET /ivr-scenario/{id}

Create scenario:
POST /ivr-scenario

Payload:
{
  "title": "Scenario Title",
  "description": "Scenario description"
}

Update scenario:
PUT /ivr-scenario/{id}

Delete scenario:
DELETE /ivr-scenario/{id}

Launch scenario:
POST /ivr-scenario/launch

Payload:
{
  "id": "SCENARIO_ID",
  "recipients": ["024XXXXXXX", "020XXXXXXX"]
}

---

### 4.2 SCENARIO FLOWS (CHILD FLOWS)

Rules:
- Starting flow route MUST be named "start"
- DTMF keys map to routes

Get flow:
GET /ivr-scenarios/flow/{flow_id}

Create flow:
POST /ivr-scenarios/flow

Payload:
{
  "flow_name": "Sales Menu",
  "route": "start",
  "audio": "https://audio.url/file.mp3",
  "dtmf": {
    "1": "sales",
    "2": "support"
  }
}

Update flow:
PUT /ivr-scenarios/flow/{id}

Delete flow:
DELETE /ivr-scenarios/flow/{id}

---

## MODULE 5: USSD

### 5.1 SHARED USSD

Inbound request fields:
- msisdn
- sequenceID
- data
- timestamp

Response Format:
{
  "msisdn": "233XXXXXXXXX",
  "sequenceID": "SESSION_ID",
  "message": "Menu text",
  "timestamp": "TIMESTAMP",
  "continueFlag": 0
}

continueFlag:
0 = continue session
1 = end session

---

### 5.2 DEDICATED USSD

Inbound fields:
- shortCode
- msIsdn
- text
- sessId
- ussdGwId

Response Format:
{
  "responseExitCode": 200,
  "shouldClose": false,
  "ussdMenu": "1. Balance\r\n2. Buy Data",
  "responseMessage": "OK"
}

---

## MODULE 6: MESSAGE TEMPLATES

Endpoints:
GET    /template
GET    /template/{id}
POST   /template
PUT    /template/{id}
DELETE /template/{id}

Template Placeholders:
- [fname]
- [lname]
- [fullname]

---

## MODULE 7: GROUPS

Endpoints:
GET    /group
POST   /group
PUT    /group/{id}
DELETE /group/{id}

---

## MODULE 8: CONTACTS

Endpoints:
GET    /contact
GET    /contact/{id}
POST   /contact/{group_id}
PUT    /contact/{id}
DELETE /contact/{id}/{group_id}

Contact Fields:
- phone
- title
- firstname
- lastname
- email
- dob (YYYY-MM-DD)

---

## MODULE 9: REPORTS & BALANCES

### Balances
GET /balance/sms
GET /balance/voice

---

### SMS REPORTS

Campaign report:
GET /campaign/{campaign_id}/{status}

Single SMS report:
GET /status/{id}

Periodic report:
GET /report?from=YYYY-MM-DD&to=YYYY-MM-DD

---

### VOICE REPORTS

Campaign report:
GET /calls/{campaign_id}/{status}

Single call report:
GET /call-status/{id}

Periodic report:
GET /call-period?from=YYYY-MM-DD&to=YYYY-MM-DD

---

## AI OPERATIONAL GUIDELINES

- Always validate sender approval before sending SMS
- Always persist returned `_id`
- Model IVR and USSD as finite-state machines
- Never retry blindly (check status first)
- Credits are finite — query balance before large campaigns
- Treat scheduled jobs as mutable resources

END OF SPECIFICATION