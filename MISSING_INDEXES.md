# Missing Firestore Indexes for Survey Responses

Based on the analysis of the survey responses pages, here are the Firestore indexes that need to be configured:

## 1. Survey Responses Collection (Subcollection)
**Collection**: `surveys/{surveyId}/responses`
**Query**: `orderBy("submittedAt", "desc")`

```json
{
  "collectionGroup": "responses",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "submittedAt",
      "order": "DESCENDING"
    }
  ]
}
```

## 2. Survey Summaries Collection (Subcollection)
**Collection**: `surveys/{surveyId}/summaries`
**Query**: `orderBy("createdAt", "desc")`

```json
{
  "collectionGroup": "summaries",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "createdAt",
      "order": "DESCENDING"
    }
  ]
}
```

## 3. Survey Sessions Collection
**Collection**: `survey_sessions`
**Query**: `where("surveyId", "==", surveyId)`

This is a simple equality query and should work without a composite index, but if you encounter issues, add:

```json
{
  "collectionGroup": "survey_sessions",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "surveyId",
      "order": "ASCENDING"
    }
  ]
}
```

## 4. Users Collection (for Field Team View)
**Collection**: `users`
**Query**: `where("isAuthorized", "==", true)`

This index already exists in your configuration (line 1968-1977 in firestore.indexes.json).

## 5. Automations Collection (Already Added)
**Collection**: `automations`
**Query**: `where("workspaceIds", "array-contains", workspaceId).orderBy("name", "asc")`

This was already added in the previous fix.

## 6. Message Templates Collection (NEW)
**Collection**: `message_templates`
**Query**: `where("workspaceIds", "array-contains", workspaceId).orderBy("name", "asc")`

**Used in**: Survey editing page - submission behavior step for selecting email/SMS templates

```json
{
  "collectionGroup": "message_templates",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "workspaceIds",
      "arrayConfig": "CONTAINS"
    },
    {
      "fieldPath": "name",
      "order": "ASCENDING"
    }
  ]
}
```

**Status**: ✅ Added to firestore.indexes.json

---

## How to Deploy These Indexes

Add the missing indexes to your `firestore.indexes.json` file and deploy:

```bash
firebase deploy --only firestore:indexes
```

## Notes

- The `responses` and `summaries` collections are subcollections, so they use `collectionGroup` queries
- Most of these are simple single-field indexes that Firestore can auto-create, but explicit configuration ensures they're available immediately
- The survey_sessions query is a simple equality filter and may not require an explicit index unless you're doing additional filtering or ordering
