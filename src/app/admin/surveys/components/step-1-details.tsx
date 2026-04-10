
'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Layout, Building, Video, Palette, Type, MessageSquareText, ArrowRight, Image as ImageIcon } from 'lucide-react';
import { MediaSelect } from '@/app/admin/entities/components/media-select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { WorkspaceEntity } from '@/lib/types';

interface Step1DetailsProps {
    institutions?: WorkspaceEntity[];
}

export default function Step1Details({ institutions }: Step1DetailsProps) {
    const { control, setValue, watch } = useFormContext();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500 text-left">
            {/* Identity Card */}
            <Card className="shadow-sm border-none ring-1 ring-border rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-6 px-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Type className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-black uppercase tracking-tight">Identity & Branding</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Core nomenclature and organizational context.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Controller
                            name="internalName"
                            control={control}
                            render={({ field }) => (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Internal Blueprint Name</Label>
                                    <Input {...field} placeholder="e.g. 2024 Parent Satisfaction Audit" className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" />
                                </div>
                            )}
                        />
                        <Controller
                            name="title"
                            control={control}
                            render={({ field }) => (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Public Header Title</Label>
                                    <Input {...field} placeholder="e.g. Help Us Improve" className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" />
                                </div>
                            )}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Controller
                            name="entityId"
                            control={control}
                            render={({ field }) => (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Associated Campus</Label>
                                    <Select 
                                        onValueChange={(val) => {
                                            const institution = institutions?.find(i => i.entityId === val);
                                            field.onChange(val === 'none' ? null : val);
                                            setValue('entityName', institution ? institution.displayName : null, { shouldDirty: true });
                                            
                                            // Reset entity logo sync if entity changed
                                            if (watch('useEntityLogo')) {
                                                const logo = institution?.schoolData?.logoUrl || institution?.schoolData?.branding?.logoUrl;
                                                if (logo) setValue('logoUrl', logo, { shouldDirty: true });
                                            }
                                        }} 
                                        value={field.value || 'none'}
                                    >
                                        <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none font-bold">
                                            <SelectValue placeholder="Global Context" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="none">Global / Generic</SelectItem>
                                            {institutions?.map(i => <SelectItem key={i.entityId} value={i.entityId}>{i.displayName}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        />
                        <Controller
                            name="useEntityLogo"
                            control={control}
                            render={({ field }) => (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 opacity-0">-</Label>
                                    <div className={cn(
                                        "flex items-center justify-between h-11 px-4 rounded-xl border-2 transition-all duration-300",
                                        field.value ? "border-primary/20 bg-primary/5" : "border-transparent bg-muted/20 grayscale opacity-40"
                                    )}>
                                        <div className="flex items-center gap-2">
                                            <Building className="h-4 w-4 text-primary" />
                                            <span className="text-[10px] font-black uppercase tracking-tight">Sync Entity Logo</span>
                                        </div>
                                        <Switch 
                                            disabled={!watch('entityId')}
                                            checked={field.value} 
                                            onCheckedChange={(checked) => {
                                                field.onChange(checked);
                                                if (checked) {
                                                    const entityId = watch('entityId');
                                                    const institution = institutions?.find(i => i.entityId === entityId);
                                                    const logo = institution?.schoolData?.logoUrl || institution?.schoolData?.branding?.logoUrl;
                                                    if (logo) setValue('logoUrl', logo, { shouldDirty: true });
                                                }
                                            }} 
                                        />
                                    </div>
                                </div>
                            )}
                        />
                    </div>
                    <Controller
                        name="description"
                        control={control}
                        render={({ field }) => (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Introductory Prose</Label>
                                <Textarea {...field} placeholder="Share the purpose of this audit..." className="min-h-[100px] rounded-xl bg-muted/20 border-none p-4 font-medium leading-relaxed shadow-inner" />
                            </div>
                        )}
                    />
                    <Controller
                        name="startButtonText"
                        control={control}
                        render={({ field }) => (
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Start Button Label</Label>
                                <Input
                                    {...field}
                                    value={field.value || ''}
                                    placeholder="e.g. Start the 2-Minute Survey"
                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold"
                                />
                                <div className="flex items-center gap-2 pt-1">
                                    <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-tighter ml-1">Preview:</span>
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-2 h-9 px-5 rounded-xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest shadow-md transition-all whitespace-nowrap"
                                        style={{ width: 'fit-content' }}
                                    >
                                        {field.value?.trim() || "Let's Start"} <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                                    </button>
                                </div>
                            </div>
                        )}
                    />
                </CardContent>
            </Card>

            {/* Immersive Media Card */}
            <Card className="shadow-sm border-none ring-1 ring-border rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-6 px-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Video className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-black uppercase tracking-tight">Immersive Hero</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">High-engagement video and cover assets.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                    <div className="space-y-6">
                        <Controller
                            name="videoUrl"
                            control={control}
                            render={({ field }) => (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Feature Video URL</Label>
                                    <Input {...field} value={field.value || ''} placeholder="YouTube, Vimeo, or direct MP4 link..." className="h-11 rounded-xl bg-muted/20 border-none font-bold" />
                                </div>
                            )}
                        />
                        <Controller
                            name="videoCaption"
                            control={control}
                            render={({ field }) => (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                                        <MessageSquareText className="h-3 w-3" /> Call-to-Action Text
                                    </Label>
                                    <Input {...field} value={field.value || ''} placeholder="e.g. Watch our Director's Welcome" className="h-11 rounded-xl bg-muted/20 border-none font-bold" />
                                    <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tighter ml-1 italic">Defaults to "Click to watch video" if empty.</p>
                                </div>
                            )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Controller
                                name="logoUrl"
                                control={control}
                                render={({ field }) => (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                                            <ImageIcon className="h-3 w-3" /> Survey Brand Logo
                                        </Label>
                                        <MediaSelect 
                                            {...field} 
                                            filterType="image" 
                                            className="rounded-xl" 
                                            disabled={watch('useEntityLogo')}
                                        />
                                        {watch('useEntityLogo') && (
                                            <p className="text-[9px] font-bold text-primary uppercase tracking-tighter ml-1 italic">
                                                Branding is being managed by the associated entity.
                                            </p>
                                        )}
                                    </div>
                                )}
                            />
                            <div className="grid grid-cols-1 gap-6">
                                <Controller
                                    name="videoThumbnailUrl"
                                    control={control}
                                    render={({ field }) => (
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Video Poster (Frame)</Label>
                                            <MediaSelect {...field} filterType="image" className="rounded-xl" />
                                        </div>
                                    )}
                                />
                            </div>
                        </div>
                        <Controller
                            name="bannerImageUrl"
                            control={control}
                            render={({ field }) => (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cover Image (Fallback)</Label>
                                    <MediaSelect {...field} filterType="image" className="rounded-xl" />
                                </div>
                            )}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Aesthetics Card */}
            <Card className="shadow-sm border-none ring-1 ring-border rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-6 px-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Palette className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-black uppercase tracking-tight">Visual Theme</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Customize the atmospheric design.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <Controller
                            name="backgroundColor"
                            control={control}
                            render={({ field }) => (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Base Color</Label>
                                    <div className="flex items-center gap-2 p-1.5 rounded-xl bg-muted/20 border shadow-inner">
                                        <Input type="color" {...field} className="w-10 h-10 p-0 border-none bg-transparent rounded-lg cursor-pointer" />
                                        <Input value={field.value} onChange={e => field.onChange(e.target.value)} className="h-8 border-none bg-transparent shadow-none font-mono text-[10px] font-black uppercase" />
                                    </div>
                                </div>
                            )}
                        />
                        <Controller
                            name="patternColor"
                            control={control}
                            render={({ field }) => (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Pattern Tint</Label>
                                    <div className="flex items-center gap-2 p-1.5 rounded-xl bg-muted/20 border shadow-inner">
                                        <Input type="color" {...field} className="w-10 h-10 p-0 border-none bg-transparent rounded-lg cursor-pointer" />
                                        <Input value={field.value} onChange={e => field.onChange(e.target.value)} className="h-8 border-none bg-transparent shadow-none font-mono text-[10px] font-black uppercase" />
                                    </div>
                                </div>
                            )}
                        />
                    </div>
                    <Controller
                        name="backgroundPattern"
                        control={control}
                        render={({ field }) => (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Overlay Pattern</Label>
                                <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                    <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold">
                                        <SelectValue placeholder="Select pattern..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="none">Solid (None)</SelectItem>
                                        <SelectItem value="dots">Dots</SelectItem>
                                        <SelectItem value="grid">Grid</SelectItem>
                                        <SelectItem value="circuit">Circuit</SelectItem>
                                        <SelectItem value="topography">Topography</SelectItem>
                                        <SelectItem value="cubes">Cubes</SelectItem>
                                        <SelectItem value="gradient">Aura Gradient</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
