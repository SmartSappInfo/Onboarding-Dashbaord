import { adminDb } from '../src/lib/firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  console.log("=== INSPECTING DISCREPANCIES BETWEEN entities AND workspace_entities ===");
  
  const entitiesSnap = await adminDb.collection('entities').get();
  console.log(`Found ${entitiesSnap.size} entities`);
  
  const weSnap = await adminDb.collection('workspace_entities').get();
  console.log(`Found ${weSnap.size} workspace_entities`);
  
  const entitiesMap = new Map();
  entitiesSnap.docs.forEach(doc => {
    entitiesMap.set(doc.id, { id: doc.id, ...doc.data() });
  });
  
  weSnap.docs.forEach(doc => {
    const we = doc.data();
    const ent = entitiesMap.get(we.entityId);
    
    console.log(`\nWorkspaceEntity Name: "${we.displayName}" (ID: ${we.entityId})`);
    
    // Contacts in workspace_entities
    const weContacts = we.entityContacts || we.contacts || [];
    console.log(`  - Contacts in workspace_entities (${weContacts.length}):`);
    weContacts.forEach((c: any, idx: number) => {
      console.log(`    [${idx}] ${c.name} (${c.email || 'no email'}) [Primary: ${c.isPrimary}, Signatory: ${c.isSignatory}]`);
    });
    
    // Contacts in entities
    if (ent) {
      const entContacts = ent.entityContacts || ent.contacts || [];
      console.log(`  - Contacts in entities (${entContacts.length}):`);
      entContacts.forEach((c: any, idx: number) => {
        console.log(`    [${idx}] ${c.name} (${c.email || 'no email'}) [Primary: ${c.isPrimary}, Signatory: ${c.isSignatory}]`);
      });
      
      // Check for discrepancies
      const weEmails = weContacts.map((c: any) => c.email).sort().join(',');
      const entEmails = entContacts.map((c: any) => c.email).sort().join(',');
      if (weEmails !== entEmails) {
        console.log(`  🚨 DISCREPANCY DETECTED! Emails do not match!`);
      }
    } else {
      console.log(`  🚨 Parent Entity document not found in entities collection!`);
    }
  });
}

run().catch(err => console.error(err));
