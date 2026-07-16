import { adminDb } from '../src/lib/firebase-admin';
import { triggerAutomationProtocols } from '../src/lib/automations/orchestrator';

async function backfill() {
  console.log('>>> [BACKFILL] Starting backfill process...');

  // 1. BACKFILL FOR CAMPAIGN AUTOMATION ([Sequence] Enrollment Masterclass Automation)
  const campaignTagId = 'rnvuZGtjuO70YGlUqEup';
  const campaignAutomationId = 'MCs1nHdHK7AgcffzX6w0';
  
  console.log('>>> [CAMPAIGN] Fetching tagged contacts...');
  const campaignContactsSnap = await adminDb.collection('workspace_entities')
    .where('workspaceTags', 'array-contains', campaignTagId)
    .get();

  const campaignContacts: Array<{ docId: string; entityId: string }> = [];
  campaignContactsSnap.forEach((doc) => {
    const data = doc.data();
    campaignContacts.push({
      docId: doc.id,
      entityId: data.entityId || doc.id,
    });
  });

  console.log('>>> [CAMPAIGN] Fetching current runs...');
  const campaignRunsSnap = await adminDb.collection('automation_runs')
    .where('automationId', '==', campaignAutomationId)
    .get();

  const campaignRunIds = new Set<string>();
  campaignRunsSnap.forEach((doc) => {
    campaignRunIds.add(doc.data().entityId);
  });

  const missingCampaign = campaignContacts.filter(c => !campaignRunIds.has(c.entityId));
  console.log(`>>> [CAMPAIGN] Found ${missingCampaign.length} missing contacts.`);

  // 2. BACKFILL FOR TEST AUTOMATION (Test Automation)
  const testTagId = 'bJVxfxXRaNbrMBaPRuFS';
  const testAutomationId = 'wLraN52eC3zBaYuGQfKH';

  console.log('>>> [TEST] Fetching tagged contacts...');
  const testContactsSnap = await adminDb.collection('workspace_entities')
    .where('workspaceTags', 'array-contains', testTagId)
    .get();

  const testContacts: Array<{ docId: string; entityId: string }> = [];
  testContactsSnap.forEach((doc) => {
    const data = doc.data();
    testContacts.push({
      docId: doc.id,
      entityId: data.entityId || doc.id,
    });
  });

  console.log('>>> [TEST] Fetching current runs...');
  const testRunsSnap = await adminDb.collection('automation_runs')
    .where('automationId', '==', testAutomationId)
    .get();

  const testRunIds = new Set<string>();
  testRunsSnap.forEach((doc) => {
    testRunIds.add(doc.data().entityId);
  });

  const missingTest = testContacts.filter(c => !testRunIds.has(c.entityId));
  console.log(`>>> [TEST] Found ${missingTest.length} missing contacts.`);

  // 3. EXECUTE BACKFILL FOR CAMPAIGN AUTOMATION
  if (missingCampaign.length > 0) {
    console.log(`>>> [CAMPAIGN] Triggering enrollment for ${missingCampaign.length} contacts...`);
    let processed = 0;
    const chunkSize = 10;
    for (let i = 0; i < missingCampaign.length; i += chunkSize) {
      const chunk = missingCampaign.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (item) => {
          const docSnap = await adminDb.collection('workspace_entities').doc(item.docId).get();
          if (!docSnap.exists) return;
          const data = docSnap.data()!;
          const payload = {
            workspaceId: 'prospect',
            organizationId: data.organizationId || 'smartsapp-hq',
            entityId: item.entityId,
            entityType: data.entityType || 'institution',
            tagId: campaignTagId,
            tagName: '[Campaign] Enrollment Masterclass',
            _firingTrigger: 'TAG_ADDED',
          };
          try {
            await triggerAutomationProtocols('TAG_ADDED', payload, { sync: true });
            processed++;
          } catch (err) {
            console.error(`Failed to trigger campaign automation for ${item.entityId}:`, err);
          }
        })
      );
      console.log(`>>> [CAMPAIGN] Processed ${processed}/${missingCampaign.length} runs...`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  // 4. EXECUTE BACKFILL FOR TEST AUTOMATION
  if (missingTest.length > 0) {
    console.log(`>>> [TEST] Triggering enrollment for ${missingTest.length} contacts...`);
    let processed = 0;
    const chunkSize = 10;
    for (let i = 0; i < missingTest.length; i += chunkSize) {
      const chunk = missingTest.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (item) => {
          const docSnap = await adminDb.collection('workspace_entities').doc(item.docId).get();
          if (!docSnap.exists) return;
          const data = docSnap.data()!;
          const payload = {
            workspaceId: 'prospect',
            organizationId: data.organizationId || 'smartsapp-hq',
            entityId: item.entityId,
            entityType: data.entityType || 'institution',
            tagId: testTagId,
            tagName: '[Automation] Test Contacts',
            _firingTrigger: 'TAG_ADDED',
          };
          try {
            await triggerAutomationProtocols('TAG_ADDED', payload, { sync: true });
            processed++;
          } catch (err) {
            console.error(`Failed to trigger test automation for ${item.entityId}:`, err);
          }
        })
      );
      console.log(`>>> [TEST] Processed ${processed}/${missingTest.length} runs...`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  console.log('>>> [BACKFILL] Completed successfully.');
}

backfill().catch(console.error);
