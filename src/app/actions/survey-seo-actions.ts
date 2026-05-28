'use server';

import { generateKeywords } from '@/ai/flows/generate-keywords-flow';

export async function generateKeywordsAction(title: string, description: string, organizationId?: string) {
  try {
    if (!title || !description) {
      return { success: false, error: 'Title and description are required to generate keywords.' };
    }
    const result = await generateKeywords({ title, description, organizationId });
    return { success: true, keywords: result.keywords || [] };
  } catch (error: any) {
    console.error('Error in generateKeywordsAction:', error);
    return { success: false, error: error.message || 'Failed to generate keywords via AI.' };
  }
}
