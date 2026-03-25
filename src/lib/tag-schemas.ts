import { z } from 'zod';

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
  contactType: z.enum(['school', 'prospect'], {
    errorMap: () => ({ message: 'Contact type must be "school" or "prospect"' }),
  }),
  tagIds: z.array(z.string().min(1)).min(1, 'At least one tag ID is required'),
  userId: z.string().min(1, 'User ID is required'),
});

export const BulkTagSchema = z.object({
  contactIds: z.array(z.string().min(1)).min(1, 'At least one contact ID is required'),
  contactType: z.enum(['school', 'prospect'], {
    errorMap: () => ({ message: 'Contact type must be "school" or "prospect"' }),
  }),
  tagIds: z.array(z.string().min(1)).min(1, 'At least one tag ID is required'),
  userId: z.string().min(1, 'User ID is required'),
});

export const MergeTagsSchema = z.object({
  sourceTagIds: z.array(z.string().min(1)).min(1, 'At least one source tag ID is required'),
  targetTagId: z.string().min(1, 'Target tag ID is required'),
  userId: z.string().min(1, 'User ID is required'),
});
