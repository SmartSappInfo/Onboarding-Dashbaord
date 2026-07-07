'use client';

import * as React from 'react';
import type { ContactIdentifierPolicy } from '@/lib/types';
import { 
    Smartphone, 
    Phone, 
    Mail, 
    MailCheck, 
    Shield, 
    Lock, 
    Eye, 
    Check 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepGovernanceProps {
    contactPolicy: ContactIdentifierPolicy;
    restrictVisibilityToAssigned: boolean;
    onChange: (updates: { contactPolicy?: ContactIdentifierPolicy; restrictVisibilityToAssigned?: boolean }) => void;
}

export function StepGovernance({
    contactPolicy,
    restrictVisibilityToAssigned,
    onChange
}: StepGovernanceProps) {
    return (
        <div className="space-y-8 animate-in fade-in-50 slide-in-from-bottom-2 duration-200 ease-out">
            {/* Contact Identifier Policy */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <Smartphone className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold text-foreground">Contact Identifier Policy</h4>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed px-1">
                    Determines which identifiers are required to save an entity. Applied across bulk import, new entity page, and survey submissions.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {([
                        { value: 'phone_only' as const, icon: Phone, label: 'Phone Only', desc: 'Only phone number required — SMS-first workflows.' },
                        { value: 'email_only' as const, icon: Mail, label: 'Email Only', desc: 'Only email required — email-first campaigns.' },
                        { value: 'phone_or_email' as const, icon: MailCheck, label: 'Phone or Email', desc: 'Either phone or email acceptable (default).' }
                    ]).map(({ value, icon: Icon, label, desc }) => {
                        const isSelected = contactPolicy === value;
                        return (
                            <button
                                key={value}
                                type="button"
                                onClick={() => onChange({ contactPolicy: value })}
                                className={cn(
                                    "p-4 rounded-2xl border-2 text-left group transition-all duration-200 hover:shadow-md active:scale-[0.97]",
                                    isSelected
                                        ? "bg-primary/5 border-primary shadow-sm"
                                        : "bg-background border-border hover:border-primary/20"
                                )}
                            >
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className={cn(
                                            "p-1.5 rounded-lg transition-colors duration-200",
                                            isSelected ? "bg-primary/10" : "bg-muted"
                                        )}>
                                            <Icon className={cn(
                                                "h-4 w-4 transition-colors duration-200",
                                                isSelected ? "text-primary" : "text-muted-foreground"
                                            )} />
                                        </div>
                                        {isSelected && (
                                            <Check className="h-4 w-4 text-primary animate-in zoom-in-50 duration-150" />
                                        )}
                                    </div>
                                    <div className="space-y-0.5">
                                        <h5 className="text-xs font-bold text-foreground">{label}</h5>
                                        <p className="text-[10px] text-muted-foreground leading-relaxed">{desc}</p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Entity Visibility scope */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <Shield className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold text-foreground">Entity Visibility Scope</h4>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed px-1">
                    Determine whether users in this workspace can see all entities or only the ones explicitly assigned to them.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={() => onChange({ restrictVisibilityToAssigned: true })}
                        className={cn(
                            "p-4 rounded-2xl border-2 text-left group transition-all duration-200 hover:shadow-md active:scale-[0.97]",
                            restrictVisibilityToAssigned
                                ? "bg-primary/5 border-primary shadow-sm"
                                : "bg-background border-border hover:border-primary/20"
                        )}
                    >
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className={cn(
                                    "p-1.5 rounded-lg transition-colors duration-200",
                                    restrictVisibilityToAssigned ? "bg-primary/10" : "bg-muted"
                                )}>
                                    <Lock className={cn(
                                        "h-4 w-4 transition-colors duration-200",
                                        restrictVisibilityToAssigned ? "text-primary" : "text-muted-foreground"
                                    )} />
                                </div>
                                {restrictVisibilityToAssigned && (
                                    <Check className="h-4 w-4 text-primary animate-in zoom-in-50 duration-150" />
                                )}
                            </div>
                            <div className="space-y-0.5">
                                <h5 className="text-xs font-bold text-foreground">Assigned Only (Default)</h5>
                                <p className="text-[10px] text-muted-foreground leading-relaxed">
                                    Users can only view and interact with entities specifically assigned to them.
                                </p>
                            </div>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => onChange({ restrictVisibilityToAssigned: false })}
                        className={cn(
                            "p-4 rounded-2xl border-2 text-left group transition-all duration-200 hover:shadow-md active:scale-[0.97]",
                            !restrictVisibilityToAssigned
                                ? "bg-primary/5 border-primary shadow-sm"
                                : "bg-background border-border hover:border-primary/20"
                        )}
                    >
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className={cn(
                                    "p-1.5 rounded-lg transition-colors duration-200",
                                    !restrictVisibilityToAssigned ? "bg-primary/10" : "bg-muted"
                                )}>
                                    <Eye className={cn(
                                        "h-4 w-4 transition-colors duration-200",
                                        !restrictVisibilityToAssigned ? "text-primary" : "text-muted-foreground"
                                    )} />
                                </div>
                                {!restrictVisibilityToAssigned && (
                                    <Check className="h-4 w-4 text-primary animate-in zoom-in-50 duration-150" />
                                )}
                            </div>
                            <div className="space-y-0.5">
                                <h5 className="text-xs font-bold text-foreground">All Entities</h5>
                                <p className="text-[10px] text-muted-foreground leading-relaxed">
                                    Users can view and interact with all entities in the workspace.
                                </p>
                            </div>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
