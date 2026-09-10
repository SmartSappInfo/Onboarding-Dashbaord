'use server';

import { generateKeywords } from '@/ai/flows/generate-keywords-flow';
import { getErrorMessage } from '@/lib/errors/report-error';

export async function generateKeywordsAction(title: string, description: string, organizationId?: string) {
  try {
    if (!title || !description) {
      return { success: false, error: 'Title and description are required to generate keywords.' };
    }
    const result = await generateKeywords({ title, description, organizationId });
    return { success: true, keywords: result.keywords || [] };
  } catch (error: unknown) {
    console.error('Error in generateKeywordsAction:', error);
    return { success: false, error: getErrorMessage(error) || 'Failed to generate keywords via AI.' };
  }
}
