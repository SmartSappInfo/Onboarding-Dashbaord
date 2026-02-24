
'use client';

import * as React from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, GripVertical, AlertCircle } from 'lucide-react';
import type { SurveyResultRule, SurveyResultPage } from '@/lib/types';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableRuleItem({ id, index, pages, remove }: { id: string, index: number, pages: SurveyResultPage[], remove: (i: number) => void }) {
    const { register, watch, setValue } = useFormContext();
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-start gap-4 p-4 border rounded-lg bg-card group relative">
            <div {...attributes} {...listeners} className="mt-2 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-grow grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Label</Label>
                    <Input placeholder="e.g. Low Score" {...register(`resultRules.${index}.label`)} />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Min Score</Label>
                    <Input type="number" {...register(`resultRules.${index}.minScore`, { valueAsNumber: true })} />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Max Score</Label>
                    <Input type="number" {...register(`resultRules.${index}.maxScore`, { valueAsNumber: true })} />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Destination Page</Label>
                    <Select 
                        value={watch(`resultRules.${index}.pageId`)} 
                        onValueChange={(val) => setValue(`resultRules.${index}.pageId`, val, { shouldDirty: true })}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select page..." />
                        </SelectTrigger>
                        <SelectContent>
                            {pages.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive mt-6" onClick={() => remove(index)}>
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
}

export default function ResultRuleManager() {
    const { control, watch } = useFormContext();
    const { fields, append, remove, move } = useFieldArray({
        control,
        name: 'resultRules',
    });

    const resultPages = watch('resultPages') || [];
    const sensors = useSensors(useSensor(PointerSensor));

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = fields.findIndex(f => f.id === active.id);
            const newIndex = fields.findIndex(f => f.id === over.id);
            move(oldIndex, newIndex);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Score Thresholds</h3>
                    <p className="text-sm text-muted-foreground">Define what result page to show based on the respondent&apos;s score.</p>
                </div>
                <Button onClick={() => append({ id: `rule_${Date.now()}`, label: 'New Outcome', minScore: 0, maxScore: 100, priority: fields.length, pageId: '' })} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" /> Add Logic Rule
                </Button>
            </div>

            {fields.length > 0 ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-4">
                            {fields.map((field, index) => (
                                <SortableRuleItem 
                                    key={field.id} 
                                    id={field.id} 
                                    index={index} 
                                    pages={resultPages} 
                                    remove={remove} 
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            ) : (
                <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/30">
                    <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No rules defined. All users will see the default result page.</p>
                </div>
            )}
        </div>
    );
}
