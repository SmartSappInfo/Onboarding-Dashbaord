const fs = require('fs');
const file = 'src/lib/services/call-centre-service.ts';
let content = fs.readFileSync(file, 'utf-8');

const newMethod = `
  static async enqueueAndLockSingleCall(
    campaignId: string,
    entityId: string,
    workspaceId: string,
    userId: string,
    contactContext?: { contactId?: string; contactName?: string; phone?: string; email?: string }
  ): Promise<{ success: boolean; queueItem?: any; error?: string }> {
    try {
      const campaignRef = adminDb.collection('call_campaigns').doc(campaignId);
      const campaignSnap = await campaignRef.get();
      if (!campaignSnap.exists) {
        return { success: false, error: 'Campaign not found' };
      }
      const campaign = campaignSnap.data();

      // Fetch entity data
      const entitySnap = await adminDb.collection('workspace_entities')
        .where('entityId', '==', entityId)
        .where('workspaceId', '==', workspaceId)
        .limit(1)
        .get();
        
      if (entitySnap.empty) {
        return { success: false, error: 'Entity not found in workspace' };
      }
      
      const entityData = entitySnap.docs[0].data();
      const timestamp = new Date().toISOString();
      const lockExpiresAt = new Date(Date.now() + 15 * 60000).toISOString(); // 15 mins lock
      
      let targetContactId = contactContext?.contactId;
      let targetName = contactContext?.contactName;
      let targetPhone = contactContext?.phone;
      let targetEmail = contactContext?.email;
      let targetRole = 'Contact';
      
      if (!targetContactId) {
        const contacts = (entityData.entityContacts || []);
        const primary = contacts.find(c => c.isPrimary) || contacts[0];
        if (primary) {
          targetContactId = primary.id;
          targetName = primary.name || \`\${primary.firstName || ''} \${primary.lastName || ''}\`.trim();
          targetPhone = primary.phone || primary.phoneNumber;
          targetEmail = primary.email || primary.emailAddress;
          targetRole = primary.typeLabel || primary.typeKey || (primary.isPrimary ? 'Primary' : 'Contact');
        } else {
          // Fallback to entity level
          targetName = entityData.displayName;
          targetPhone = entityData.phone;
          targetEmail = entityData.email;
          targetRole = 'Primary Entity';
        }
      }
      
      // Use a random ID or explicit ID for the manual item. 
      // Manual enrolment might happen multiple times, so we don't strictly use campaignId_entityId_contactId
      const queueItemId = adminDb.collection('call_queue_items').doc().id;
      
      const queueItem = {
        id: queueItemId,
        campaignId,
        organizationId: campaign.organizationId,
        workspaceId: campaign.workspaceId,
        entityId,
        entityType: entityData.entityType || 'person',
        entityName: entityData.displayName || 'Unknown Entity',
        entityPhone: entityData.phone || targetPhone || '',
        entityEmail: entityData.email || targetEmail || '',
        contactId: targetContactId || undefined,
        contactName: targetName,
        contactRole: targetRole,
        status: 'in_progress', // Start immediately
        assignedTo: userId,
        lockExpiresAt,
        callbackDate: null,
        attempts: 1, // Considered the first attempt right now
        lastAttemptAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        isManualEnrolment: true
      };
      
      await adminDb.collection('call_queue_items').doc(queueItemId).set(queueItem);
      
      // We do not bump campaign.progress.total here because it's a manual override, 
      // but you can if you want it to reflect in the UI. We leave it out to not skew audience sizes.
      
      return { success: true, queueItem };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
`;

if (!content.includes('enqueueAndLockSingleCall(')) {
  content = content.replace(
    '  static async addContactsToCampaign(',
    newMethod + '\n  static async addContactsToCampaign('
  );
  fs.writeFileSync(file, content);
}
