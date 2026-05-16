'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Pencil, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SmartTemplateDropdown } from './SmartTemplateDropdown';
import type { TemplateCategory, RecipientType, MessageChannel } from '@/lib/types';

// Lazily load the heavy workshop sheet only when needed
const TemplateWorkshopSheet = dynamic(
    () => import('@/app/admin/messaging/components/TemplateWorkshopSheet').then(m => m.TemplateWorkshopSheet),
    { ssr: false }
);

export interface MessagingTemplateSelectorProps {
    category: TemplateCategory;
    recipientType: RecipientType;
    channel: MessageChannel;
    templateTypePrefix?: string;
    value?: string;
    onValueChange: (value: string) => void;
    onSelect?: (template: any) => void;
    placeholder?: string;
    className?: string;
}

export function MessagingTemplateSelector({
    category,
    recipientType,
    channel,
    templateTypePrefix,
    value,
    onValueChange,
    onSelect,
    placeholder,
    className
}: MessagingTemplateSelectorProps) {
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editingTemplateId, setEditingTemplateId] = React.useState<string | undefined>();

    const handleCreateNew = () => {
        setEditingTemplateId(undefined);
        setDialogOpen(true);
    };

    const handleEdit = () => {
        if (value) {
            setEditingTemplateId(value);
            setDialogOpen(true);
        }
    };

    const handleTemplateCreated = (template: any) => {
        onValueChange(template.id);
    };

    return (
        <div className="flex items-center gap-2 w-full animate-in fade-in zoom-in-95 duration-300">
            <div className="flex-1 min-w-0">
                <SmartTemplateDropdown
                    category={category}
                    recipientType={recipientType}
                    channel={channel}
                    templateTypePrefix={templateTypePrefix}
                    value={value}
                    onValueChange={onValueChange}
                    onSelect={onSelect}
                    placeholder={placeholder}
                    className={className}
                />
            </div>
            
            {value && (
                <>
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="icon" 
                        className="h-9 w-9 shrink-0 rounded-xl border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors"
                        onClick={handleEdit}
                        title="Preview & Edit Template"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="icon" 
                        className="h-9 w-9 shrink-0 rounded-xl border-destructive/20 hover:bg-destructive/5 hover:text-destructive transition-colors"
                        onClick={() => {
                            onValueChange('');
                            if (onSelect) onSelect(null);
                        }}
                        title="Clear Selection"
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </>
            )}
            
            <Button 
                type="button" 
                variant="outline" 
                size="icon" 
                className="h-9 w-9 shrink-0 rounded-xl border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors"
                onClick={handleCreateNew}
                title="Create New Template"
            >
                <Plus className="h-3.5 w-3.5" />
            </Button>

            {dialogOpen && (
                <TemplateWorkshopSheet
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    onCreated={handleTemplateCreated}
                    templateId={editingTemplateId}
                    initialContext={{
                        category,
                        channel,
                        recipientType,
                        templateType: editingTemplateId ? undefined : (templateTypePrefix ? `${templateTypePrefix}_${Date.now()}` : undefined)
                    }}
                />
            )}
        </div>
    );
}
