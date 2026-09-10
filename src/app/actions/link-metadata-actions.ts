'use server';

import { getLinkMetadata as getLinkMetadataFlow } from '@/ai/flows/get-link-metadata-flow';
import { getErrorMessage } from '@/lib/errors/report-error';

export async function getLinkMetadataAction(url: string) {
  try {
    const metadata = await getLinkMetadataFlow({ url });
    return { success: true, metadata };
  } catch (error: unknown) {
    console.error('Error fetching link metadata:', error);
    return { success: false, error: getErrorMessage(error) || 'Failed to fetch metadata' };
  }
}
