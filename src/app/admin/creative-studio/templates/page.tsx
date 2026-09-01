/**
 * ARCHITECTURE:
 * Template Marketplace Page (Phase 5)
 * 
 * Server Component fetching accessible global and workspace templates.
 */

import { listCreativeTemplatesAction } from '@/app/actions/creative-template-actions';
import { TemplatesClient } from './TemplatesClient';

export default async function TemplatesPage() {
  const workspaceId = 'default-workspace';
  const res = await listCreativeTemplatesAction(workspaceId);
  const templates = res.success && res.data ? res.data : [];

  return <TemplatesClient initialTemplates={templates} workspaceId={workspaceId} />;
}
