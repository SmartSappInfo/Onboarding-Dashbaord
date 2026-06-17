'use client';

import * as React from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { getEffectiveContactTypes } from '@/lib/contact-type-actions';
import {
    Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface ContactScopeSelectorProps {
    value: string;
    onChange: (val: string) => void;
}

export function ContactScopeSelector({ value, onChange }: ContactScopeSelectorProps) {
    const { activeWorkspaceId, activeOrganizationId, activeWorkspace } = useWorkspace() as any;
    const [roles, setRoles] = React.useState<{ label: string; value: string }[]>([]);

    // A workspace is scoped to a single entity type (its `contactScope`, enforced
    // at entity-create), so we read that instead of scanning the entity set.
    const contactScope = activeWorkspace?.contactScope as string | undefined;

    React.useEffect(() => {
        if (!activeWorkspaceId) return;
        async function fetchRoles() {
            try {
                // Fallback to all types if the workspace scope isn't set yet (new workspace).
                const typesToFetch = contactScope
                    ? [contactScope] as any[]
                    : ['institution', 'family', 'person'];

                const rolePromises = typesToFetch.map(type =>
                    getEffectiveContactTypes(type, activeOrganizationId, activeWorkspaceId)
                );
                
                const roleResults = await Promise.all(rolePromises);
                const uniqueRoles = new Map<string, string>();
                
                roleResults.flat().forEach(r => {
                    if (r.active) uniqueRoles.set(r.key, r.label);
                });
                
                setRoles(Array.from(uniqueRoles.entries()).map(([v, label]) => ({ label, value: `role:${v}` })));
            } catch (error) {
                console.error('[ContactScopeSelector] Failed to fetch roles:', error);
            }
        }
        fetchRoles();
    }, [activeWorkspaceId, activeOrganizationId, contactScope]);

    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-10 rounded-xl font-bold text-xs bg-card border-border/50">
                <SelectValue placeholder="Select contact scope" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
                <SelectGroup>
                    <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">Broad Scope</SelectLabel>
                    <SelectItem value="primary" className="text-xs font-semibold">Primary Contact Only</SelectItem>
                    <SelectItem value="signatories" className="text-xs font-semibold">All Registered Signatories</SelectItem>
                    <SelectItem value="all" className="text-xs font-semibold">Broadcast to All Known Contacts</SelectItem>
                </SelectGroup>
                {roles.length > 0 ? (
                    <>
                        <Separator className="my-1 opacity-50" />
                        <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">Role Based</SelectLabel>
                            {roles.map(r => (
                                <SelectItem key={r.value} value={r.value} className="text-xs font-semibold">{r.label}</SelectItem>
                            ))}
                        </SelectGroup>
                    </>
                ) : null}
            </SelectContent>
        </Select>
    );
}
