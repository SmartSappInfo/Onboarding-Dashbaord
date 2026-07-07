'use client';

import * as React from 'react';
import type { IndustryVertical, ContactScope } from '@/lib/types';
import { 
    Briefcase, 
    Building2, 
    Users, 
    User, 
    Check, 
    Info 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StepIndustryScopeProps {
    industry: IndustryVertical;
    contactScope: ContactScope;
    enabledIndustries: IndustryVertical[];
    getIndustryIcon: (industryType: IndustryVertical) => React.ComponentType<{ className?: string }>;
    getIndustryDisplayName: (industryType: IndustryVertical) => string;
    getIndustryDescription: (industryType: IndustryVertical) => string;
    onChange: (updates: { industry: IndustryVertical; contactScope: ContactScope }) => void;
}

export function StepIndustryScope({
    industry,
    contactScope,
    enabledIndustries,
    getIndustryIcon,
    getIndustryDisplayName,
    getIndustryDescription,
    onChange
}: StepIndustryScopeProps) {

    const handleIndustryChange = (newIndustry: IndustryVertical) => {
        let recommendedScope: ContactScope = 'person';
        if (newIndustry === 'SaaS') {
            recommendedScope = 'institution';
        } else if (newIndustry === 'SchoolEnrollment') {
            recommendedScope = 'family';
        }
        onChange({ industry: newIndustry, contactScope: recommendedScope });
    };

    return (
        <div className="space-y-8 animate-in fade-in-50 slide-in-from-bottom-2 duration-200 ease-out">
            {/* Industry selection */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <Briefcase className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold text-foreground">Industry Vertical</h4>
                    <Badge variant="secondary" className="text-[8px] font-semibold uppercase px-1.5 h-4">Required</Badge>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed px-1">
                    Select the industry vertical for this workspace. This determines available features, terminology, and pipeline templates.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {enabledIndustries.map((ind) => {
                        const Icon = getIndustryIcon(ind);
                        const isSelected = industry === ind;
                        return (
                            <button
                                key={ind}
                                type="button"
                                onClick={() => handleIndustryChange(ind)}
                                className={cn(
                                    "p-4 rounded-2xl border-2 text-left group transition-all duration-200 hover:shadow-md active:scale-[0.97]",
                                    isSelected
                                        ? "bg-primary/5 border-primary shadow-sm"
                                        : "bg-background border-border hover:border-primary/20"
                                )}
                            >
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className={cn(
                                            "p-2 rounded-lg transition-colors duration-200",
                                            isSelected ? "bg-primary/10" : "bg-muted"
                                        )}>
                                            <Icon className={cn(
                                                "h-5 w-5 transition-colors duration-200",
                                                isSelected ? "text-primary" : "text-muted-foreground"
                                            )} />
                                        </div>
                                        {isSelected && (
                                            <Check className="h-4 w-4 text-primary animate-in zoom-in-50 duration-150" />
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <h5 className="text-xs font-bold text-foreground">{getIndustryDisplayName(ind)}</h5>
                                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                                            {getIndustryDescription(ind)}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Scope Selection */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <Building2 className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold text-foreground">Contact Scope</h4>
                    <Badge variant="secondary" className="text-[8px] font-semibold uppercase px-1.5 h-4">Required</Badge>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed px-1">
                    Select the type of contacts this workspace will manage. This determines the data model, UI, and workflows.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {([
                        { value: 'institution' as const, icon: Building2, label: 'Schools', desc: 'Institutional contacts with billing, contracts, and subscription management.' },
                        { value: 'family' as const, icon: Users, label: 'Families', desc: 'Family contacts with guardians, children, and admissions workflows.' },
                        { value: 'person' as const, icon: User, label: 'People', desc: 'Individual contacts with personal CRM and lead management.' }
                    ]).map(({ value, icon: Icon, label, desc }) => {
                        const isSelected = contactScope === value;
                        return (
                            <button
                                key={value}
                                type="button"
                                onClick={() => onChange({ industry, contactScope: value })}
                                className={cn(
                                    "p-4 rounded-2xl border-2 text-left group transition-all duration-200 hover:shadow-md active:scale-[0.97]",
                                    isSelected
                                        ? "bg-primary/5 border-primary shadow-sm"
                                        : "bg-background border-border hover:border-primary/20"
                                )}
                            >
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className={cn(
                                            "p-2 rounded-lg transition-colors duration-200",
                                            isSelected ? "bg-primary/10" : "bg-muted"
                                        )}>
                                            <Icon className={cn(
                                                "h-5 w-5 transition-colors duration-200",
                                                isSelected ? "text-primary" : "text-muted-foreground"
                                            )} />
                                        </div>
                                        {isSelected && (
                                            <Check className="h-4 w-4 text-primary animate-in zoom-in-50 duration-150" />
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <h5 className="text-xs font-bold text-foreground">{label}</h5>
                                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                                            {desc}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-blue-900 ">Scope & Industry Lock Notice</p>
                    <p className="text-[9px] font-medium text-blue-800/70 leading-relaxed">
                        Industry vertical and contact scope selections cannot be changed after the first entity is linked to this workspace. Choose carefully to match your target workflow.
                    </p>
                </div>
            </div>
        </div>
    );
}
