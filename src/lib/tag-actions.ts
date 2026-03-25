'use server';

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import type { Tag, TagCategory, TagAuditLog } from './types';
import { fireTagTrigger } from './tag-trigger';
import { userHasTagPermission } from './tag-permissions';
import {
  CreateTagSchema,
  UpdateTagSchema,
  ApplyTagsSchema,
  BulkTagSchema,
  MergeTagsSchema,
} from './tag-schemas';
import {
  TagValidationError,
  TagPermissionError,
  TagConflictError,
  TagNotFoundError,
  getUserFriendlyErrorMessage,
} from './tag-errors';

/**
 * Helper function to log tag audit trail
 */
async function logTagAudit(data: {
  workspaceId: string;
  action: 'created' | 'updated' | 'deleted' | 'merged' | 'applied' | 'removed';
  tagId: string;
  tagName: string;
  contactId?: string;
  contactName?: string;
  userId: string;
  userName?: string;
  metadata?: any;
}) {
  try {
    const auditRef = adminDb.collection('tag_audit_logs').doc();
    const auditLog: TagAuditLog = {
      id: auditRef.id,
      workspaceId: data.workspaceId,
      action: data.action,
      tagId: data.tagId,
      tagName: data.tagName,
      contactId: data.contactId,
      contactName: data.contactName,
      userId: data.userId,
      userName: data.userName || 'Unknown User',
      timestamp: new Date().toISOString(),
      metadata: data.metadata
    };
    
    await auditRef.set(auditLog);
  } catch (error) {
    console.error('Failed to log tag audit:', error);
    // Don't throw - audit logging failure shouldn't break the main operation
  }
}

/**
 * Validates tag name format
 */
function validateTagName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Tag name is required' };
  }
  
  if (name.length > 50) {
    return { valid: false, error: 'Tag name must be 50 characters or less' };
  }
  
  // Allow letters, numbers, spaces, hyphens, underscores, brackets, colons
  const validPattern = /^[a-zA-Z0-9\s\-_\[\]:]+$/;
  if (!validPattern.test(name)) {
    return { valid: false, error: 'Tag name contains invalid characters. Only letters, numbers, spaces, hyphens, underscores, brackets, and colons are allowed' };
  }
  
  return { valid: true };
}

/**
 * Creates a new tag
 */
