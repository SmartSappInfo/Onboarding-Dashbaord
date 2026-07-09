'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { PageBlock, PageSection, CampaignPageVersion } from '@/lib/types';

export interface MigrationResult {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: string[];
}

function migrateBlock(block: PageBlock): PageBlock {
  if (block.type === 'testimonial') {
    const props = block.props;
    const containerId = `migrated-container-${block.id}`;
    
    const decomposedBlocks: PageBlock[] = [];
    
    // 1. Video block
    if (props.videoUrl) {
      decomposedBlocks.push({
        id: `migrated-video-${block.id}`,
        type: 'video',
        props: {
          url: props.videoUrl,
          provider: 'youtube',
          thumbnailUrl: props.thumbnailUrl || '',
          playMode: props.playMode || 'inline'
        }
      });
    }
    
    // 2. Quote block
    decomposedBlocks.push({
      id: `migrated-quote-${block.id}`,
      type: 'text',
      props: {
        content: `<p class="text-base italic font-semibold text-center text-slate-800 dark:text-slate-200">"${props.quote || 'Add a testimonial quote…'}"</p>`
      }
    });
    
    // 3. Divider block
    decomposedBlocks.push({
      id: `migrated-divider-${block.id}`,
      type: 'divider',
      props: {
        style: 'solid'
      }
    });
    
    // 4. Columns block (Avatar + Author details)
    const leftBlocks: PageBlock[] = [];
    if (props.avatarUrl) {
      leftBlocks.push({
        id: `migrated-avatar-${block.id}`,
        type: 'image',
        props: {
          src: props.avatarUrl,
          alt: (props.author as string) || 'Avatar',
          width: 'small',
          borderRadius: 'circle',
          alignment: 'right'
        }
      });
    }
    
    const rightBlocks: PageBlock[] = [];
    if (props.author || props.role) {
      rightBlocks.push({
        id: `migrated-author-${block.id}`,
        type: 'text',
        props: {
          content: `<div class="text-left leading-tight pt-1"><p class="text-xs font-black text-slate-900 dark:text-slate-100">${props.author || 'Author Name'}</p>${props.role ? `<p class="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">${props.role}</p>` : ''}</div>`
        }
      });
    }

    decomposedBlocks.push({
      id: `migrated-columns-${block.id}`,
      type: 'columns',
      props: {
        variant: '1-1',
        gap: 16
      },
      blocks: [
        ...leftBlocks,
        ...rightBlocks
      ]
    });

    return {
      id: containerId,
      type: 'container',
      props: {
        maxWidth: 'sm',
        padding: 24,
        background: 'transparent'
      },
      blocks: decomposedBlocks
    };
  }
  
  if (block.blocks && block.blocks.length > 0) {
    return {
      ...block,
      blocks: block.blocks.map(migrateBlock)
    };
  }
  
  return block;
}

function hasTestimonialBlock(block: PageBlock): boolean {
  if (block.type === 'testimonial') return true;
  if (block.blocks && block.blocks.length > 0) {
    return block.blocks.some(hasTestimonialBlock);
  }
  return false;
}

export async function fetchOutdatedCampaignPages(): Promise<string[]> {
  try {
    const versionsSnapshot = await adminDb.collection('page_versions').get();
    const outdatedVersionIds: string[] = [];

    for (const doc of versionsSnapshot.docs) {
      const version = doc.data() as CampaignPageVersion;
      if (version.structureJson?.sections) {
        const needsMigration = version.structureJson.sections.some(section =>
          section.blocks.some(hasTestimonialBlock)
        );
        if (needsMigration) {
          outdatedVersionIds.push(doc.id);
        }
      }
    }

    return outdatedVersionIds;
  } catch (error) {
    console.error('Error fetching outdated campaign pages:', error);
    return [];
  }
}

export async function migrateLegacyTestimonialBlocksAction(
  versionIds?: string[]
): Promise<MigrationResult> {
  const result: MigrationResult = {
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  try {
    const targetIds = versionIds || (await fetchOutdatedCampaignPages());
    result.total = targetIds.length;

    if (result.total === 0) {
      return result;
    }

    for (const id of targetIds) {
      try {
        const docRef = adminDb.collection('page_versions').doc(id);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
          result.skipped++;
          continue;
        }

        const version = docSnap.data() as CampaignPageVersion;
        if (!version.structureJson?.sections) {
          result.skipped++;
          continue;
        }

        const migratedSections: PageSection[] = version.structureJson.sections.map(section => ({
          ...section,
          blocks: section.blocks.map(migrateBlock)
        }));

        await docRef.update({
          'structureJson.sections': migratedSections
        });

        result.succeeded++;
      } catch (err) {
        result.failed++;
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Version ${id} failed: ${errMsg}`);
      }
    }

    return result;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Global migration error: ${errMsg}`);
    return result;
  }
}
