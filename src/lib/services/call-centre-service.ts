import { adminDb, FieldValue } from '../firebase-admin';
import type {
  CallScript,
  CallCampaign,
  CallQueueItem,
  CallActionType,
  CallActionParams,
  EntityContact,
  Workspace
} from '../types';
import { previewCampaignAudience, resolveRecipientContacts } from '../messaging-actions';
import { updateEntityAction } from '../entity-actions';
import { applyTagsAction, removeTagsAction } from '../tag-actions';
import { MEETING_TYPES } from '../types';
import { parseGraph, getOutcomeAutomations, resolveScriptVariables } from '../call-centre-graph';
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

    if (data.content !== undefined) {
      const campaignsSnap = await adminDb.collection('call_campaigns')
        .where('scriptId', '==', id)
        .get();

      if (!campaignsSnap.empty) {
        const batchLimit = 500;
        let batch = adminDb.batch();
        let count = 0;

        for (const campaignDoc of campaignsSnap.docs) {
          const campaignData = campaignDoc.data() as CallCampaign;
          if (campaignData.status !== 'completed' && campaignData.status !== 'archived') {
            batch.update(campaignDoc.ref, {
              scriptSnapshot: data.content,
              updatedAt: timestamp,
            });
            count++;

            if (count === batchLimit) {
              await batch.commit();
              batch = adminDb.batch();
              count = 0;
            }
          }
        }

        if (count > 0) {
          await batch.commit();
        }
      }
    }
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
    workspaceId: string,
    userId: string,
    contactOverrides?: { entityId: string; contactId: string; contactName: string; phone: string; email: string }[],
    contactScope?: 'primary' | 'signatories' | 'all'
  ): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const campaignRef = adminDb.collection('call_campaigns').doc(campaignId);
      const campaignSnap = await campaignRef.get();
      if (!campaignSnap.exists) {
        return { success: false, count: 0, error: 'Campaign not found' };
      }
      const campaign = campaignSnap.data() as CallCampaign;

      const timestamp = new Date().toISOString();
      const queueItems: Omit<CallQueueItem, 'id'>[] = [];
      const batchCheckLimit = 30;

      // ─── PATH A: contactOverrides provided — use explicit contact data ─────────
      if (contactOverrides && contactOverrides.length > 0) {
        // Build doc IDs to check for deduplication
        const docsToCheck = contactOverrides.map(o => `${campaignId}_${o.entityId}_${o.contactId}`);
        const existingDocIds = new Set<string>();
        for (let i = 0; i < docsToCheck.length; i += batchCheckLimit) {
          const chunk = docsToCheck.slice(i, i + batchCheckLimit);
          const snaps = await adminDb.collection('call_queue_items')
            .where('__name__', 'in', chunk)
            .get();
          snaps.docs.forEach(doc => existingDocIds.add(doc.id));
        }

        // Look up entity metadata (name, type) for all unique entityIds
        const uniqueEntityIds = [...new Set(contactOverrides.map(o => o.entityId))];
        const entitiesData: Record<
          string,
          {
            name: string;
            entityType: string;
            entityContacts: { id: string; typeLabel?: string; typeKey?: string; isPrimary?: boolean; isSignatory?: boolean }[];
          }
        > = {};
        for (let i = 0; i < uniqueEntityIds.length; i += batchCheckLimit) {
          const chunk = uniqueEntityIds.slice(i, i + batchCheckLimit);
          const snaps = await adminDb.collection('workspace_entities')
            .where('entityId', 'in', chunk)
            .where('workspaceId', '==', workspaceId)
            .get();
          snaps.forEach(doc => {
            const data = doc.data();
            entitiesData[data.entityId] = {
              name: data.displayName || 'Unknown Entity',
              entityType: data.entityType || 'person',
              entityContacts: (data.entityContacts || []) as { id: string; typeLabel?: string; typeKey?: string; isPrimary?: boolean; isSignatory?: boolean }[],
            };
          });
        }

        for (const override of contactOverrides) {
          const docId = `${campaignId}_${override.entityId}_${override.contactId}`;
          if (existingDocIds.has(docId)) continue; // skip duplicates
          const entityMeta = entitiesData[override.entityId] || {
            name: 'Unknown Entity',
            entityType: 'person',
            entityContacts: [] as { id: string; typeLabel?: string; typeKey?: string; isPrimary?: boolean; isSignatory?: boolean }[]
          };
          const contactObj = entityMeta.entityContacts?.find(c => c.id === override.contactId);
          const contactRole = contactObj?.typeLabel || contactObj?.typeKey || (contactObj?.isPrimary ? 'Primary' : contactObj?.isSignatory ? 'Signatory' : 'Contact');

          queueItems.push({
            campaignId,
            organizationId: campaign.organizationId,
            workspaceId: campaign.workspaceId,
            entityId: override.entityId,
            entityType: entityMeta.entityType as any,
            entityName: entityMeta.name,
            entityPhone: override.phone,
            entityEmail: override.email,
            contactId: override.contactId,
            contactName: override.contactName,
            contactRole: contactRole || 'Contact',
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

        // Write in batches
        const writeChunks: Promise<any>[] = [];
        let writeBatch = adminDb.batch();
        let writeCount = 0;
        for (const item of queueItems) {
          const itemRef = adminDb.collection('call_queue_items').doc(`${campaignId}_${item.entityId}_${item.contactId}`);
          writeBatch.set(itemRef, { id: itemRef.id, ...item });
          writeCount++;
          if (writeCount === 500) {
            writeChunks.push(writeBatch.commit());
            writeBatch = adminDb.batch();
            writeCount = 0;
          }
        }
        if (writeCount > 0) writeChunks.push(writeBatch.commit());
        await Promise.all(writeChunks);

        const updateFields: Record<string, any> = {
          'progress.total': FieldValue.increment(queueItems.length),
          'progress.pending': FieldValue.increment(queueItems.length),
          updatedAt: timestamp,
        };
        if (campaign.status === 'completed') updateFields.status = 'running';
        await campaignRef.update(updateFields);
        return { success: true, count: queueItems.length };
      }

      // ─── PATH B: No overrides — legacy entity-level resolution ───────────────
      const resolvedContactsInfo: { entityId: string; entityMeta: any; contact: any }[] = [];
      
      for (let i = 0; i < entityIds.length; i += batchCheckLimit) {
        const chunk = entityIds.slice(i, i + batchCheckLimit);
        
        const weRefs = chunk.map(eid => adminDb.collection('workspace_entities').doc(`${workspaceId}_${eid}`));
        const entityRefs = chunk.map(eid => adminDb.collection('entities').doc(eid));
        
        const [weSnaps, entitySnaps] = await Promise.all([
          adminDb.getAll(...weRefs),
          adminDb.getAll(...entityRefs)
        ]);

        const tempWE: Record<string, any> = {};
        weSnaps.forEach(snap => {
          if (snap.exists) {
            const data = snap.data();
            if (data?.entityId) {
              tempWE[data.entityId] = data;
            }
          }
        });

        const tempEntity: Record<string, any> = {};
        entitySnaps.forEach(snap => {
          if (snap.exists) {
            const data = snap.data();
            tempEntity[snap.id] = data;
          }
        });

        for (const entityId of chunk) {
          const weData = tempWE[entityId];
          const entityData = tempEntity[entityId];
          const entityMeta = {
            name: weData?.displayName || entityData?.name || 'Unknown Contact',
            entityType: weData?.entityType || entityData?.entityType || 'person',
            entityContacts: entityData?.entityContacts || weData?.entityContacts || [],
          };
          
          const contacts = entityMeta.entityContacts;
          const scopeToUse = contactScope || campaign.audienceDefinition?.contactScope || 'primary';
          let matchedContacts = contacts;
          if (scopeToUse === 'primary') {
            matchedContacts = contacts.filter((c: any) => c.isPrimary);
          } else if (scopeToUse === 'signatories') {
            matchedContacts = contacts.filter((c: any) => c.isSignatory);
          }

          if (matchedContacts.length === 0) {
            if (contacts.length > 0) {
              matchedContacts = [contacts[0]];
            } else {
              matchedContacts = [{
                id: 'primary',
                name: entityMeta.name,
                phone: '',
                email: '',
                typeLabel: 'Contact',
              }];
            }
          }

          for (const c of matchedContacts) {
            resolvedContactsInfo.push({
              entityId,
              entityMeta,
              contact: c,
            });
          }
        }
      }

      // 2. Check deduplication for all resolved contacts
      const existingDocIds = new Set<string>();
      if (resolvedContactsInfo.length > 0) {
        const docIdsToCheck = resolvedContactsInfo.map(info => `${campaignId}_${info.entityId}_${info.contact.id}`);
        for (let i = 0; i < docIdsToCheck.length; i += batchCheckLimit) {
          const chunk = docIdsToCheck.slice(i, i + batchCheckLimit);
          const snaps = await adminDb.collection('call_queue_items')
            .where('__name__', 'in', chunk)
            .get();
          snaps.docs.forEach(doc => existingDocIds.add(doc.id));
        }
      }

      // 3. Filter out existing items and prepare queue items
      for (const info of resolvedContactsInfo) {
        const docId = `${campaignId}_${info.entityId}_${info.contact.id}`;
        if (existingDocIds.has(docId)) continue; // skip duplicates

        queueItems.push({
          campaignId,
          organizationId: campaign.organizationId,
          workspaceId: campaign.workspaceId,
          entityId: info.entityId,
          entityType: info.entityMeta.entityType as any,
          entityName: info.entityMeta.name,
          entityPhone: info.contact.phone || '',
          entityEmail: info.contact.email || '',
          contactId: info.contact.id,
          contactName: info.contact.name,
          contactRole: info.contact.typeLabel || info.contact.typeKey || (info.contact.isPrimary ? 'Primary' : info.contact.isSignatory ? 'Signatory' : 'Contact'),
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
        const itemRef = adminDb.collection('call_queue_items').doc(`${campaignId}_${item.entityId}_${item.contactId}`);
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
        const entitySnap = await adminDb.collection('workspace_entities')
          .where('entityId', '==', entity.id)
          .where('workspaceId', '==', campaign.workspaceId)
          .get();
        
        const entityData = entitySnap.empty ? null : entitySnap.docs[0].data();
        const contacts = (entityData?.entityContacts || []) as any[];

        const contactScope = campaign.audienceDefinition?.contactScope || 'primary';
        let matchedContacts = contacts;
        if (contactScope === 'primary') {
          matchedContacts = contacts.filter((c: any) => c.isPrimary);
        } else if (contactScope === 'signatories') {
          matchedContacts = contacts.filter((c: any) => c.isSignatory);
        }

        if (matchedContacts.length === 0) {
          if (contacts.length > 0) {
            matchedContacts = [contacts[0]];
          } else {
            matchedContacts = [{
              id: 'primary',
              name: entity.name || 'Unknown Contact',
              phone: entityData?.phone || '',
              email: entityData?.email || '',
              typeLabel: 'Contact',
            }];
          }
        }

        for (const c of matchedContacts) {
          queueItems.push({
            campaignId,
            organizationId: campaign.organizationId,
            workspaceId: campaign.workspaceId,
            entityId: entity.id,
            entityType: (entityData?.entityType || 'person') as any,
            entityName: entityData?.displayName || entity.name || 'Unknown Entity',
            entityPhone: c.phone || '',
            entityEmail: c.email || '',
            contactId: c.id,
            contactName: c.name,
            contactRole: c.typeLabel || c.typeKey || (c.isPrimary ? 'Primary' : c.isSignatory ? 'Signatory' : 'Contact'),
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
      }

      // Write queue items in batches of 500
      const writeChunks: Promise<any>[] = [];
      let writeBatch = adminDb.batch();
      let writeCount = 0;

      for (const item of queueItems) {
        const itemRef = adminDb.collection('call_queue_items').doc(`${campaignId}_${item.entityId}_${item.contactId}`);
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

        return { campaignId: data.campaignId, entityId: data.entityId, entityType: data.entityType, entityName: data.entityName, organizationId: data.organizationId, workspaceId: data.workspaceId, contactId: data.contactId ?? null };
      });

      const { campaignId, entityId, entityType, organizationId, workspaceId, contactId } = transactionResult;

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
            contactId,
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
          contactId,
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
    contactId?: string | null;
  }): Promise<void> {
    const { campaignId, entityId, outcome, userId, workspaceId, organizationId, contactId } = params;

    try {
      const campaignSnap = await adminDb.collection('call_campaigns').doc(campaignId).get();
      if (!campaignSnap.exists) return;

      const campaign = campaignSnap.data() as CallCampaign;

      // Source of truth: automations configured on the script's outcome node.
      // Fall back to the legacy campaign-level automationRules only when the
      // script defines none (back-compat for pre-existing campaigns; no migration).
      const graph = parseGraph(campaign.scriptSnapshot);
      const scriptRules = getOutcomeAutomations(graph, outcome);
      const rules = scriptRules ?? (campaign.automationRules?.[outcome] ?? []);

      console.log(`>>> [CALL_CENTRE_SERVICE] Running ${rules.length} automations for outcome "${outcome}" on Entity: ${entityId} (source: ${scriptRules ? 'script' : 'legacy'})`);

      for (const rule of rules) {
        const result = await this.executeCallActionEffect(rule.type, rule.params ?? {}, {
          entityId,
          userId,
          workspaceId,
          organizationId,
          contactId: contactId ?? undefined,
        });
        if (!result.success && !result.unsupported) {
          console.error(`>>> [CALL_CENTRE_SERVICE] Automation rule "${rule.type}" failed:`, result.error);
        }
      }
    } catch (err) {
      console.error('[CALL_CENTRE_SERVICE] Campaign automations lookup failed:', err instanceof Error ? err.message : err);
    }
  }

  /**
   * Run a single call-action side effect against a contact. Shared by campaign outcome
   * automations and by per-node script-action triggering, so both paths behave identically.
   * Never throws — returns a typed result (and `unsupported: true` for action types not yet
   * handled), so callers can surface friendly status without crashing.
   */
  static async executeCallActionEffect(
    type: CallActionType | string,
    params: CallActionParams = {},
    ctx: { entityId: string; userId: string; workspaceId: string; organizationId: string; contactId?: string }
  ): Promise<{ success: boolean; unsupported?: boolean; error?: string }> {
    const { entityId, userId, workspaceId, organizationId, contactId } = ctx;
    const systemActor = `system-call-centre:${userId}`;

    try {
      switch (type) {
        case 'CHANGE_STAGE': {
          if (!params.stageId) return { success: false, error: 'No stage configured.' };
          const stageSnap = await adminDb.collection('onboardingStages').doc(params.stageId).get();
          const currentStageName = stageSnap.exists ? stageSnap.data()?.name || 'Unknown' : 'Unknown';
          const patch: { stageId: string; currentStageName: string; pipelineId?: string } =
            { stageId: params.stageId, currentStageName };
          if (params.pipelineId) patch.pipelineId = params.pipelineId; // cross-pipeline move
          await updateEntityAction(
            entityId,
            patch,
            systemActor,
            workspaceId,
            organizationId
          );
          return { success: true };
        }

        case 'ADD_TO_PIPELINE': {
          if (!params.pipelineId || !params.stageId) {
            return { success: false, error: 'Pipeline and stage are required.' };
          }
          const stageSnap = await adminDb.collection('onboardingStages').doc(params.stageId).get();
          const currentStageName = stageSnap.exists ? stageSnap.data()?.name || 'Unknown' : 'Unknown';
          await updateEntityAction(
            entityId,
            { pipelineId: params.pipelineId, stageId: params.stageId, currentStageName },
            systemActor,
            workspaceId,
            organizationId
          );
          return { success: true };
        }

        case 'ADD_TAG': {
          if (!params.tagId) return { success: false, error: 'No tag configured.' };
          await applyTagsAction(entityId, 'entity', [params.tagId], systemActor);
          return { success: true };
        }

        case 'REMOVE_TAG': {
          if (!params.tagId) return { success: false, error: 'No tag configured.' };
          await removeTagsAction(entityId, 'entity', [params.tagId], systemActor);
          return { success: true };
        }

        case 'CREATE_TASK': {
          if (!params.taskTitle) return { success: false, error: 'No task title configured.' };
          await createTaskAction({
            organizationId,
            workspaceId,
            title: params.taskTitle,
            description: params.taskDescription || '',
            priority: params.taskPriority || 'medium',
            status: 'todo',
            category: 'call_follow_up' as any,
            assignedTo: userId,
            entityId,
            entityType: 'person' as any,
            dueDate: params.taskDueDate || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // + 2 days default
            reminders: [],
            reminderSent: false,
          }, systemActor);
          return { success: true };
        }

        case 'SEND_SMS': {
          if (!params.templateId) return { success: false, error: 'No template configured.' };
          const templateSnap = await adminDb.collection('message_templates').doc(params.templateId).get();
          if (!templateSnap.exists) return { success: false, error: 'Template not found.' };
          
          const rawBody = templateSnap.data()?.body || '';

          // Retrieve entity contact details
          const entitySnap = await adminDb.collection('entities').doc(entityId).get();
          const entityData = entitySnap.exists ? entitySnap.data() : null;
          const contactsList = (entityData?.entityContacts ?? []) as EntityContact[];
          
          const activeContact = contactId 
            ? contactsList.find(c => c.id === contactId || c.email === contactId || c.phone === contactId) || contactsList.find(c => c.isPrimary) || contactsList[0]
            : contactsList.find(c => c.isPrimary) || contactsList[0];

          // Fetch active agent user details
          let agentName = 'Agent';
          if (userId) {
            const userSnap = await adminDb.collection('users').doc(userId).get();
            if (userSnap.exists) {
              agentName = userSnap.data()?.displayName || userSnap.data()?.name || 'Agent';
            }
          }

          // Fetch any active deal linked to this entity
          let dealData = null;
          const dealsSnap = await adminDb.collection('deals')
            .where('entityId', '==', entityId)
            .where('status', '==', 'open')
            .limit(1)
            .get();
          if (!dealsSnap.empty) {
            dealData = dealsSnap.docs[0].data();
          }

          // Compile variables
          const body = resolveScriptVariables(
            rawBody,
            entityData as any,
            dealData,
            agentName,
            activeContact
          );

          const phone = activeContact?.phone || '';
          if (!phone) return { success: false, error: 'Contact has no phone number.' };

          // Determine Sender ID
          let senderId = 'SmartSapp';
          if (workspaceId) {
            const workspaceSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
            if (workspaceSnap.exists) {
              const ws = workspaceSnap.data() as Workspace;
              senderId = ws.defaultSmsSenderId?.trim() || 'SmartSapp';
            }
          }

          await sendSms({ recipient: phone, message: body, sender: senderId });
          return { success: true };
        }

        case 'SEND_EMAIL': {
          if (!params.templateId) return { success: false, error: 'No template configured.' };
          const templateSnap = await adminDb.collection('message_templates').doc(params.templateId).get();
          if (!templateSnap.exists) return { success: false, error: 'Template not found.' };
          
          const rawSubject = templateSnap.data()?.subject || 'Outreach Follow Up';
          const rawBody = templateSnap.data()?.body || '';

          // Retrieve entity contact details
          const entitySnap = await adminDb.collection('entities').doc(entityId).get();
          const entityData = entitySnap.exists ? entitySnap.data() : null;
          const contactsList = (entityData?.entityContacts ?? []) as EntityContact[];
          
          const activeContact = contactId 
            ? contactsList.find(c => c.id === contactId || c.email === contactId || c.phone === contactId) || contactsList.find(c => c.isPrimary) || contactsList[0]
            : contactsList.find(c => c.isPrimary) || contactsList[0];

          // Fetch active agent user details
          let agentName = 'Agent';
          if (userId) {
            const userSnap = await adminDb.collection('users').doc(userId).get();
            if (userSnap.exists) {
              agentName = userSnap.data()?.displayName || userSnap.data()?.name || 'Agent';
            }
          }

          // Fetch any active deal linked to this entity
          let dealData = null;
          const dealsSnap = await adminDb.collection('deals')
            .where('entityId', '==', entityId)
            .where('status', '==', 'open')
            .limit(1)
            .get();
          if (!dealsSnap.empty) {
            dealData = dealsSnap.docs[0].data();
          }

          // Compile variables for subject and HTML body
          const subject = resolveScriptVariables(
            rawSubject,
            entityData as any,
            dealData,
            agentName,
            activeContact
          );

          const html = resolveScriptVariables(
            rawBody,
            entityData as any,
            dealData,
            agentName,
            activeContact
          );

          const email = activeContact?.email || '';
          if (!email) return { success: false, error: 'Contact has no email address.' };
          await sendEmail({ to: email, subject, html });
          return { success: true };
        }

        case 'SEND_WHATSAPP': {
          if (!params.templateId) return { success: false, error: 'No template configured.' };
          const templateSnap = await adminDb.collection('message_templates').doc(params.templateId).get();
          if (!templateSnap.exists) return { success: false, error: 'Template not found.' };
          const templateData = templateSnap.data() || {};
          const body = params.customBody || templateData.body || '';

          const contactSnap = await adminDb.collection('entities').doc(entityId).get();
          let phone = '';
          if (contactSnap.exists) {
            const contactsList = (contactSnap.data()?.entityContacts ?? []) as EntityContact[];
            const primary = contactsList.find(c => c.isPrimary) || contactsList[0];
            phone = primary?.phone || '';
          }
          if (!phone) return { success: false, error: 'Contact has no phone number.' };

          try {
            const { sendWhatsApp } = await import('../whatsapp/whatsapp-send');
            await sendWhatsApp({
              recipient: phone,
              template: templateData as any,
              resolvedBody: body,
              variables: {},
              organizationId,
            });
            return { success: true };
          } catch (e: any) {
            return { success: false, error: e?.message || 'WhatsApp send failed' };
          }
        }

        case 'LOG_NOTE': {
          const noteContent = params.noteContent;
          if (!noteContent) return { success: false, error: 'No note content configured.' };
          
          const timestamp = new Date().toISOString();
          
          let authorName = 'System';
          try {
            const userSnap = await adminDb.collection('users').doc(userId).get();
            if (userSnap.exists) {
              authorName = userSnap.data()?.displayName || userSnap.data()?.name || 'Agent';
            }
          } catch (e) {
            console.error('[CALL_CENTRE_SERVICE] Failed to fetch user name for note:', e);
          }

          const noteData = {
            entityId,
            organizationId,
            workspaceId,
            content: noteContent,
            type: 'general',
            replyCount: 0,
            isPinned: false,
            createdBy: userId,
            createdByName: authorName,
            createdAt: timestamp,
            updatedAt: timestamp,
          };

          await adminDb.collection('entity_notes').add(noteData);

          await logActivity({
            organizationId,
            workspaceId,
            entityId,
            entityType: 'person' as any,
            userId,
            displayName: authorName,
            type: 'note_added',
            source: 'system',
            description: `logged an outreach call note: "${noteContent.substring(0, 60)}${noteContent.length > 60 ? '...' : ''}"`,
            metadata: {
              isAutomation: true,
              noteContent,
            }
          });

          return { success: true };
        }

        case 'SCHEDULE_MEETING': {
          // Back-compat: legacy configs set only `meetingTypeId` (create mode). When the
          // mode is unset, infer it from which target is present; default to guest-list.
          const meetingMode = params.meetingMode
            ?? (params.meetingId ? 'guest_list' : params.meetingTypeId ? 'create' : 'guest_list');

          // Guest-list mode: add the called contact to an existing, not-yet-due meeting.
          if (meetingMode === 'guest_list') {
            if (!params.meetingId) return { success: false, error: 'No meeting selected.' };
            const entitySnap = await adminDb.collection('entities').doc(entityId).get();
            if (!entitySnap.exists) return { success: false, error: 'Entity not found.' };
            const entityData = entitySnap.data();
            const contacts = (entityData?.entityContacts ?? []) as EntityContact[];
            const contact = (contactId ? contacts.find(c => c.id === contactId) : undefined)
              ?? contacts.find(c => c.isPrimary)
              ?? contacts[0];
            await adminDb.collection(`meetings/${params.meetingId}/registrants`).doc(entityId).set({
              entityId,
              name: contact?.name ?? entityData?.name ?? '',
              email: contact?.email ?? '',
              phone: contact?.phone ?? '',
              source: 'call_campaign',
              createdAt: new Date().toISOString(),
            }, { merge: true });
            return { success: true };
          }

          // Create mode: spin up a new meeting from a configured MEETING_TYPES type.
          if (!params.meetingTypeId) return { success: false, error: 'No meeting type configured.' };

          const meetingType = MEETING_TYPES.find(t => t.id === params.meetingTypeId);
          if (!meetingType) return { success: false, error: `Invalid meeting type ID "${params.meetingTypeId}".` };

          const entitySnap = await adminDb.collection('entities').doc(entityId).get();
          if (!entitySnap.exists) return { success: false, error: 'Entity not found.' };
          const entityName = entitySnap.data()?.name || '';
          const entitySlug = entitySnap.data()?.slug || '';

          const timestamp = new Date().toISOString();
          const meetingTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(); // +2 days default
          const meetingSlug = `${meetingType.slug}-${Math.random().toString(36).substring(2, 9)}`;
          const meetingLink = `https://smartsapp.com/meetings/${meetingType.slug}/${meetingSlug}`;
          
          const meetingData = {
            title: `Outreach Session: ${meetingType.name} with ${entityName}`,
            meetingSlug,
            entityId,
            entityName,
            entitySlug,
            entityType: entitySnap.data()?.entityType || 'person',
            workspaceIds: [workspaceId],
            meetingTime,
            meetingLink,
            type: meetingType,
            status: 'scheduled',
            publishStatus: 'published',
            organizationId,
            createdAt: timestamp,
            updatedAt: timestamp,
          };

          const docRef = await adminDb.collection('meetings').add(meetingData);

          await logActivity({
            organizationId,
            workspaceId,
            entityId,
            entityType: entitySnap.data()?.entityType || 'person',
            userId,
            type: 'meeting_created' as any,
            source: 'system',
            description: `Scheduled meeting: ${meetingType.name} for ${entityName}`,
            metadata: {
              isAutomation: true,
              meetingId: docRef.id,
            }
          });

          return { success: true };
        }

        case 'WEBHOOK': {
          if (!params.webhookUrl || !/^https?:\/\//i.test(params.webhookUrl)) {
            return { success: false, error: 'A valid HTTP/HTTPS webhook URL is required.' };
          }
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          // webhookHeaders is a JSON string from the UI — parse + guard (never trust shape).
          if (typeof params.webhookHeaders === 'string' && params.webhookHeaders.trim()) {
            try {
              const parsed: unknown = JSON.parse(params.webhookHeaders);
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) headers[k] = String(v);
              }
            } catch {
              /* ignore malformed headers — send defaults */
            }
          }
          const response = await fetch(params.webhookUrl, {
            method: params.webhookMethod || 'POST',
            headers,
            body: JSON.stringify({
              entityId,
              workspaceId,
              organizationId,
              agentId: userId,
              source: 'call-script-action',
              timestamp: new Date().toISOString(),
            }),
          });
          if (!response.ok) return { success: false, error: `Webhook failed with status ${response.status}.` };
          return { success: true };
        }

        case 'ADD_TO_CALL_CAMPAIGN': {
          if (!params.campaignId) return { success: false, error: 'No campaign ID configured.' };
          return await this.addContactsToCampaign(
            params.campaignId,
            [entityId],
            workspaceId,
            userId,
            undefined,
            params.contactScope || 'primary'
          );
        }

        case 'UPDATE_CONTACT': {
          const contactName = params.contactName;
          const contactEmail = params.contactEmail;
          const contactPhone = params.contactPhone;
          const updateMode = params.updateMode || 'update'; // 'update' or 'new'

          if (!contactName && !contactEmail && !contactPhone) {
            return { success: false, error: 'No contact fields to update.' };
          }

          const entityRef = adminDb.collection('entities').doc(entityId);
          const entitySnap = await entityRef.get();
          if (!entitySnap.exists) {
            return { success: false, error: 'Entity not found.' };
          }

          const entityData = entitySnap.data();
          const contacts = (entityData?.entityContacts || []) as any[];
          
          if (updateMode === 'new') {
            const newId = typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID
              ? globalThis.crypto.randomUUID()
              : `cnt_${Math.random().toString(36).substring(2, 11)}`;
            const targetContact: any = {
              id: newId,
              name: contactName || 'New Contact',
              email: contactEmail || '',
              phone: '',
              isPrimary: contacts.length === 0,
            };

            if (contactPhone) {
              let phone = contactPhone;
              try {
                const { normalizePhoneNumber } = await import('../phone-utils');
                const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
                const defaultCountryCode = orgSnap.data()?.defaultCountryCode || 'GH';
                const parsed = normalizePhoneNumber(phone, defaultCountryCode);
                phone = parsed.e164 || phone;
                if (parsed.countryCode) targetContact.countryCode = parsed.countryCode;
                if (parsed.callingCode) targetContact.callingCode = parsed.callingCode;
              } catch (e) {
                console.error('[CALL_CENTRE_SERVICE] Phone normalization failed:', e);
              }
              targetContact.phone = phone;
            }

            contacts.push(targetContact);
          } else {
            let contactIdx = -1;
            if (contactId) {
              contactIdx = contacts.findIndex((c: any) => c.id === contactId);
            }
            if (contactIdx === -1) {
              contactIdx = contacts.findIndex((c: any) => c.isPrimary);
            }
            if (contactIdx === -1 && contacts.length > 0) {
              contactIdx = 0;
            }

            if (contactIdx === -1) {
              return { success: false, error: 'No contact found to update.' };
            }

            const targetContact = { ...contacts[contactIdx] };
            if (contactName) targetContact.name = contactName;
            if (contactEmail) targetContact.email = contactEmail;
            
            if (contactPhone) {
              let phone = contactPhone;
              try {
                const { normalizePhoneNumber } = await import('../phone-utils');
                const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
                const defaultCountryCode = orgSnap.data()?.defaultCountryCode || 'GH';
                const parsed = normalizePhoneNumber(phone, defaultCountryCode);
                phone = parsed.e164 || phone;
                if (parsed.countryCode) targetContact.countryCode = parsed.countryCode;
                if (parsed.callingCode) targetContact.callingCode = parsed.callingCode;
              } catch (e) {
                console.error('[CALL_CENTRE_SERVICE] Phone normalization failed:', e);
              }
              targetContact.phone = phone;
            }

            contacts[contactIdx] = targetContact;
          }

          const res = await updateEntityAction(
            entityId,
            { entityContacts: contacts },
            systemActor,
            workspaceId,
            organizationId
          );

          if (!res.success) {
            return { success: false, error: res.error };
          }
          return { success: true };
        }

        default:
          return { success: false, unsupported: true, error: `Action type "${type}" is not supported yet.` };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Action execution failed.' };
    }
  }

  /**
   * Execute a single script action node (its configured side effect) against a contact.
   * Thin wrapper over {@link executeCallActionEffect} using the node's actionConfig as params.
   */
  static async executeScriptAction(params: {
    actionType: CallActionType | string;
    actionConfig?: CallActionParams;
    entityId: string;
    userId: string;
    workspaceId: string;
    organizationId: string;
    contactId?: string;
  }): Promise<{ success: boolean; unsupported?: boolean; error?: string }> {
    const { actionType, actionConfig, entityId, userId, workspaceId, organizationId, contactId } = params;
    if (!actionType) return { success: false, error: 'No action type configured on this node.' };
    return this.executeCallActionEffect(actionType, actionConfig || {}, {
      entityId,
      userId,
      workspaceId,
      organizationId,
      contactId,
    });
  }
}
