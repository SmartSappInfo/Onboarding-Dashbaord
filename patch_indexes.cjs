const fs = require('fs');
const file = 'firestore.indexes.json';
let content = fs.readFileSync(file, 'utf-8');
const data = JSON.parse(content);

const newIndex = {
  "collectionGroup": "call_campaigns",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "organizationId", "order": "ASCENDING" },
    { "fieldPath": "workspaceId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "updatedAt", "order": "DESCENDING" }
  ]
};

// Check if index exists
const exists = data.indexes.some(idx => 
  idx.collectionGroup === 'call_campaigns' &&
  idx.fields.length === 4 &&
  idx.fields[0].fieldPath === 'organizationId' &&
  idx.fields[1].fieldPath === 'workspaceId' &&
  idx.fields[2].fieldPath === 'status' &&
  idx.fields[3].fieldPath === 'updatedAt'
);

if (!exists) {
  data.indexes.push(newIndex);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
