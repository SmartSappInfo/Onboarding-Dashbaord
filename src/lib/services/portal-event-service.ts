/**
 * {{Org_name}} Experience Platform — Portal Domain Event Service
 *
 * Dispatches domain events for all portal lifecycle actions (creation, updates,
 * publication, suspension, and visits) into the SmartSapp Activity Log & Automation Event Bus.
 *
 * Architecture Notes:
 * - Strictly typed (Zero any / any[]).
 * - Scoped to organizationId and workspaceId.
 * - Non-blocking execution using safe async wrappers.
 */

import { logActivity } from '../activity-logger';
import type { Portal } from '../types/portal';

export class PortalEventService {
  /**
   * Emits portal.created event when a new portal is initialized.
   */
  static async emitPortalCreated(portal: Portal, userId: string): Promise<void> {
    try {
      await logActivity({
        userId,
        organizationId: portal.organizationId,
        workspaceId: portal.workspaceIds[0] || 'default',
        type: 'status_change',
        source: 'portal_engine',
        description: `Portal "${portal.name}" created (${portal.primaryMode} mode)`,
        metadata: {
          event: 'portal.created',
          portalId: portal.id,
          name: portal.name,
          slug: portal.slug,
          primaryMode: portal.primaryMode,
          status: portal.status,
          workspaceIds: portal.workspaceIds,
        },
      });
    } catch (err) {
      console.error('[PORTAL_EVENT] Failed to emit portal.created:', err);
    }
  }

  /**
   * Emits portal.updated event when configuration or branding changes.
   */
  static async emitPortalUpdated(
    portal: Portal,
    changedFields: string[],
    userId: string
  ): Promise<void> {
    try {
      await logActivity({
        userId,
        organizationId: portal.organizationId,
        workspaceId: portal.workspaceIds[0] || 'default',
        type: 'status_change',
        source: 'portal_engine',
        description: `Portal "${portal.name}" updated (Changed: ${changedFields.join(', ')})`,
        metadata: {
          event: 'portal.updated',
          portalId: portal.id,
          name: portal.name,
          slug: portal.slug,
          changedFields,
          updatedAt: portal.updatedAt,
        },
      });
    } catch (err) {
      console.error('[PORTAL_EVENT] Failed to emit portal.updated:', err);
    }
  }

  /**
   * Emits portal.published event when portal is made publicly available.
   */
  static async emitPortalPublished(portal: Portal, userId: string): Promise<void> {
    try {
      await logActivity({
        userId,
        organizationId: portal.organizationId,
        workspaceId: portal.workspaceIds[0] || 'default',
        type: 'status_change',
        source: 'portal_engine',
        description: `Portal "${portal.name}" published at /portal/${portal.slug}`,
        metadata: {
          event: 'portal.published',
          portalId: portal.id,
          name: portal.name,
          slug: portal.slug,
          visibility: portal.visibility,
          publishedAt: portal.publishedAt || new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error('[PORTAL_EVENT] Failed to emit portal.published:', err);
    }
  }

  /**
   * Emits portal.suspended event when admin takes a portal offline.
   */
  static async emitPortalSuspended(
    portal: Portal,
    reason: string,
    userId: string
  ): Promise<void> {
    try {
      await logActivity({
        userId,
        organizationId: portal.organizationId,
        workspaceId: portal.workspaceIds[0] || 'default',
        type: 'status_change',
        source: 'portal_engine',
        description: `Portal "${portal.name}" suspended. Reason: ${reason}`,
        metadata: {
          event: 'portal.suspended',
          portalId: portal.id,
          name: portal.name,
          slug: portal.slug,
          reason,
          suspendedAt: portal.suspendedAt || new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error('[PORTAL_EVENT] Failed to emit portal.suspended:', err);
    }
  }

  /**
   * Emits portal.archived event.
   */
  static async emitPortalArchived(portal: Portal, userId: string): Promise<void> {
    try {
      await logActivity({
        userId,
        organizationId: portal.organizationId,
        workspaceId: portal.workspaceIds[0] || 'default',
        type: 'status_change',
        source: 'portal_engine',
        description: `Portal "${portal.name}" archived`,
        metadata: {
          event: 'portal.archived',
          portalId: portal.id,
          name: portal.name,
          slug: portal.slug,
          archivedAt: portal.archivedAt || new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error('[PORTAL_EVENT] Failed to emit portal.archived:', err);
    }
  }

  /**
   * Emits portal.visited event for engagement & analytics tracking.
   */
  static async emitPortalVisited(
    portal: Portal,
    visitorContext: {
      visitorId?: string;
      userAgent?: string;
      referrer?: string;
    }
  ): Promise<void> {
    try {
      await logActivity({
        userId: visitorContext.visitorId || 'anonymous_visitor',
        organizationId: portal.organizationId,
        workspaceId: portal.workspaceIds[0] || 'default',
        type: 'lead_engagement',
        source: 'portal_engine',
        description: `Portal "${portal.name}" visited`,
        metadata: {
          event: 'portal.visited',
          portalId: portal.id,
          slug: portal.slug,
          referrer: visitorContext.referrer || 'direct',
        },
      });
    } catch (err) {
      console.error('[PORTAL_EVENT] Failed to emit portal.visited:', err);
    }
  }

  /**
   * Emits content lifecycle events (created, updated, published, deleted).
   */
  static async emitContentEvent(
    event: 'content.created' | 'content.updated' | 'content.published' | 'content.archived' | 'content.deleted',
    item: { id: string; title: string; type: string; portalId: string; organizationId: string; workspaceIds: string[] },
    userId: string
  ): Promise<void> {
    try {
      await logActivity({
        userId,
        organizationId: item.organizationId,
        workspaceId: item.workspaceIds[0] || 'default',
        type: 'status_change',
        source: 'portal_content_engine',
        description: `Content "${item.title}" [${item.type}] - ${event}`,
        metadata: {
          event,
          contentItemId: item.id,
          title: item.title,
          contentType: item.type,
          portalId: item.portalId,
        },
      });
    } catch (err) {
      console.error(`[PORTAL_CONTENT_EVENT] Failed to emit ${event}:`, err);
    }
  }
}
