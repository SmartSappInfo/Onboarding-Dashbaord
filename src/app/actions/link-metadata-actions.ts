'use server';

import { getLinkMetadata as getLinkMetadataFlow } from '@/ai/flows/get-link-metadata-flow';

export async function getLinkMetadataAction(url: string) {
  try {
    const metadata = await getLinkMetadataFlow({ url });
    return { success: true, metadata };
  } catch (error: any) {
    console.error('Error fetching link metadata:', error);
    return { success: false, error: error.message || 'Failed to fetch metadata' };
  }
}
