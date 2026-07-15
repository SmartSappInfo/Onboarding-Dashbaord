import { adminDb } from '../src/lib/firebase-admin';
import { triggerAutomationProtocols } from '../src/lib/automations/orchestrator';

async function simulate() {
  const contactId = 'prospect_entity_01aea20b-c3b3-4c29-a6c2-4a759e490487';
  const tagId = 'bJVxfxXRaNbrMBaPRuFS'; // [Automation] Test Contacts

  console.log(`>>> [SIMULATE] Fetching contact details: ${contactId}`);
  const contactSnap = await adminDb.collection('workspace_entities').doc(contactId).get();
  if (!contactSnap.exists) {
    console.error('Contact not found');
    return;
  }
  const contactData = contactSnap.data()!;

  const payload = {
    workspaceId: 'prospect',
    organizationId: contactData.organizationId || 'smartsapp-hq',
    entityId: contactData.entityId || contactId,
    entityType: contactData.entityType || 'institution',
    tagId: tagId,
    tagName: '[Automation] Test Contacts',
    _firingTrigger: 'TAG_ADDED',
  };

  console.log('>>> [SIMULATE] Triggering TAG_ADDED with payload:', JSON.stringify(payload, null, 2));

  try {
    // Run with sync = true to execute immediately in-process
    await triggerAutomationProtocols('TAG_ADDED', payload, { sync: true });
    console.log('>>> [SIMULATE] triggerAutomationProtocols call finished successfully.');
  } catch (err) {
    console.error('>>> [SIMULATE] triggerAutomationProtocols thrown error:', err);
  }
}

simulate().catch(console.error);
