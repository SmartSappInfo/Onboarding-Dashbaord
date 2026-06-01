'use server';

import { adminDb } from './firebase-admin';
import type { MessageTemplate, MessageBlock } from './types';

/**
 * Parses plain text or HTML legacy content into blocks for the rich builder.
 */
function parseBodyToBlocks(body: string, contentMode: string): MessageBlock[] {
    if (!body) return [];
    
    const timestamp = Date.now();
    
    if (contentMode === 'html_code') {
        // Strip tags but preserve structure where possible by replacing block tags with newlines
        let structuredText = body
            .replace(/<p[^>]*>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<div[^>]*>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<h[1-6][^>]*>/gi, '\n# ')
            .replace(/<\/h[1-6]>/gi, '\n')
            .replace(/<li[^>]*>/gi, '\n* ')
            .replace(/<[^>]+>/g, '') // Strip remaining tags
            .trim();
            
        return parsePlainTextToBlocks(structuredText, timestamp);
    } else {
        return parsePlainTextToBlocks(body, timestamp);
    }
}

/**
 * Helper to parse plain text body into structured layout blocks (Headings, Text paragraphs, and CTA Buttons)
 */
function parsePlainTextToBlocks(text: string, timestamp: number): MessageBlock[] {
    const paragraphs = text.split(/\n\s*\n/);
    const blocks: MessageBlock[] = [];
    
    paragraphs.forEach((para, index) => {
        const content = para.trim();
        if (!content) return;
        
        // 1. Detect Heading
        const isHeading = content.startsWith('#') || (index === 0 && content.length < 60 && !content.includes('.') && !content.includes(','));
        const cleanContent = content.startsWith('#') ? content.replace(/^#+\s*/, '') : content;
        
        if (isHeading) {
            blocks.push({
                id: `block_${timestamp}_${index}`,
                type: 'heading',
                title: cleanContent,
                variant: 'h2',
                style: {
                    textAlign: 'left',
                    fontWeight: 'bold',
                    marginTop: '16px',
                    marginBottom: '8px'
                }
            });
            return;
        }

        // 2. Detect Bullet points
        if (content.startsWith('*') || content.startsWith('-') || /^\d+\./.test(content)) {
            const items = content.split('\n')
                .map(line => line.replace(/^[\*\-\d+\.]\s*/, '').trim())
                .filter(Boolean);
                
            if (items.length > 0) {
                blocks.push({
                    id: `block_${timestamp}_${index}`,
                    type: 'list',
                    listStyle: content.startsWith('*') || content.startsWith('-') ? 'unordered' : 'ordered',
                    items: items,
                    style: {
                        marginTop: '8px',
                        marginBottom: '8px'
                    }
                });
                return;
            }
        }

        // 3. Detect CTA / Link matching
        const linkMatch = content.match(/(?:click here|view details|link|sign here|join link|here|status|action):\s*(https?:\/\/\S+|\{\{\S+\}\})/i);
        if (linkMatch) {
            const url = linkMatch[1];
            const buttonText = content.replace(linkMatch[0], '').replace(/[:,\s]+$/, '').trim() || 'Click Here';
            blocks.push({
                id: `block_${timestamp}_${index}`,
                type: 'button',
                title: buttonText,
                url: url,
                style: {
                    textAlign: 'center',
                    marginTop: '20px',
                    marginBottom: '20px',
                    backgroundColor: '#3B5FFF',
                    color: '#ffffff',
                    borderRadius: '8px'
                }
            });
            return;
        }

        // 4. Default to standard text block
        blocks.push({
            id: `block_${timestamp}_${index}`,
            type: 'text',
            content: content,
            style: {
                textAlign: 'left',
                lineHeight: '1.6',
                marginTop: '8px',
                marginBottom: '8px'
            }
        });
    });
    
    return blocks;
}

/**
 * Runs the migration for all legacy email templates across all workspaces.
 */
export async function migrateLegacyTemplatesToBlocks(): Promise<{ success: boolean; migrated: number; total: number; error?: string }> {
    try {
        const templatesSnap = await adminDb.collection('message_templates').get();
        let migratedCount = 0;
        let totalCount = templatesSnap.size;
        
        const batch = adminDb.batch();
        const timestamp = new Date().toISOString();
        
        templatesSnap.docs.forEach(doc => {
            const template = doc.data() as MessageTemplate;
            
            // Only migrate email templates that are not currently rich builder based
            if (template.channel === 'email' && template.contentMode !== 'rich_builder') {
                const parsedBlocks = parseBodyToBlocks(template.body || '', template.contentMode || 'plain_text');
                
                batch.update(doc.ref, {
                    blocks: parsedBlocks,
                    contentMode: 'rich_builder',
                    updatedAt: timestamp,
                    migrationNote: 'Auto-migrated from legacy plain/HTML body via FER protocol'
                });
                
                migratedCount++;
            }
        });
        
        if (migratedCount > 0) {
            await batch.commit();
        }
        
        console.log(`[MIGRATION] Successfully upgraded ${migratedCount} of ${totalCount} templates.`);
        return { success: true, migrated: migratedCount, total: totalCount };
    } catch (e: any) {
        console.error('[MIGRATION] Upgrade failed:', e);
        return { success: false, migrated: 0, total: 0, error: e.message };
    }
}
