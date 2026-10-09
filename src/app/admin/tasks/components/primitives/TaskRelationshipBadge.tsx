'use client';

/**
 * @fileOverview TaskRelationshipBadge Primitive
 *
 * Unified visual indicator and deep-link bridge for CRM entities (Institution, Family, Deal),
 * DocSigning Contract Obligations, Meetings, and Surveys conforming to Roadmap §40-41 and UI Spec §613-624:
 * - Computes authoritative deep-links to canonical records without data duplication.
 * - Explicitly surfaces "Sync pending" vs "Synced" states for contract obligations.
 * - Includes hover preview tooltip with record context and direct navigation action.
 * - Graceful fallback to neutral unlinked badge if record identifier is missing.
 */

import * as React from 'react';
import { 
    Building2, 
    User, 
    Users, 
    Briefcase, 
    FileSignature, 
    CheckCircle2, 
    Clock, 
    Calendar, 
    ClipboardList,
    ExternalLink 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface TaskRelationshipBadgeProps {
    entityId?: string | null;
    entityName?: string | null;
    entityType?: string | null;
    relatedEntityType?: string | null;
    relatedParentId?: string | null;
    relatedEntityId?: string | null;
    dealId?: string | null;
    obligationSyncStatus?: 'synced' | 'pending' | 'failed' | null;
    href?: string | null;
    className?: string;
}

function getEntityIcon(type?: string | null) {
    switch (type?.toLowerCase()) {
        case 'institution':
        case 'school':
            return Building2;
        case 'family':
            return Users;
        case 'person':
            return User;
        case 'deal':
            return Briefcase;
        case 'meeting':
            return Calendar;
        case 'surveyresponse':
        case 'survey':
            return ClipboardList;
        default:
            return Building2;
    }
}

export function TaskRelationshipBadge({
    entityId,
    entityName,
    entityType,
    relatedEntityType,
    relatedParentId,
    relatedEntityId,
    dealId,
    obligationSyncStatus,
    href,
    className,
}: TaskRelationshipBadgeProps) {
    const isContractObligation = relatedEntityType === 'School' || relatedEntityType === 'Submission';
    const Icon = getEntityIcon(entityType || relatedEntityType);

    // Authoritative deep-link derivation (Roadmap §40, UI Spec §617)
    const computedHref = React.useMemo(() => {
        if (href) return href;
        if (dealId) return `/admin/deals?dealId=${dealId}`;
        if (isContractObligation && (relatedParentId || relatedEntityId)) {
            const params = new URLSearchParams();
            if (relatedParentId) params.set('contractId', relatedParentId);
            if (relatedEntityId) params.set('obligationId', relatedEntityId);
            return `/admin/finance/contracts?${params.toString()}`;
        }
        if (entityId) {
            return `/admin/entities/${entityId}`;
        }
        if (relatedEntityType === 'Meeting' && relatedEntityId) {
            return `/admin/meetings/${relatedEntityId}`;
        }
        if (relatedEntityType === 'SurveyResponse' && relatedParentId) {
            return `/admin/surveys/${relatedParentId}`;
        }
        return null;
    }, [href, dealId, isContractObligation, relatedParentId, relatedEntityId, entityId, relatedEntityType]);

    const badgeContent = (
        <div className={cn("inline-flex items-center gap-1.5 max-w-full truncate select-none", className)}>
            {entityName && (
                <Badge
                    variant="outline"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted/50 transition-colors truncate"
                >
                    <Icon className="h-3 w-3 shrink-0 opacity-70" />
                    <span className="truncate max-w-[140px]">{entityName}</span>
                </Badge>
            )}

            {isContractObligation && obligationSyncStatus && (
                <Badge
                    variant="outline"
                    className={cn(
                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border",
                        obligationSyncStatus === 'synced'
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                            : obligationSyncStatus === 'pending'
                            ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                            : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                    )}
                >
                    <FileSignature className="h-2.5 w-2.5 shrink-0" />
                    {obligationSyncStatus === 'synced' ? (
                        <>
                            <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-emerald-600" />
                            <span>Synced</span>
                        </>
                    ) : obligationSyncStatus === 'pending' ? (
                        <>
                            <Clock className="h-2.5 w-2.5 shrink-0 text-amber-600 animate-spin" />
                            <span>Sync pending</span>
                        </>
                    ) : (
                        <span>Sync failed</span>
                    )}
                </Badge>
            )}
        </div>
    );

    if (computedHref && entityName) {
        return (
            <TooltipProvider delayDuration={300}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Link
                            href={computedHref}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:opacity-85 transition-opacity inline-flex max-w-full"
                        >
                            {badgeContent}
                        </Link>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs p-2.5 z-[10050] max-w-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground">{entityName}</span>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">
                                {entityType || relatedEntityType || 'CRM Record'}
                            </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 text-primary">
                            <span>Open record</span>
                            <ExternalLink className="h-3 w-3" />
                        </p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return badgeContent;
}

export default TaskRelationshipBadge;
