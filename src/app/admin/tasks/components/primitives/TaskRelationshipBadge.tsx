'use client';

import * as React from 'react';
import { Building2, User, Users, Briefcase, FileSignature, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface TaskRelationshipBadgeProps {
    entityName?: string | null;
    entityType?: string | null;
    relatedEntityType?: string | null;
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
        default:
            return Building2;
    }
}

/**
 * TaskRelationshipBadge
 * Unified visual indicator for CRM entities (Institution, Family, Deal) and DocSigning Contract Obligations.
 * Explicitly surfaces "Sync pending" vs "Synced" states for contract obligations,
 * ensuring UI never falsely implies downstream synchronization before backend confirmation.
 */
export function TaskRelationshipBadge({
    entityName,
    entityType,
    relatedEntityType,
    obligationSyncStatus,
    href,
    className,
}: TaskRelationshipBadgeProps) {
    const isContractObligation = relatedEntityType === 'School' || relatedEntityType === 'Submission';
    const Icon = getEntityIcon(entityType || relatedEntityType);

    const content = (
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

    if (href) {
        return (
            <Link
                href={href}
                onClick={(e) => e.stopPropagation()}
                className="hover:opacity-85 transition-opacity inline-flex max-w-full"
            >
                {content}
            </Link>
        );
    }

    return content;
}
