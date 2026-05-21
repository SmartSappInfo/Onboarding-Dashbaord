import { z } from 'zod';
import type { Tag } from './types';

const TAG_CATEGORIES = [
  'behavioral',
  'demographic',
  'interest',
  'status',
  'lifecycle',
  'engagement',
  'custom',
] as const;

export const CreateTagSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  name: z
    .string()
    .min(1, 'Tag name is required')
    .max(50, 'Tag name must be 50 characters or less'),
  description: z
    .string()
    .max(200, 'Description must be 200 characters or less')
    .optional(),
  category: z.enum(TAG_CATEGORIES, {
    errorMap: () => ({ message: 'Invalid tag category' }),
  }),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g. #FF0000)'),
  userId: z.string().min(1, 'User ID is required'),
  userName: z.string().optional(),
});

export const UpdateTagSchema = z.object({
  name: z
    .string()
    .min(1, 'Tag name is required')
    .max(50, 'Tag name must be 50 characters or less')
    .optional(),
  description: z
    .string()
    .max(200, 'Description must be 200 characters or less')
    .optional(),
  category: z
    .enum(TAG_CATEGORIES, {
      errorMap: () => ({ message: 'Invalid tag category' }),
    })
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g. #FF0000)')
    .optional(),
});

export const ApplyTagsSchema = z.object({
  contactId: z.string().min(1, 'Contact ID is required'),
  contactType: z.enum(['school', 'prospect', 'workspace_entity', 'entity'], {
    errorMap: () => ({ message: 'Contact type must be "school", "prospect", "workspace_entity", or "entity"' }),
  }),
  tagIds: z.array(z.string().min(1)).min(1, 'At least one tag ID is required'),
  userId: z.string().min(1, 'User ID is required'),
});

export const BulkTagSchema = z.object({
  contactIds: z.array(z.string().min(1)).min(1, 'At least one contact ID is required'),
  contactType: z.enum(['school', 'prospect', 'workspace_entity', 'entity'], {
    errorMap: () => ({ message: 'Contact type must be "school", "prospect", "workspace_entity", or "entity"' }),
  }),
  tagIds: z.array(z.string().min(1)).min(1, 'At least one tag ID is required'),
  userId: z.string().min(1, 'User ID is required'),
});

export const MergeTagsSchema = z.object({
  sourceTagIds: z.array(z.string().min(1)).min(1, 'At least one source tag ID is required'),
  targetTagId: z.string().min(1, 'Target tag ID is required'),
  userId: z.string().min(1, 'User ID is required'),
});

/**
 * Shared factory helper to construct a fully populated Tag document structure.
 * Ensures consistent tag records across manual creation, bulk imports, and migrations.
 */
export function buildTagDocument(params: {
  id: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  category?: string;
  color?: string;
  createdBy: string;
}): Tag {
  const slug = params.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  return {
    id: params.id,
    workspaceId: params.workspaceId,
    organizationId: params.organizationId,
    name: params.name.trim(),
    slug,
    category: (params.category || 'custom') as any,
    color: params.color || '#94a3b8',
    description: '',
    isSystem: false,
    usageCount: 0,
    scope: 'workspace',
    createdBy: params.createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
