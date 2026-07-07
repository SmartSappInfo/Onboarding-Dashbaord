'use client';

import * as React from 'react';
import type { WorkspaceStatus, IndustryVertical } from '@/lib/types';
import type { WorkspaceFormState } from '../types';
import { 
    PlusCircle, 
    X, 
    ShieldCheck, 
    Briefcase, 
    Building2, 
    Users, 
    User,
    Lock,
    Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ONBOARDING_STAGE_COLORS } from '@/lib/colors';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface StepFinishProps {
    formState: WorkspaceFormState;
    onAddStatus: () => void;
    onUpdateStatus: (index: number, updates: Partial<WorkspaceStatus>) => void;
    onRemoveStatus: (index: number) => void;
    getIndustryDisplayName: (industryType: IndustryVertical) => string;
}

export function StepFinish({
    formState,
    onAddStatus,
    onUpdateStatus,
    onRemoveStatus,
    getIndustryDisplayName
}: StepFinishProps) {
    const { name, color, description, industry, contactScope, contactPolicy, restrictVisibilityToAssigned, statuses } = formState;

    return (
        <div className="space-y-8 animate-in fade-in-50 slide-in-from-bottom-2 duration-200 ease-out">
            {/* Statuses Creator */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <h4 className="text-sm font-semibold text-foreground">Independent Status Lifecycle</h4>
                    </div>
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={onAddStatus}
                        className="h-8 rounded-xl font-bold border-dashed border-2 text-[10px] active:scale-[0.97]"
                    >
                        <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Add Status Node
                    </Button>
                </div>

                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                    {statuses.map((status, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-3 rounded-2xl bg-card border group animate-in fade-in duration-100">
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center gap-3">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <button 
                                                type="button" 
                                                className="w-8 h-8 rounded-lg shadow-sm border shrink-0 active:scale-[0.9]" 
                                                style={{ backgroundColor: status.color }} 
                                            />
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-2 bg-card border-none shadow-2xl">
                                            <div className="grid grid-cols-6 gap-1">
                                                {ONBOARDING_STAGE_COLORS.map(c => (
                                                    <button 
                                                        key={c} 
                                                        type="button" 
                                                        onClick={() => onUpdateStatus(idx, { color: c })} 
                                                        className="w-5 h-5 rounded shadow-sm hover:scale-105 active:scale-[0.9] transition-all" 
                                                        style={{ backgroundColor: c }} 
                                                    />
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                    <Input 
                                        value={status.label} 
                                        onChange={e => onUpdateStatus(idx, { label: e.target.value, value: e.target.value })} 
                                        className="h-9 bg-background font-bold text-xs" 
                                    />
                                </div>
                                <Input 
                                    value={status.description || ''} 
                                    onChange={e => onUpdateStatus(idx, { description: e.target.value })} 
                                    placeholder="Short behavioral description..."
                                    className="h-9 bg-background font-medium text-[10px]" 
                                />
                            </div>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => onRemoveStatus(idx)}
                                disabled={statuses.length === 1}
                                className="h-9 w-9 rounded-xl text-destructive active:scale-[0.9]"
                            >
                                <X size={16} />
                            </Button>
                        </div>
                    ))}
                </div>
            </div>

            <Separator className="opacity-50" />

            {/* Preview Summary */}
            <div className="space-y-4">
                <h4 className="text-sm font-semibold text-foreground px-1">Summary Review</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-2xl bg-muted/20 border border-border text-xs leading-relaxed">
                    <div className="space-y-3">
                        <div>
                            <span className="font-bold text-muted-foreground block mb-0.5">Workspace Label</span>
                            <span className="font-bold text-foreground text-sm flex items-center gap-2">
                                <span className="w-3.5 h-3.5 rounded-full inline-block shrink-0" style={{ backgroundColor: color }} />
                                {name || 'Unnamed Workspace'}
                            </span>
                        </div>
                        <div>
                            <span className="font-bold text-muted-foreground block mb-0.5">Objective Brief</span>
                            <p className="font-medium text-foreground line-clamp-2">{description || 'No description provided.'}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="font-bold text-muted-foreground block mb-0.5">Industry</span>
                                <span className="font-semibold text-foreground flex items-center gap-1.5">
                                    <Briefcase size={12} className="text-primary" />
                                    {getIndustryDisplayName(industry)}
                                </span>
                            </div>
                            <div>
                                <span className="font-bold text-muted-foreground block mb-0.5">Contact Scope</span>
                                <span className="font-semibold text-foreground flex items-center gap-1.5">
                                    {contactScope === 'institution' && <Building2 size={12} className="text-primary" />}
                                    {contactScope === 'family' && <Users size={12} className="text-primary" />}
                                    {contactScope === 'person' && <User size={12} className="text-primary" />}
                                    {contactScope === 'institution' ? 'Schools' : contactScope === 'family' ? 'Families' : 'People'}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="font-bold text-muted-foreground block mb-0.5">Policy</span>
                                <span className="font-semibold text-foreground capitalize">
                                    {contactPolicy.replace(/_/g, ' ')}
                                </span>
                            </div>
                            <div>
                                <span className="font-bold text-muted-foreground block mb-0.5">Visibility</span>
                                <span className="font-semibold text-foreground flex items-center gap-1.5">
                                    {restrictVisibilityToAssigned ? (
                                        <>
                                            <Lock size={12} className="text-primary" />
                                            Assigned Only
                                        </>
                                    ) : (
                                        <>
                                            <Eye size={12} className="text-primary" />
                                            All Entities
                                        </>
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