export async function createTagAction(data: {
  workspaceId: string;
  organizationId: string;
  name: string;
  description?: string;
  category: TagCategory;
  color: string;
  userId: string;
  userName?: string;
}) {
  const parsed = CreateTagSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    // Permission check: requires tags_manage
    const canManage = await userHasTagPermission(data.userId, 'tags_manage');
    if (!canManage) {
      throw new TagPermissionError('You do not have permission to manage tags.');
    }

    // Validate tag name
    const validation = validateTagName(data.name);
    if (!validation.valid) {
      throw new TagValidationError(validation.error!);
    }
    
    const slug = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    
    // Check for duplicate names in workspace (case-insensitive)
    const existingSnap = await adminDb
      .collection('tags')
      .where('workspaceId', '==', data.workspaceId)
      .where('slug', '==', slug)
      .limit(1)
      .get();
    
    if (!existingSnap.empty) {
      throw new TagConflictError('A tag with this name already exists in your workspace.');
    }
    
    const tagRef = adminDb.collection('tags').doc();
    const tag: Tag = {
      id: tagRef.id,
      workspaceId: data.workspaceId,
      organizationId: data.organizationId,
      name: data.name.trim(),
      slug,
      description: data.description?.trim(),
      category: data.category,
      color: data.color,
      isSystem: false,
      usageCount: 0,
      createdBy: data.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await tagRef.set(tag);
    
    // Log audit trail
    await logTagAudit({
      workspaceId: data.workspaceId,
      action: 'created',
      tagId: tag.id,
      tagName: tag.name,
      userId: data.userId,
      userName: data.userName
    });
    
    revalidatePath('/admin/contacts/tags');
    return { success: true, data: tag };
  } catch (error: any) {
    console.error('Create tag error:', error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}

/**
 * Updates an existing tag
 */
export async function updateTagAction(
  tagId: string,
  updates: Partial<Pick<Tag, 'name' | 'description' | 'category' | 'color'>>,
  userId: string,
  userName?: string
) {
  const parsed = UpdateTagSchema.safeParse(updates);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    // Permission check: requires tags_manage
    const canManage = await userHasTagPermission(userId, 'tags_manage');
    if (!canManage) {
      throw new TagPermissionError('You do not have permission to manage tags.');
    }

    const tagRef = adminDb.collection('tags').doc(tagId);
    const tagSnap = await tagRef.get();
    
    if (!tagSnap.exists) {
      throw new TagNotFoundError('Tag not found. It may have been deleted.');
    }
    
    const tag = tagSnap.data() as Tag;
    
    if (tag.isSystem) {
      throw new TagValidationError('system tags cannot be modified.');
    }
    
    // If name is being updated, validate it
    if (updates.name) {
      const validation = validateTagName(updates.name);
      if (!validation.valid) {
        throw new TagValidationError(validation.error!);
      }
      
      // Check for duplicate names (excluding current tag)
      const slug = updates.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      const existingSnap = await adminDb
        .collection('tags')
        .where('workspaceId', '==', tag.workspaceId)
        .where('slug', '==', slug)
        .limit(2)
        .get();
      
      const duplicates = existingSnap.docs.filter(doc => doc.id !== tagId);
      if (duplicates.length > 0) {
        throw new TagConflictError('A tag with this name already exists in your workspace.');
      }
      
      updates.name = updates.name.trim();
    }
    
    if (updates.description) {
      updates.description = updates.description.trim();
    }
    
    const updateData: any = {
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await tagRef.update(updateData);
    
    // Log audit trail
    await logTagAudit({
      workspaceId: tag.workspaceId,
      action: 'updated',
      tagId: tag.id,
      tagName: updates.name || tag.name,
      userId,
      userName,
      metadata: {
        oldValue: tag,
        newValue: updates
      }
    });
    
    revalidatePath('/admin/contacts/tags');
    return { success: true };
  } catch (error: any) {
    console.error('Update tag error:', error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}

/**
 * Deletes a tag and removes it from all contacts
 */
export async function deleteTagAction(
  tagId: string,
  userId: string,
  userName?: string
) {
  try {
    // Permission check: requires tags_manage
    const canManage = await userHasTagPermission(userId, 'tags_manage');
    if (!canManage) {
      throw new TagPermissionError('You do not have permission to manage tags.');
    }

    const tagRef = adminDb.collection('tags').doc(tagId);
    const tagSnap = await tagRef.get();
    
    if (!tagSnap.exists) {
      throw new TagNotFoundError('Tag not found. It may have been deleted.');
    }
    
    const tag = tagSnap.data() as Tag;
    
    if (tag.isSystem) {
      throw new TagValidationError('system tags cannot be deleted.');
    }
    
    // Remove tag from all schools in batches
    const schoolsSnap = await adminDb
      .collection('schools')
      .where('tags', 'array-contains', tagId)
      .get();
    
    // Process in batches of 500 (Firestore limit)
    const batchSize = 500;
    let processedCount = 0;
    
    for (let i = 0; i < schoolsSnap.docs.length; i += batchSize) {
      const batch = adminDb.batch();
      const batchDocs = schoolsSnap.docs.slice(i, i + batchSize);
      
      batchDocs.forEach(doc => {
        const tags = (doc.data().tags || []).filter((t: string) => t !== tagId);
        const taggedAt = { ...doc.data().taggedAt };
        const taggedBy = { ...doc.data().taggedBy };
        delete taggedAt[tagId];
        delete taggedBy[tagId];
        
        batch.update(doc.ref, { tags, taggedAt, taggedBy });
        processedCount++;
      });
      
      await batch.commit();
    }
    
    // Remove tag from all prospects in batches
    const prospectsSnap = await adminDb
      .collection('prospects')
      .where('tags', 'array-contains', tagId)
      .get();
    
    for (let i = 0; i < prospectsSnap.docs.length; i += batchSize) {
      const batch = adminDb.batch();
      const batchDocs = prospectsSnap.docs.slice(i, i + batchSize);
      
      batchDocs.forEach(doc => {
        const tags = (doc.data().tags || []).filter((t: string) => t !== tagId);
        const taggedAt = { ...doc.data().taggedAt };
        const taggedBy = { ...doc.data().taggedBy };
        delete taggedAt[tagId];
        delete taggedBy[tagId];
        
        batch.update(doc.ref, { tags, taggedAt, taggedBy });
        processedCount++;
      });
      
      await batch.commit();
    }
    
    // Delete the tag
    await tagRef.delete();
    
    // Log audit trail
    await logTagAudit({
      workspaceId: tag.workspaceId,
      action: 'deleted',
      tagId: tag.id,
      tagName: tag.name,
      userId,
      userName,
      metadata: { affectedCount: processedCount }
    });
    
    revalidatePath('/admin/contacts/tags');
    revalidatePath('/admin/schools');
    revalidatePath('/admin/prospects');
    return { success: true, affectedCount: processedCount };
  } catch (error: any) {
    console.error('Delete tag error:', error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}

/**
 * Merges multiple tags into a single target tag
 */
export async function mergeTagsAction(
  sourceTagIds: string[],
  targetTagId: string,
  userId: string,
  userName?: string
) {
  const parsed = MergeTagsSchema.safeParse({ sourceTagIds, targetTagId, userId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    // Permission check: requires tags_manage
    const canManage = await userHasTagPermission(userId, 'tags_manage');
    if (!canManage) {
      throw new TagPermissionError('You do not have permission to manage tags.');
    }

    // Get all tags
    const tagsSnap = await adminDb
      .collection('tags')
      .where('__name__', 'in', [...sourceTagIds, targetTagId])
      .get();
    
    const tags = new Map(tagsSnap.docs.map(d => [d.id, d.data() as Tag]));
    const targetTag = tags.get(targetTagId);
    
    if (!targetTag) {
      throw new TagNotFoundError('Target tag not found. It may have been deleted.');
    }
    
    // Validate all source tags exist
    for (const sourceTagId of sourceTagIds) {
      if (!tags.has(sourceTagId)) {
        throw new TagNotFoundError(`Source tag not found. It may have been deleted.`);
      }
    }
    
    // Find all contacts with source tags
    const contactsToUpdate = new Map<string, { collection: string; data: any }>();
    
    // Process schools
    for (const sourceTagId of sourceTagIds) {
      const schoolsSnap = await adminDb
        .collection('schools')
        .where('tags', 'array-contains', sourceTagId)
        .get();
      
      schoolsSnap.forEach(doc => {
        contactsToUpdate.set(`schools/${doc.id}`, {
          collection: 'schools',
          data: doc.data()
        });
      });
    }
    
    // Process prospects
    for (const sourceTagId of sourceTagIds) {
      const prospectsSnap = await adminDb
        .collection('prospects')
        .where('tags', 'array-contains', sourceTagId)
        .get();
      
      prospectsSnap.forEach(doc => {
        contactsToUpdate.set(`prospects/${doc.id}`, {
          collection: 'prospects',
          data: doc.data()
        });
      });
    }
    
    // Update contacts in batches
    const batchSize = 500;
    const contactEntries = Array.from(contactsToUpdate.entries());
    
    for (let i = 0; i < contactEntries.length; i += batchSize) {
      const batch = adminDb.batch();
      const batchEntries = contactEntries.slice(i, i + batchSize);
      
      for (const [key, { collection, data }] of batchEntries) {
        const contactId = key.split('/')[1];
        const contactRef = adminDb.collection(collection).doc(contactId);
        
        const tags = new Set(data.tags || []);
        sourceTagIds.forEach(id => tags.delete(id));
        tags.add(targetTagId);
        
        const taggedAt = { ...data.taggedAt };
        const taggedBy = { ...data.taggedBy };
        
        // Keep earliest timestamp from source tags
        const timestamps = sourceTagIds
          .map(id => taggedAt[id])
          .filter(Boolean)
          .sort();
        const earliestTimestamp = timestamps[0] || new Date().toISOString();
        
        sourceTagIds.forEach(id => {
          delete taggedAt[id];
          delete taggedBy[id];
        });
        
        // Only update if target tag doesn't already exist
        if (!taggedAt[targetTagId]) {
          taggedAt[targetTagId] = earliestTimestamp;
          taggedBy[targetTagId] = userId;
        }
        
        batch.update(contactRef, {
          tags: Array.from(tags),
          taggedAt,
          taggedBy
        });
      }
      
      await batch.commit();
    }
    
    // Delete source tags and update target tag usage count
    const finalBatch = adminDb.batch();
    
    sourceTagIds.forEach(id => {
      finalBatch.delete(adminDb.collection('tags').doc(id));
    });
    
    finalBatch.update(adminDb.collection('tags').doc(targetTagId), {
      usageCount: contactsToUpdate.size,
      updatedAt: new Date().toISOString()
    });
    
    await finalBatch.commit();
    
    // Log audit trail
    await logTagAudit({
      workspaceId: targetTag.workspaceId,
      action: 'merged',
      tagId: targetTagId,
      tagName: targetTag.name,
      userId,
      userName,
      metadata: {
        mergedTagIds: sourceTagIds,
        affectedCount: contactsToUpdate.size
      }
    });
    
    revalidatePath('/admin/contacts/tags');
    revalidatePath('/admin/schools');
    revalidatePath('/admin/prospects');
    return { success: true, affectedCount: contactsToUpdate.size };
  } catch (error: any) {
    console.error('Merge tags error:', error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}

/**
 * Gets all tags for a workspace
 */
export async function getTagsAction(workspaceId: string) {
  try {
    const tagsSnap = await adminDb
      .collection('tags')
      .where('workspaceId', '==', workspaceId)
      .orderBy('category', 'asc')
      .orderBy('name', 'asc')
      .get();
    
    const tags = tagsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Tag[];
    
    return { success: true, data: tags };
  } catch (error: any) {
    console.error('Get tags error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Gets a single tag by ID
 */
export async function getTagAction(tagId: string) {
  try {
    const tagSnap = await adminDb.collection('tags').doc(tagId).get();
    
    if (!tagSnap.exists) {
      return { success: false, error: 'Tag not found' };
    }
    
    const tag = {
      id: tagSnap.id,
      ...tagSnap.data()
    } as Tag;
    
    return { success: true, data: tag };
  } catch (error: any) {
    console.error('Get tag error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Applies tags to a single contact
 */
export async function applyTagsAction(
  contactId: string,
  contactType: 'school' | 'prospect',
  tagIds: string[],
  userId: string,
  userName?: string
) {
  const parsed = ApplyTagsSchema.safeParse({ contactId, contactType, tagIds, userId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    // Permission check: requires tags_apply or tags_manage
    const [canApply, canManage] = await Promise.all([
      userHasTagPermission(userId, 'tags_apply'),
      userHasTagPermission(userId, 'tags_manage'),
    ]);
    if (!canApply && !canManage) {
      throw new TagPermissionError('You do not have permission to apply tags.');
    }

    const collection = contactType === 'school' ? 'schools' : 'prospects';
    const contactRef = adminDb.collection(collection).doc(contactId);
    const contactSnap = await contactRef.get();

    if (!contactSnap.exists) {
      throw new TagNotFoundError('Contact not found. It may have been deleted.');
    }

    const contactData = contactSnap.data()!;
    const existingTags = new Set<string>(contactData.tags || []);
    const taggedAt: Record<string, string> = { ...contactData.taggedAt };
    const taggedBy: Record<string, string> = { ...contactData.taggedBy };
    const timestamp = new Date().toISOString();

    const newTagIds = tagIds.filter(id => !existingTags.has(id));

    newTagIds.forEach(tagId => {
      existingTags.add(tagId);
      taggedAt[tagId] = timestamp;
      taggedBy[tagId] = userId;
    });

    await contactRef.update({
      tags: Array.from(existingTags),
      taggedAt,
      taggedBy
    });

    // Increment usage counts for newly added tags only
    if (newTagIds.length > 0) {
      const usageBatch = adminDb.batch();
      for (const tagId of newTagIds) {
        usageBatch.update(adminDb.collection('tags').doc(tagId), {
          usageCount: FieldValue.increment(1)
        });
      }
      await usageBatch.commit();
    }

    // Log audit trail and fire TAG_ADDED triggers for each new tag
    for (const tagId of newTagIds) {
      const tagSnap = await adminDb.collection('tags').doc(tagId).get();
      const tag = tagSnap.data() as Tag | undefined;
      await logTagAudit({
        workspaceId: tag?.workspaceId || '',
        action: 'applied',
        tagId,
        tagName: tag?.name || tagId,
        contactId,
        contactName: contactData.name,
        userId,
        userName
      });

      // Fire TAG_ADDED automation trigger (FR4.1.1)
      if (tag?.workspaceId) {
        await fireTagTrigger('TAG_ADDED', {
          contactId,
          contactType,
          tagId,
          tagName: tag.name,
          workspaceId: tag.workspaceId,
          appliedBy: userId,
        });
      }
    }

    revalidatePath(`/admin/${collection}`);
    revalidatePath(`/admin/${collection}/${contactId}`);
    return { success: true };
  } catch (error: any) {
    console.error('Apply tags error:', error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}

/**
 * Removes tags from a single contact
 */
export async function removeTagsAction(
  contactId: string,
  contactType: 'school' | 'prospect',
  tagIds: string[],
  userId: string,
  userName?: string
) {
  const parsed = ApplyTagsSchema.safeParse({ contactId, contactType, tagIds, userId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    // Permission check: requires tags_apply or tags_manage
    const [canApply, canManage] = await Promise.all([
      userHasTagPermission(userId, 'tags_apply'),
      userHasTagPermission(userId, 'tags_manage'),
    ]);
    if (!canApply && !canManage) {
      throw new TagPermissionError('You do not have permission to apply tags.');
    }

    const collection = contactType === 'school' ? 'schools' : 'prospects';
    const contactRef = adminDb.collection(collection).doc(contactId);
    const contactSnap = await contactRef.get();

    if (!contactSnap.exists) {
      throw new TagNotFoundError('Contact not found. It may have been deleted.');
    }

    const contactData = contactSnap.data()!;
    const taggedAt: Record<string, string> = { ...contactData.taggedAt };
    const taggedBy: Record<string, string> = { ...contactData.taggedBy };

    const removedTagIds = (contactData.tags || []).filter((t: string) => tagIds.includes(t));
    const remainingTags = (contactData.tags || []).filter((t: string) => !tagIds.includes(t));

    removedTagIds.forEach((tagId: string) => {
      delete taggedAt[tagId];
      delete taggedBy[tagId];
    });

    await contactRef.update({ tags: remainingTags, taggedAt, taggedBy });

    // Decrement usage counts for actually removed tags
    if (removedTagIds.length > 0) {
      const usageBatch = adminDb.batch();
      for (const tagId of removedTagIds) {
        usageBatch.update(adminDb.collection('tags').doc(tagId), {
          usageCount: FieldValue.increment(-1)
        });
      }
      await usageBatch.commit();
    }

    // Log audit trail and fire TAG_REMOVED triggers for each removed tag
    for (const tagId of removedTagIds) {
      const tagSnap = await adminDb.collection('tags').doc(tagId).get();
      const tag = tagSnap.data() as Tag | undefined;
      await logTagAudit({
        workspaceId: tag?.workspaceId || '',
        action: 'removed',
        tagId,
        tagName: tag?.name || tagId,
        contactId,
        contactName: contactData.name,
        userId,
        userName
      });

      // Fire TAG_REMOVED automation trigger (FR4.1.1)
      if (tag?.workspaceId) {
        await fireTagTrigger('TAG_REMOVED', {
          contactId,
          contactType,
          tagId,
          tagName: tag.name,
          workspaceId: tag.workspaceId,
          appliedBy: userId,
        });
      }
    }

    revalidatePath(`/admin/${collection}`);
    revalidatePath(`/admin/${collection}/${contactId}`);
    return { success: true };
  } catch (error: any) {
    console.error('Remove tags error:', error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}

/**
 * Bulk applies tags to multiple contacts
 * Processes contacts in chunks of 100 for better progress granularity (NFR1.2).
 * Each chunk is committed atomically; if a chunk fails the error is recorded and
 * remaining chunks continue (partial-failure handling, NFR4.3).
 */
export async function bulkApplyTagsAction(
  contactIds: string[],
  contactType: 'school' | 'prospect',
  tagIds: string[],
  userId: string,
  userName?: string,
  onProgress?: (processed: number, total: number) => void
): Promise<{
  success: boolean;
  processedCount?: number;
  failedCount?: number;
  errors?: string[];
  partialFailures?: string[];
  error?: string;
}> {
  const parsed = BulkTagSchema.safeParse({ contactIds, contactType, tagIds, userId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const collection = contactType === 'school' ? 'schools' : 'prospects';
    const timestamp = new Date().toISOString();
    const batchSize = 100;
    let processedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const total = contactIds.length;
    const partialFailures: string[] = [];

    for (let i = 0; i < contactIds.length; i += batchSize) {
      const chunk = contactIds.slice(i, i + batchSize);
      const batch = adminDb.batch();
      const chunkProcessed: string[] = [];

      for (const contactId of chunk) {
        try {
          const contactRef = adminDb.collection(collection).doc(contactId);
          const contactSnap = await contactRef.get();
          if (!contactSnap.exists) continue;

          const data = contactSnap.data()!;
          const existingTags = new Set<string>(data.tags || []);
          const taggedAt: Record<string, string> = { ...data.taggedAt };
          const taggedBy: Record<string, string> = { ...data.taggedBy };

          tagIds.forEach(tagId => {
            if (!existingTags.has(tagId)) {
              existingTags.add(tagId);
              taggedAt[tagId] = timestamp;
              taggedBy[tagId] = userId;
            }
          });

          batch.update(contactRef, {
            tags: Array.from(existingTags),
            taggedAt,
            taggedBy
          });

          chunkProcessed.push(contactId);
        } catch (readErr: any) {
          partialFailures.push(contactId);
          failedCount++;
        }
      }

      // Commit this chunk atomically; on failure record the error and continue
      try {
        await batch.commit();
        processedCount += chunkProcessed.length;
      } catch (commitErr: any) {
        const msg = `Batch commit failed for contacts ${i}–${i + chunk.length - 1}: ${commitErr.message}`;
        console.error('bulkApplyTagsAction batch error:', commitErr);
        errors.push(msg);
        failedCount += chunkProcessed.length;
        partialFailures.push(...chunkProcessed);
      }

      onProgress?.(processedCount, total);
    }

    // Update tag usage counts — chunk to stay within the 500-op batch limit
    const usageBatchSize = 500;
    for (let i = 0; i < tagIds.length; i += usageBatchSize) {
      const usageBatch = adminDb.batch();
      const tagChunk = tagIds.slice(i, i + usageBatchSize);
      for (const tagId of tagChunk) {
        usageBatch.update(adminDb.collection('tags').doc(tagId), {
          usageCount: FieldValue.increment(processedCount)
        });
      }
      try {
        await usageBatch.commit();
      } catch (usageErr: any) {
        console.error('bulkApplyTagsAction usage count update error:', usageErr);
        errors.push(`Usage count update failed: ${usageErr.message}`);
      }
    }

    // Log bulk audit entry
    if (tagIds.length > 0) {
      const firstTagSnap = await adminDb.collection('tags').doc(tagIds[0]).get();
      const firstTag = firstTagSnap.data() as Tag | undefined;
      await logTagAudit({
        workspaceId: firstTag?.workspaceId || '',
        action: 'applied',
        tagId: tagIds[0],
        tagName: tagIds.length === 1 ? (firstTag?.name || tagIds[0]) : `${tagIds.length} tags`,
        userId,
        userName,
        metadata: { bulkOperation: true, affectedCount: processedCount, tagIds, failedCount, errors: errors.length }
      });
    }

    revalidatePath(`/admin/${collection}`);
    return { success: true, processedCount, failedCount, errors, partialFailures };
  } catch (error: any) {
    console.error('Bulk apply tags error:', error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}

/**
 * Bulk removes tags from multiple contacts
 * Processes contacts in chunks of 100 for better progress granularity (NFR1.2).
 * Each chunk is committed atomically; if a chunk fails the error is recorded and
 * remaining chunks continue (partial-failure handling, NFR4.3).
 */
export async function bulkRemoveTagsAction(
  contactIds: string[],
  contactType: 'school' | 'prospect',
  tagIds: string[],
  userId: string,
  userName?: string,
  onProgress?: (processed: number, total: number) => void
): Promise<{
  success: boolean;
  processedCount?: number;
  failedCount?: number;
  errors?: string[];
  partialFailures?: string[];
  error?: string;
}> {
  const parsed = BulkTagSchema.safeParse({ contactIds, contactType, tagIds, userId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const collection = contactType === 'school' ? 'schools' : 'prospects';
    const batchSize = 100;
    let processedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const total = contactIds.length;
    const partialFailures: string[] = [];

    for (let i = 0; i < contactIds.length; i += batchSize) {
      const chunk = contactIds.slice(i, i + batchSize);
      const batch = adminDb.batch();
      const chunkProcessed: string[] = [];

      for (const contactId of chunk) {
        try {
          const contactRef = adminDb.collection(collection).doc(contactId);
          const contactSnap = await contactRef.get();
          if (!contactSnap.exists) continue;

          const data = contactSnap.data()!;
          const taggedAt: Record<string, string> = { ...data.taggedAt };
          const taggedBy: Record<string, string> = { ...data.taggedBy };

          const remainingTags = (data.tags || []).filter((t: string) => !tagIds.includes(t));
          tagIds.forEach(tagId => {
            delete taggedAt[tagId];
            delete taggedBy[tagId];
          });

          batch.update(contactRef, { tags: remainingTags, taggedAt, taggedBy });
          chunkProcessed.push(contactId);
        } catch (readErr: any) {
          partialFailures.push(contactId);
          failedCount++;
        }
      }

      // Commit this chunk atomically; on failure record the error and continue
      try {
        await batch.commit();
        processedCount += chunkProcessed.length;
      } catch (commitErr: any) {
        const msg = `Batch commit failed for contacts ${i}–${i + chunk.length - 1}: ${commitErr.message}`;
        console.error('bulkRemoveTagsAction batch error:', commitErr);
        errors.push(msg);
        failedCount += chunkProcessed.length;
        partialFailures.push(...chunkProcessed);
      }

      onProgress?.(processedCount, total);
    }

    // Decrement tag usage counts — chunk to stay within the 500-op batch limit
    const usageBatchSize = 500;
    for (let i = 0; i < tagIds.length; i += usageBatchSize) {
      const usageBatch = adminDb.batch();
      const tagChunk = tagIds.slice(i, i + usageBatchSize);
      for (const tagId of tagChunk) {
        usageBatch.update(adminDb.collection('tags').doc(tagId), {
          usageCount: FieldValue.increment(-processedCount)
        });
      }
      try {
        await usageBatch.commit();
      } catch (usageErr: any) {
        console.error('bulkRemoveTagsAction usage count update error:', usageErr);
        errors.push(`Usage count update failed: ${usageErr.message}`);
      }
    }

    // Log bulk audit entry
    if (tagIds.length > 0) {
      const firstTagSnap = await adminDb.collection('tags').doc(tagIds[0]).get();
      const firstTag = firstTagSnap.data() as Tag | undefined;
      await logTagAudit({
        workspaceId: firstTag?.workspaceId || '',
        action: 'removed',
        tagId: tagIds[0],
        tagName: tagIds.length === 1 ? (firstTag?.name || tagIds[0]) : `${tagIds.length} tags`,
        userId,
        userName,
        metadata: { bulkOperation: true, affectedCount: processedCount, tagIds, failedCount, errors: errors.length }
      });
    }

    revalidatePath(`/admin/${collection}`);
    return { success: true, processedCount, failedCount, errors, partialFailures };
  } catch (error: any) {
    console.error('Bulk remove tags error:', error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}

/**
 * Queries contacts by tag filter with AND/OR/NOT logic
 * 
 * - OR logic: uses array-contains-any (up to 10 tags)
 * - AND logic: queries for first tag, then filters client-side for remaining tags
 * - NOT logic: gets all contact IDs in workspace, subtracts those with any of the tags
 * - categoryFilter: resolves tag IDs in that category first, then intersects with provided tagIds
 * 
 * Requirements: FR3.1.1, FR3.1.2, FR3.1.3
 */
export async function getContactsByTagsAction(
  workspaceId: string,
  filter: import('./types').TagFilterQuery
): Promise<{ success: boolean; data?: string[]; error?: string }> {
  try {
    const { tagIds, logic, categoryFilter } = filter;

    if (!workspaceId) {
      return { success: false, error: 'workspaceId is required' };
    }

    if (!tagIds || tagIds.length === 0) {
      return { success: true, data: [] };
    }

    // Resolve effective tag IDs when categoryFilter is set
    let effectiveTagIds = tagIds;
    if (categoryFilter) {
      const categoryTagsSnap = await adminDb
        .collection('tags')
        .where('workspaceId', '==', workspaceId)
        .where('category', '==', categoryFilter)
        .get();

      const categoryTagIds = new Set(categoryTagsSnap.docs.map(d => d.id));
      effectiveTagIds = tagIds.filter(id => categoryTagIds.has(id));

      // If no tags match the category filter, return empty result
      if (effectiveTagIds.length === 0) {
        return { success: true, data: [] };
      }
    }

    const contactIds = new Set<string>();

    if (logic === 'OR') {
      // array-contains-any supports up to 10 values; chunk if needed
      const chunkSize = 10;
      for (let i = 0; i < effectiveTagIds.length; i += chunkSize) {
        const chunk = effectiveTagIds.slice(i, i + chunkSize);

        const [schoolsSnap, prospectsSnap] = await Promise.all([
          adminDb
            .collection('schools')
            .where('workspaceIds', 'array-contains', workspaceId)
            .where('tags', 'array-contains-any', chunk)
            .get(),
          adminDb
            .collection('prospects')
            .where('workspaceId', '==', workspaceId)
            .where('tags', 'array-contains-any', chunk)
            .get(),
        ]);

        schoolsSnap.docs.forEach(d => contactIds.add(d.id));
        prospectsSnap.docs.forEach(d => contactIds.add(d.id));
      }

    } else if (logic === 'AND') {
      // Query for the first tag, then filter client-side for the rest
      const [firstSchoolsSnap, firstProspectsSnap] = await Promise.all([
        adminDb
          .collection('schools')
          .where('workspaceIds', 'array-contains', workspaceId)
          .where('tags', 'array-contains', effectiveTagIds[0])
          .get(),
        adminDb
          .collection('prospects')
          .where('workspaceId', '==', workspaceId)
          .where('tags', 'array-contains', effectiveTagIds[0])
          .get(),
      ]);

      const remainingTagIds = effectiveTagIds.slice(1);

      const filterByAllTags = (docTags: string[]) =>
        remainingTagIds.every(tagId => docTags.includes(tagId));

      firstSchoolsSnap.docs.forEach(d => {
        const docTags: string[] = d.data().tags || [];
        if (filterByAllTags(docTags)) contactIds.add(d.id);
      });

      firstProspectsSnap.docs.forEach(d => {
        const docTags: string[] = d.data().tags || [];
        if (filterByAllTags(docTags)) contactIds.add(d.id);
      });

    } else if (logic === 'NOT') {
      // Get all contact IDs in workspace, then subtract those with any of the tags
      const [allSchoolsSnap, allProspectsSnap] = await Promise.all([
        adminDb
          .collection('schools')
          .where('workspaceIds', 'array-contains', workspaceId)
          .get(),
        adminDb
          .collection('prospects')
          .where('workspaceId', '==', workspaceId)
          .get(),
      ]);

      // Collect IDs of contacts that have ANY of the excluded tags
      const excludedIds = new Set<string>();
      const effectiveTagSet = new Set(effectiveTagIds);

      allSchoolsSnap.docs.forEach(d => {
        const docTags: string[] = d.data().tags || [];
        if (docTags.some(t => effectiveTagSet.has(t))) {
          excludedIds.add(d.id);
        } else {
          contactIds.add(d.id);
        }
      });

      allProspectsSnap.docs.forEach(d => {
        const docTags: string[] = d.data().tags || [];
        if (docTags.some(t => effectiveTagSet.has(t))) {
          excludedIds.add(d.id);
        } else {
          contactIds.add(d.id);
        }
      });
    }

    return { success: true, data: Array.from(contactIds) };
  } catch (error: any) {
    console.error('getContactsByTagsAction error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Gets tag usage statistics for a workspace.
 * Calculates usage count per tag, trend direction, and campaign/automation usage.
 * Requirements: FR6.1.1, FR6.1.2
 */
export async function getTagUsageStatsAction(workspaceId: string): Promise<{
  success: boolean;
  data?: import('./types').TagUsageStats[];
  error?: string;
}> {
  try {
    const tagsSnap = await adminDb
      .collection('tags')
      .where('workspaceId', '==', workspaceId)
      .get();

    if (tagsSnap.empty) {
      return { success: true, data: [] };
    }

    // Get recent audit logs to determine trend (last 30 days vs prior 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const recentLogsSnap = await adminDb
      .collection('tag_audit_logs')
      .where('workspaceId', '==', workspaceId)
      .where('action', '==', 'applied')
      .where('timestamp', '>=', sixtyDaysAgo)
      .get();

    // Count recent (last 30d) vs prior (30-60d) applications per tag
    const recentCounts: Record<string, number> = {};
    const priorCounts: Record<string, number> = {};

    recentLogsSnap.docs.forEach(doc => {
      const log = doc.data();
      const tagId = log.tagId as string;
      if (log.timestamp >= thirtyDaysAgo) {
        recentCounts[tagId] = (recentCounts[tagId] || 0) + 1;
      } else {
        priorCounts[tagId] = (priorCounts[tagId] || 0) + 1;
      }
    });

    // Get last used timestamps from audit logs
    const lastUsedMap: Record<string, string> = {};
    recentLogsSnap.docs.forEach(doc => {
      const log = doc.data();
      const tagId = log.tagId as string;
      if (!lastUsedMap[tagId] || log.timestamp > lastUsedMap[tagId]) {
        lastUsedMap[tagId] = log.timestamp as string;
      }
    });

    // Count campaign usage (message logs referencing tags)
    const campaignUsageMap: Record<string, number> = {};
    try {
      const campaignLogsSnap = await adminDb
        .collection('message_logs')
        .where('workspaceIds', 'array-contains', workspaceId)
        .where('status', '==', 'sent')
        .limit(500)
        .get();

      campaignLogsSnap.docs.forEach(doc => {
        const vars = doc.data().variables || {};
        const tagList: string[] = vars.tag_ids || [];
        tagList.forEach((tagId: string) => {
          campaignUsageMap[tagId] = (campaignUsageMap[tagId] || 0) + 1;
        });
      });
    } catch {
      // Campaign usage is best-effort
    }

    // Count automation usage
    const automationUsageMap: Record<string, number> = {};
    try {
      const automationsSnap = await adminDb
        .collection('automations')
        .where('workspaceIds', 'array-contains', workspaceId)
        .where('isActive', '==', true)
        .get();

      automationsSnap.docs.forEach(doc => {
        const automation = doc.data();
        const nodes: any[] = automation.nodes || [];
        nodes.forEach(node => {
          const tagIds: string[] = node?.data?.tagIds || [];
          tagIds.forEach((tagId: string) => {
            automationUsageMap[tagId] = (automationUsageMap[tagId] || 0) + 1;
          });
        });
      });
    } catch {
      // Automation usage is best-effort
    }

    const stats: import('./types').TagUsageStats[] = tagsSnap.docs.map(doc => {
      const tag = doc.data() as Tag;
      const tagId = doc.id;
      const recent = recentCounts[tagId] || 0;
      const prior = priorCounts[tagId] || 0;

      let trendDirection: 'up' | 'down' | 'stable' = 'stable';
      if (recent > prior) trendDirection = 'up';
      else if (recent < prior) trendDirection = 'down';

      return {
        tagId,
        tagName: tag.name,
        contactCount: tag.usageCount || 0,
        lastUsed: lastUsedMap[tagId] || tag.updatedAt,
        trendDirection,
        campaignUsage: campaignUsageMap[tagId] || 0,
        automationUsage: automationUsageMap[tagId] || 0,
      };
    });

    // Sort by contactCount descending
    stats.sort((a, b) => b.contactCount - a.contactCount);

    return { success: true, data: stats };
  } catch (error: any) {
    console.error('getTagUsageStatsAction error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Bulk deletes unused tags (usageCount === 0) for a workspace.
 * Requirements: FR7.1.1, FR7.1.2
 */
export async function bulkDeleteUnusedTagsAction(
  workspaceId: string,
  userId: string,
  userName?: string
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const unusedSnap = await adminDb
      .collection('tags')
      .where('workspaceId', '==', workspaceId)
      .where('usageCount', '==', 0)
      .where('isSystem', '==', false)
      .get();

    if (unusedSnap.empty) {
      return { success: true, deletedCount: 0 };
    }

    const batchSize = 500;
    let deletedCount = 0;

    for (let i = 0; i < unusedSnap.docs.length; i += batchSize) {
      const batch = adminDb.batch();
      const chunk = unusedSnap.docs.slice(i, i + batchSize);
      chunk.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });
      await batch.commit();
    }

    await logTagAudit({
      workspaceId,
      action: 'deleted',
      tagId: 'bulk_cleanup',
      tagName: `${deletedCount} unused tags`,
      userId,
      userName,
      metadata: { bulkOperation: true, affectedCount: deletedCount },
    });

    revalidatePath('/admin/contacts/tags');
    return { success: true, deletedCount };
  } catch (error: any) {
    console.error('bulkDeleteUnusedTagsAction error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Gets tag audit logs for a workspace with optional filters.
 * Requirements: FR7.3.1, FR7.3.2, FR7.3.3
 */
export async function getTagAuditLogsAction(
  workspaceId: string,
  filters?: {
    tagId?: string;
    contactId?: string;
    userId?: string;
    action?: TagAuditLog['action'];
    startDate?: string;
    endDate?: string;
    limit?: number;
  }
): Promise<{ success: boolean; data?: TagAuditLog[]; error?: string }> {
  try {
    let q = adminDb
      .collection('tag_audit_logs')
      .where('workspaceId', '==', workspaceId) as FirebaseFirestore.Query;

    if (filters?.tagId) {
      q = q.where('tagId', '==', filters.tagId);
    }
    if (filters?.contactId) {
      q = q.where('contactId', '==', filters.contactId);
    }
    if (filters?.userId) {
      q = q.where('userId', '==', filters.userId);
    }
    if (filters?.action) {
      q = q.where('action', '==', filters.action);
    }
    if (filters?.startDate) {
      q = q.where('timestamp', '>=', filters.startDate);
    }
    if (filters?.endDate) {
      q = q.where('timestamp', '<=', filters.endDate);
    }

    q = q.orderBy('timestamp', 'desc').limit(filters?.limit || 100);

    const snap = await q.get();
    const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TagAuditLog[];

    return { success: true, data: logs };
  } catch (error: any) {
    console.error('getTagAuditLogsAction error:', error);
    return { success: false, error: error.message };
  }
}
