const fs = require('fs');
const path = require('path');

const localIndexesFile = '/Users/josephaidoo/Desktop/Codes/vibe Coding/Onboarding-Dashbaord-main/firestore.indexes.json';
const neededIndexesFile = '/Users/josephaidoo/.gemini/antigravity/brain/ca9b5d89-fd4d-45c3-92cd-248a7ea4a5e6/scratch/needed_indexes_firestore_format.json';

if (!fs.existsSync(localIndexesFile)) {
  console.error("Local firestore.indexes.json not found!");
  process.exit(1);
}

if (!fs.existsSync(neededIndexesFile)) {
  console.error("Needed indexes file not found! Make sure to run parse_and_analyze_raw.js first.");
  process.exit(1);
}

const localData = JSON.parse(fs.readFileSync(localIndexesFile, 'utf8'));
const neededIndexes = JSON.parse(fs.readFileSync(neededIndexesFile, 'utf8'));

const existingIndexes = localData.indexes || [];
let addedCount = 0;

// Helper to compare two index definitions
function isSameIndex(idx1, idx2) {
  if (idx1.collectionGroup !== idx2.collectionGroup) return false;
  if (idx1.queryScope !== idx2.queryScope) return false;
  if (idx1.fields.length !== idx2.fields.length) return false;
  
  for (let i = 0; i < idx1.fields.length; i++) {
    const f1 = idx1.fields[i];
    const f2 = idx2.fields[i];
    if (f1.fieldPath !== f2.fieldPath) return false;
    if (f1.order !== f2.order) return false;
    if (f1.arrayConfig !== f2.arrayConfig) return false;
  }
  
  return true;
}

neededIndexes.forEach(needed => {
  const exists = existingIndexes.some(local => isSameIndex(local, needed));
  if (!exists) {
    existingIndexes.push(needed);
    addedCount++;
  }
});

// Sort indexes alphabetically by collectionGroup, then by field count
existingIndexes.sort((a, b) => {
  if (a.collectionGroup < b.collectionGroup) return -1;
  if (a.collectionGroup > b.collectionGroup) return 1;
  return a.fields.length - b.fields.length;
});

localData.indexes = existingIndexes;

// Write updated indexes file back
fs.writeFileSync(localIndexesFile, JSON.stringify(localData, null, 2) + '\n');

console.log(`Merged indexes successfully!`);
console.log(`Added: ${addedCount} new indexes.`);
console.log(`Total local indexes count: ${existingIndexes.length}`);
