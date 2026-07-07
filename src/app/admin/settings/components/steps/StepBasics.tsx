'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ONBOARDING_STAGE_COLORS } from '@/lib/colors';
import { cn } from '@/lib/utils';

interface StepBasicsProps {
    name: string;
    color: string;
    description: string;
    onChange: (field: 'name' | 'color' | 'description', value: string) => void;
}

export function StepBasics({ name, color, description, onChange }: StepBasicsProps) {
    return (
        <div className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-200 ease-out">
            <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground ml-1">Workspace Label</Label>
                <Input 
                    value={name} 
                    onChange={e => onChange('name', e.target.value)} 
                    placeholder="e.g. Higher Education Onboarding" 
                    className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold text-lg px-4 focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-0 transition-all" 
                    required 
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground ml-1">Theme (Color)</Label>
                    <div className="flex gap-3">
                        <Popover>
                            <PopoverTrigger asChild>
                                <button 
                                    type="button" 
                                    className="w-12 h-12 rounded-xl border-2 shadow-sm shrink-0 active:scale-[0.97] transition-transform duration-100 ease-out" 
                                    style={{ backgroundColor: color, borderColor: color + '40' }} 
                                />
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-3 rounded-2xl border-none shadow-2xl bg-card">
                                <div className="grid grid-cols-4 gap-2">
                                    {ONBOARDING_STAGE_COLORS.map(c => (
                                        <button 
                                            key={c} 
                                            type="button" 
                                            onClick={() => onChange('color', c)} 
                                            className={cn(
                                                "w-8 h-8 rounded-lg shadow-sm active:scale-[0.9] hover:scale-105 transition-all duration-100",
                                                color === c ? "ring-2 ring-primary ring-offset-1" : ""
                                            )} 
                                            style={{ backgroundColor: c }} 
                                        />
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Input 
                            value={color} 
                            onChange={e => onChange('color', e.target.value)} 
                            className="h-12 rounded-xl bg-muted/20 border-none font-mono font-semibold text-center focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-0" 
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground ml-1">Objective Brief</Label>
                    <Textarea 
                        value={description} 
                        onChange={e => onChange('description', e.target.value)} 
                        placeholder="Define the scope and operational guidelines of this workspace..." 
                        className="min-h-[135px] rounded-2xl bg-muted/20 border-none shadow-inner p-4 font-medium leading-relaxed focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-0 resize-none" 
                    />
                </div>
            </div>
        </div>
    );
}
