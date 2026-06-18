import { adminDb, FieldValue } from '../firebase-admin';
import type { 
  CallScript, 
  CallCampaign, 
  CallQueueItem
} from '../types';
import { previewCampaignAudience, resolveRecipientContacts } from '../messaging-actions';
import { updateEntityAction } from '../entity-actions';
import { applyTagsAction } from '../tag-actions';
import { createTaskAction } from '../task-server-actions';
import { sendSms } from '../mnotify-service';
import { sendEmail } from '../resend-service';
import { logActivity } from '../activity-logger';
import { after } from 'next/server';

export class CallCentreService {
  // ─── Call Scripts ──────────────────────────────────────────────────────────

  static async createScript(data: Omit<CallScript, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const timestamp = new Date().toISOString();
    const docRef = await adminDb.collection('call_scripts').add({
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return docRef.id;
  }

  static async updateScript(id: string, data: Partial<CallScript>): Promise<void> {
    const timestamp = new Date().toISOString();
    await adminDb.collection('call_scripts').doc(id).update({
      ...data,
      updatedAt: timestamp,
    });
  }

  static async deleteScript(id: string): Promise<void> {
    const campaignsSnap = await adminDb.collection('call_campaigns')
      .where('scriptId', '==', id)
      .get();
    if (!campaignsSnap.empty) {
      const campaignNames = campaignsSnap.docs.map(doc => doc.data().name).join(', ');
      throw new Error(`Cannot delete script because it is referenced by campaign(s): ${campaignNames}`);
    }
    await adminDb.collection('call_scripts').doc(id).delete();
  }

  static async getScript(id: string): Promise<CallScript | null> {
    const doc = await adminDb.collection('call_scripts').doc(id).get();
    return doc.exists ? (doc.data() as CallScript) : null;
  }

  static async listScripts(workspaceId: string): Promise<CallScript[]> {
    const snap = await adminDb.collection('call_scripts')
      .where('workspaceId', '==', workspaceId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CallScript));
  }

  // ─── Call Campaigns ────────────────────────────────────────────────────────

  static async createCampaign(data: Omit<CallCampaign, 'id' | 'createdAt' | 'updatedAt' | 'progress'>): Promise<string> {
    const timestamp = new Date().toISOString();
    const docRef = await adminDb.collection('call_campaigns').add({
      ...data,
      status: 'draft',
      progress: {
        total: 0,
        completed: 0,
        pending: 0,
        skipped: 0,
        callbacks: 0,
        deferred: 0,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return docRef.id;
  }

  static async updateCampaign(id: string, data: Partial<CallCampaign>): Promise<void> {
    const timestamp = new Date().toISOString();
    await adminDb.collection('call_campaigns').doc(id).update({
      ...data,
      updatedAt: timestamp,
    });
  }

  static async cloneCampaign(campaignId: string, userId: string): Promise<string> {
    const timestamp = new Date().toISOString();
    const sourceRef = adminDb.collection('call_campaigns').doc(campaignId);
    const sourceSnap = await sourceRef.get();
    if (!sourceSnap.exists) {
      throw new Error('Campaign not found');
    }
    const campaign = sourceSnap.data() as CallCampaign;
    const isFixed = campaign.allowAddContactsAfterLaunch === false;

    // Build copy definition
    const copyData: Omit<CallCampaign, 'id' | 'createdAt' | 'updatedAt'> = {
      organizationId: campaign.organizationId,
      workspaceId: campaign.workspaceId,
      name: `${campaign.name} (Copy)`,
      description: campaign.description || '',
      scriptId: campaign.scriptId,
      scriptSnapshot: campaign.scriptSnapshot || '',
      audienceDefinition: {
        ...campaign.audienceDefinition,
        // If fixed audience, clear out specific manual selections for the clone
        selectedContacts: isFixed ? [] : (campaign.audienceDefinition?.selectedContacts || []),
      },
      outcomes: campaign.outcomes || [],
      automationRules: campaign.automationRules || {},
      status: 'draft',
      allowAddContactsAfterLaunch: campaign.allowAddContactsAfterLaunch ?? false,
      progress: {
        total: 0,
        completed: 0,
        pending: 0,
        skipped: 0,
        callbacks: 0,
        deferred: 0,
      },
      createdBy: userId,
    };

    const docRef = await adminDb.collection('call_campaigns').add({
      ...copyData,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return docRef.id;
  }

  static async archiveCampaign(campaignId: string): Promise<void> {
    const timestamp = new Date().toISOString();
    await adminDb.collection('call_campaigns').doc(campaignId).update({
      status: 'archived',
      updatedAt: timestamp,
    });
  }

  static async endCampaign(campaignId: string): Promise<void> {
    const timestamp = new Date().toISOString();
    await adminDb.collection('call_campaigns').doc(campaignId).update({
      status: 'completed',
      updatedAt: timestamp,
    });
  }

  static async addContactsToCampaign(
    campaignId: string,
    entityIds: string[],
    workspaceId: string
  ): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const campaignRef = adminDb.collection('call_campaigns').doc(campaignId);
      const campaignSnap = await campaignRef.get();
      if (!campaignSnap.exists) {
        return { success: false, count: 0, error: 'Campaign not found' };
      }
      const campaign = campaignSnap.data() as CallCampaign;

      // Filter out entityIds that are already in call_queue_items for this campaign
      const filteredEntityIds: string[] = [];
      const batchCheckLimit = 30; // Firestore "in" queries can have at most 30 items
      for (let i = 0; i < entityIds.length; i += batchCheckLimit) {
        const chunk = entityIds.slice(i, i + batchCheckLimit);
        const docsToCheck = chunk.map(eid => `${campaignId}_${eid}`);
        const snaps = await adminDb.collection('call_queue_items')
          .where('__name__', 'in', docsToCheck)
          .get();
        const existingIds = new Set(snaps.docs.map(doc => doc.id.substring(campaignId.length + 1)));
        for (const eid of chunk) {
          if (!existingIds.has(eid)) {
            filteredEntityIds.push(eid);
          }
        }
      }

      if (filteredEntityIds.length === 0) {
        return { success: true, count: 0 };
      }

      const timestamp = new Date().toISOString();
      const queueItems: Omit<CallQueueItem, 'id'>[] = [];

      // Query entity documents to get details (e.g. name, type)
      const entitiesData: Record<string, { name: string; entityType: string }> = {};
      for (let i = 0; i < filteredEntityIds.length; i += batchCheckLimit) {
        const chunk = filteredEntityIds.slice(i, i + batchCheckLimit);
        const snaps = await adminDb.collection('workspace_entities')
          .where('entityId', 'in', chunk)
          .where('workspaceId', '==', workspaceId)
          .get();
        snaps.forEach(doc => {
          const data = doc.data();
          entitiesData[data.entityId] = {
            name: data.displayName || 'Unknown Contact',
            entityType: data.entityType || 'person',
          };
        });
      }

      for (const entityId of filteredEntityIds) {
        const entityMeta = entitiesData[entityId] || { name: 'Unknown Contact', entityType: 'person' };
        let phone = '';
        let email = '';

        const [smsResolved, emailResolved] = await Promise.all([
          resolveRecipientContacts({
            entityId,
            workspaceId,
            contactScope: campaign.audienceDefinition?.contactScope || 'primary',
            channel: 'sms',
          }).catch(() => []),
          resolveRecipientContacts({
            entityId,
            workspaceId,
            contactScope: campaign.audienceDefinition?.contactScope || 'primary',
            channel: 'email',
          }).catch(() => []),
        ]);

        if (smsResolved && smsResolved.length > 0) {
          phone = smsResolved[0].contact;
        }
        if (emailResolved && emailResolved.length > 0) {
          email = emailResolved[0].contact;
        }

        queueItems.push({
          campaignId,
          organizationId: campaign.organizationId,
          workspaceId: campaign.workspaceId,
          entityId,
          entityType: entityMeta.entityType as any,
          entityName: entityMeta.name,
          entityPhone: phone,
          entityEmail: email,
          status: 'scheduled',
          assignedTo: null,
          lockExpiresAt: null,
          callbackDate: null,
          attempts: 0,
          lastAttemptAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      // Write queue items in batches of 500
      const writeChunks: Promise<any>[] = [];
      let writeBatch = adminDb.batch();
      let writeCount = 0;

      for (const item of queueItems) {
        const itemRef = adminDb.collection('call_queue_items').doc(`${campaignId}_${item.entityId}`);
        writeBatch.set(itemRef, {
          id: itemRef.id,
          ...item,
        });
        writeCount++;
        if (writeCount === 500) {
          writeChunks.push(writeBatch.commit());
          writeBatch = adminDb.batch();
          writeCount = 0;
        }
      }
      if (writeCount > 0) {
        writeChunks.push(writeBatch.commit());
      }
      await Promise.all(writeChunks);

      // Increment campaign stats and reset status back to running if it was completed
      const updateFields: Record<string, any> = {
        'progress.total': FieldValue.increment(queueItems.length),
        'progress.pending': FieldValue.increment(queueItems.length),
        updatedAt: timestamp,
      };

      if (campaign.status === 'completed') {
        updateFields.status = 'running';
      }

      await campaignRef.update(updateFields);

      return { success: true, count: queueItems.length };
    } catch (error: any) {
      console.error('[CALL_CENTRE_SERVICE] Dynamic contact addition failed:', error);
      return { success: false, count: 0, error: error.message };
    }
  }

  static async getCampaign(id: string): Promise<CallCampaign | null> {
    const doc = await adminDb.collection('call_campaigns').doc(id).get();
    return doc.exists ? (doc.data() as CallCampaign) : null;
  }

  static async listCampaigns(workspaceId: string): Promise<CallCampaign[]> {
    const snap = await adminDb.collection('call_campaigns')
      .where('workspaceId', '==', workspaceId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CallCampaign));
  }

  static async deleteCampaign(id: string): Promise<void> {
    await adminDb.collection('call_campaigns').doc(id).delete();
    const qSnap = await adminDb.collection('call_queue_items')
      .where('campaignId', '==', id)
      .get();
    const deleteChunks: Promise<any>[] = [];
    let deleteBatch = adminDb.batch();
    let deleteCount = 0;
    qSnap.forEach((doc) => {
      deleteBatch.delete(doc.ref);
      deleteCount++;
      if (deleteCount === 500) {
        deleteChunks.push(deleteBatch.commit());
        deleteBatch = adminDb.batch();
        deleteCount = 0;
      }
    });
    if (deleteCount > 0) {
      deleteChunks.push(deleteBatch.commit());
    }
    await Promise.all(deleteChunks);
  }

  // ─── Queue Generation & Snapshots ──────────────────────────────────────────

  static async generateCampaignQueue(campaignId: string): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const campaignRef = adminDb.collection('call_campaigns').doc(campaignId);
      const campaignSnap = await campaignRef.get();
      if (!campaignSnap.exists) {
        return { success: false, count: 0, error: 'Campaign not found' };
      }

      const campaign = campaignSnap.data() as CallCampaign;
      if (!campaign.scriptId) {
        return { success: false, count: 0, error: 'Campaign cannot be launched without an assigned script playbook.' };
      }

      const audienceResult = await previewCampaignAudience({
        workspaceId: campaign.workspaceId,
        filters: campaign.audienceDefinition?.filters as any,
        filterLogic: campaign.audienceDefinition?.filterLogic,
        includeTagIds: campaign.audienceDefinition?.tagIds,
        excludeTagIds: campaign.audienceDefinition?.excludeTagIds,
        includeLogic: campaign.audienceDefinition?.tagLogic === 'all' ? 'AND' : 'OR',
        selectedContacts: campaign.audienceDefinition?.selectedContacts,
        audienceMode: campaign.audienceDefinition?.mode,
        channel: 'call',
        limit: 5000,
      });

      if (!audienceResult.success || !audienceResult.preview) {
        return { success: false, count: 0, error: audienceResult.error || 'Audience resolution failed' };
      }

      const entities = audienceResult.preview;
      if (entities.length === 0) {
        return { success: false, count: 0, error: 'No contacts match the audience definition' };
      }

      // 2. Clear existing queue items for this campaign (if any)
      const existingQueueSnap = await adminDb.collection('call_queue_items')
        .where('campaignId', '==', campaignId)
        .get();

      const deleteChunks: Promise<any>[] = [];
      let deleteBatch = adminDb.batch();
      let deleteCount = 0;

      existingQueueSnap.forEach((doc) => {
        deleteBatch.delete(doc.ref);
        deleteCount++;
        if (deleteCount === 500) {
          deleteChunks.push(deleteBatch.commit());
          deleteBatch = adminDb.batch();
          deleteCount = 0;
        }
      });
      if (deleteCount > 0) {
        deleteChunks.push(deleteBatch.commit());
      }
      await Promise.all(deleteChunks);

      // 3. Resolve phone/email and generate new queue items
      const timestamp = new Date().toISOString();
      const queueItems: Omit<CallQueueItem, 'id'>[] = [];

      for (const entity of entities) {
        let phone = '';
        let email = '';

        const [smsResolved, emailResolved] = await Promise.all([
          resolveRecipientContacts({
            entityId: entity.id,
            workspaceId: campaign.workspaceId,
            contactScope: campaign.audienceDefinition?.contactScope || 'primary',
            channel: 'sms',
          }).catch(() => []),
          resolveRecipientContacts({
            entityId: entity.id,
            workspaceId: campaign.workspaceId,
            contactScope: campaign.audienceDefinition?.contactScope || 'primary',
            channel: 'email',
          }).catch(() => []),
        ]);

        if (smsResolved && smsResolved.length > 0) {
          phone = smsResolved[0].contact;
        }
        if (emailResolved && emailResolved.length > 0) {
          email = emailResolved[0].contact;
        }

        queueItems.push({
          campaignId,
          organizationId: campaign.organizationId,
          workspaceId: campaign.workspaceId,
          entityId: entity.id,
          entityType: ((entity as any).entityType || 'person') as any,
          entityName: entity.name || 'Unknown Contact',
          entityPhone: phone,
          entityEmail: email,
          status: 'scheduled',
          assignedTo: null,
          lockExpiresAt: null,
          callbackDate: null,
          attempts: 0,
          lastAttemptAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      // Write queue items in batches of 500
      const writeChunks: Promise<any>[] = [];
      let writeBatch = adminDb.batch();
      let writeCount = 0;

      for (const item of queueItems) {
        const itemRef = adminDb.collection('call_queue_items').doc(`${campaignId}_${item.entityId}`);
        writeBatch.set(itemRef, {
          id: itemRef.id,
          ...item,
        });
        writeCount++;
        if (writeCount === 500) {
          writeChunks.push(writeBatch.commit());
          writeBatch = adminDb.batch();
          writeCount = 0;
        }
      }
      if (writeCount > 0) {
        writeChunks.push(writeBatch.commit());
      }
      await Promise.all(writeChunks);

      // 4. Update campaign status and progress statistics
      await campaignRef.update({
        status: 'running',
        'progress.total': queueItems.length,
        'progress.pending': queueItems.length,
        'progress.completed': 0,
        'progress.skipped': 0,
        'progress.callbacks': 0,
        'progress.deferred': 0,
        updatedAt: timestamp,
      });

      return { success: true, count: queueItems.length };
    } catch (error: any) {
      console.error('[CALL_CENTRE_SERVICE] Queue generation failed:', error);
      return { success: false, count: 0, error: error.message };
    }
  }

  // ─── Queue Locking Mechanism ──────────────────────────────────────────────

  static async lockQueueItem(queueItemId: string, agentId: string): Promise<{ success: boolean; lockExpiresAt?: string; error?: string }> {
    try {
      const lockRef = adminDb.collection('call_queue_items').doc(queueItemId);
      const result = await adminDb.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(lockRef);
        if (!docSnap.exists) {
          throw new Error('Queue item not found');
        }

        const data = docSnap.data() as CallQueueItem;
        const now = new Date();

        // If locked by someone else and lock has not expired
        if (data.assignedTo && data.assignedTo !== agentId && data.lockExpiresAt) {
          const expiresAt = new Date(data.lockExpiresAt);
          if (expiresAt > now) {
            return { success: false, error: `Locked by another agent until ${expiresAt.toLocaleTimeString()}` };
          }
        }

        // Apply new lock (expires in 5 minutes)
        const expiry = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
        transaction.update(lockRef, {
          assignedTo: agentId,
          lockExpiresAt: expiry,
          status: data.status === 'scheduled' ? 'in_progress' : data.status,
          updatedAt: now.toISOString(),
        });

        return { success: true, lockExpiresAt: expiry };
      });

      return result;
    } catch (error: any) {
      console.error('[CALL_CENTRE_SERVICE] Lock failed:', error);
      return { success: false, error: error.message };
    }
  }

  static async releaseQueueItem(queueItemId: string, agentId: string): Promise<void> {
    const lockRef = adminDb.collection('call_queue_items').doc(queueItemId);
    await adminDb.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(lockRef);
      if (docSnap.exists) {
        const data = docSnap.data() as CallQueueItem;
        if (data.assignedTo === agentId) {
          transaction.update(lockRef, {
            assignedTo: null,
            lockExpiresAt: null,
            status: data.status === 'in_progress' ? 'scheduled' : data.status,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    });
  }

  // ─── Outcomes and Automations ──────────────────────────────────────────────

  static async submitOutcome(params: {
    queueItemId: string;
    outcome: string;
    notes: string;
    duration: number; // in seconds
    agentId: string;
    agentName: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { queueItemId, outcome, notes, duration, agentId, agentName } = params;
    const timestamp = new Date().toISOString();

    try {
      const itemRef = adminDb.collection('call_queue_items').doc(queueItemId);
      
      const transactionResult = await adminDb.runTransaction(async (transaction) => {
        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists) {
          throw new Error('Queue item not found');
        }

        const data = itemSnap.data() as CallQueueItem;
        
        // Update item status
        transaction.update(itemRef, {
          status: 'completed',
          outcome,
          duration,
          assignedTo: null,
          lockExpiresAt: null,
          attempts: (data.attempts || 0) + 1,
          lastAttemptAt: timestamp,
          notesDraft: notes,
          updatedAt: timestamp,
        });

        return { campaignId: data.campaignId, entityId: data.entityId, entityType: data.entityType, entityName: data.entityName, organizationId: data.organizationId, workspaceId: data.workspaceId };
      });

      const { campaignId, entityId, entityType, organizationId, workspaceId } = transactionResult;

      // 1. Log Activity on the Entity Timeline (Standard CRM logging)
      await logActivity({
        organizationId,
        workspaceId,
        entityId,
        entityType,
        userId: agentId,
        type: 'call_completed',
        source: 'call_campaign',
        description: `completed a campaign call. Outcome: "${outcome}"`,
        metadata: {
          campaignId,
          outcome,
          duration,
          notes,
          agentName,
        }
      });

      // 2. Trigger Post-Call Automations using Next.js after() to keep UX non-blocking
      try {
        after(async () => {
          await this.executeCampaignAutomations({
            campaignId,
            entityId,
            outcome,
            userId: agentId,
            workspaceId,
            organizationId,
          });
        });
      } catch {
        // Fallback for non-after runtimes (tests)
        Promise.resolve().then(() => this.executeCampaignAutomations({
          campaignId,
          entityId,
          outcome,
          userId: agentId,
          workspaceId,
          organizationId,
        })).catch(err => console.error('[CALL_CENTRE_SERVICE] Fallback automations run failed:', err));
      }

      // 3. Recalculate campaign progress stats
      await this.recalculateCampaignProgress(campaignId);

      return { success: true };
    } catch (error: any) {
      console.error('[CALL_CENTRE_SERVICE] Submit outcome failed:', error);
      return { success: false, error: error.message };
    }
  }

  static async updateNotesDraft(queueItemId: string, notes: string): Promise<void> {
    await adminDb.collection('call_queue_items').doc(queueItemId).update({
      notesDraft: notes,
      updatedAt: new Date().toISOString(),
    });
  }

  static async skipQueueItem(queueItemId: string): Promise<void> {
    const itemRef = adminDb.collection('call_queue_items').doc(queueItemId);
    const itemSnap = await itemRef.get();
    if (itemSnap.exists) {
      const data = itemSnap.data() as CallQueueItem;
      await itemRef.update({
        status: 'skipped',
        assignedTo: null,
        lockExpiresAt: null,
        updatedAt: new Date().toISOString(),
      });
      await this.recalculateCampaignProgress(data.campaignId);
    }
  }

  static async deferQueueItem(queueItemId: string): Promise<void> {
    const itemRef = adminDb.collection('call_queue_items').doc(queueItemId);
    const itemSnap = await itemRef.get();
    if (itemSnap.exists) {
      const data = itemSnap.data() as CallQueueItem;
      await itemRef.update({
        status: 'deferred',
        assignedTo: null,
        lockExpiresAt: null,
        updatedAt: new Date().toISOString(),
      });
      await this.recalculateCampaignProgress(data.campaignId);
    }
  }

  static async scheduleCallback(queueItemId: string, callbackDate: string): Promise<void> {
    const itemRef = adminDb.collection('call_queue_items').doc(queueItemId);
    const itemSnap = await itemRef.get();
    if (itemSnap.exists) {
      const data = itemSnap.data() as CallQueueItem;
      await itemRef.update({
        status: 'callback_scheduled',
        callbackDate,
        assignedTo: null,
        lockExpiresAt: null,
        updatedAt: new Date().toISOString(),
      });
      await this.recalculateCampaignProgress(data.campaignId);
    }
  }

  // ─── Recalculate Stats ─────────────────────────────────────────────────────

  static async recalculateCampaignProgress(campaignId: string): Promise<void> {
    const snap = await adminDb.collection('call_queue_items')
      .where('campaignId', '==', campaignId)
      .get();

    let total = snap.size;
    let completed = 0;
    let pending = 0;
    let skipped = 0;
    let callbacks = 0;
    let deferred = 0;

    snap.forEach(doc => {
      const data = doc.data() as CallQueueItem;
      if (data.status === 'completed') completed++;
      else if (data.status === 'skipped') skipped++;
      else if (data.status === 'callback_scheduled') callbacks++;
      else if (data.status === 'deferred') deferred++;
      else pending++;
    });

    const isFinished = total > 0 && (completed + skipped) === total;

    await adminDb.collection('call_campaigns').doc(campaignId).update({
      progress: {
        total,
        completed,
        pending,
        skipped,
        callbacks,
        deferred,
      },
      status: isFinished ? 'completed' : 'running',
      updatedAt: new Date().toISOString(),
    });
  }

  // ─── Execute Post-Call Actions ─────────────────────────────────────────────

  private static async executeCampaignAutomations(params: {
    campaignId: string;
    entityId: string;
    outcome: string;
    userId: string;
    workspaceId: string;
    organizationId: string;
  }): Promise<void> {
    const { campaignId, entityId, outcome, userId, workspaceId, organizationId } = params;

    try {
      const campaignSnap = await adminDb.collection('call_campaigns').doc(campaignId).get();
      if (!campaignSnap.exists) return;

      const campaign = campaignSnap.data() as CallCampaign;
      const rules = campaign.automationRules?.[outcome] || [];

      console.log(`>>> [CALL_CENTRE_SERVICE] Running ${rules.length} automations for outcome "${outcome}" on Entity: ${entityId}`);

      for (const rule of rules) {
        try {
          switch (rule.type) {
            case 'CHANGE_STAGE': {
              if (rule.params.stageId) {
                // Fetch stage name for currentStageName denormalization
                const stageSnap = await adminDb.collection('onboardingStages').doc(rule.params.stageId).get();
                const currentStageName = stageSnap.exists ? stageSnap.data()?.name || 'Unknown' : 'Unknown';
                
                await updateEntityAction(
                  entityId,
                  { stageId: rule.params.stageId, currentStageName },
                  `system-call-centre:${userId}`,
                  workspaceId,
                  organizationId
                );
              }
              break;
            }

            case 'ADD_TAG': {
              if (rule.params.tagId) {
                await applyTagsAction(
                  entityId,
                  'entity',
                  [rule.params.tagId],
                  `system-call-centre:${userId}`
                );
              }
              break;
            }

            case 'CREATE_TASK': {
              if (rule.params.taskTitle) {
                await createTaskAction({
                  organizationId,
                  workspaceId,
                  title: rule.params.taskTitle,
                  description: 'Call campaign automation generated follow-up task.',
                  priority: rule.params.taskPriority || 'medium',
                  status: 'todo',
                  category: 'call_follow_up' as any,
                  assignedTo: userId,
                  entityId,
                  entityType: 'person' as any,
                  dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // + 2 days default
                  reminders: [],
                  reminderSent: false,
                }, `system-call-centre:${userId}`);
              }
              break;
            }

            case 'SEND_SMS': {
              if (rule.params.templateId) {
                const templateSnap = await adminDb.collection('message_templates').doc(rule.params.templateId).get();
                if (templateSnap.exists) {
                  const body = templateSnap.data()?.body || '';
                  
                  // Fetch contact to obtain phone number
                  const contactSnap = await adminDb.collection('entities').doc(entityId).get();
                  let phone = '';
                  if (contactSnap.exists) {
                    const contactsList = contactSnap.data()?.entityContacts || [];
                    const primary = contactsList.find((c: any) => c.isPrimary) || contactsList[0];
                    phone = primary?.phone || '';
                  }

                  if (phone) {
                    await sendSms({
                      recipient: phone,
                      message: body,
                      sender: 'SMARTSAPP',
                    });
                  }
                }
              }
              break;
            }

            case 'SEND_EMAIL': {
              if (rule.params.templateId) {
                const templateSnap = await adminDb.collection('message_templates').doc(rule.params.templateId).get();
                if (templateSnap.exists) {
                  const subject = templateSnap.data()?.subject || 'Outreach Follow Up';
                  const html = templateSnap.data()?.body || '';

                  // Fetch contact to obtain email
                  const contactSnap = await adminDb.collection('entities').doc(entityId).get();
                  let email = '';
                  if (contactSnap.exists) {
                    const contactsList = contactSnap.data()?.entityContacts || [];
                    const primary = contactsList.find((c: any) => c.isPrimary) || contactsList[0];
                    email = primary?.email || '';
                  }

                  if (email) {
                    await sendEmail({
                      to: email,
                      subject,
                      html,
                    });
                  }
                }
              }
              break;
            }
          }
        } catch (ruleErr: any) {
          console.error(`>>> [CALL_CENTRE_SERVICE] Automation rule execution failed for rule type ${rule.type}:`, ruleErr.message);
        }
      }
    } catch (err: any) {
      console.error('[CALL_CENTRE_SERVICE] Campaign automations lookup failed:', err.message);
    }
  }
}
