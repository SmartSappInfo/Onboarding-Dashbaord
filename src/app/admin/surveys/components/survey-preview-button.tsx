'use client';

import * as React from 'react';
import type { Survey } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useFormContext } from 'react-hook-form';
import SurveyForm from '../../../surveys/[slug]/components/survey-form';
import { SmartSappLogo } from '@/components/icons';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { buttonVariants } from '@/components/ui/button';
import { type VariantProps } from 'class-variance-authority';

interface SurveyPreviewButtonProps extends VariantProps<typeof buttonVariants> {
    className?: string;
    children?: React.ReactNode;
}


export default function SurveyPreviewButton({ variant, size, className, children }: SurveyPreviewButtonProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const { getValues } = useFormContext<Survey>();
    const [previewData, setPreviewData] = React.useState<Survey | null>(null);
    const [isSubmitted, setIsSubmitted] = React.useState(false);

    const handlePreviewClick = () => {
        // We need to provide a full survey object, even if it's new.
        const values = getValues();
        const fullSurveyData: Survey = {
            id: values.id || 'preview-id',
            slug: values.slug || 'preview-slug',
            createdAt: values.createdAt || new Date().toISOString(),
            updatedAt: values.updatedAt || new Date().toISOString(),
            title: values.title || '',
            description: values.description || '',
            elements: values.elements || [],
            status: values.status || 'draft',
            bannerImageUrl: values.bannerImageUrl,
            thankYouTitle: values.thankYouTitle,
            thankYouDescription: values.thankYouDescription,
        };
        setPreviewData(fullSurveyData);
        setIsSubmitted(false); // Reset submission state each time preview is opened
        setIsOpen(true);
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            // Reset state when dialog is closed
            setPreviewData(null);
            setIsSubmitted(false);
        }
        setIsOpen(open);
    }
    
    return (
        <>
            <Button type="button" variant={variant ?? 'outline'} size={size} className={className} onClick={handlePreviewClick}>
                {children ?? <>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                </>}
            </Button>

            <Dialog open={isOpen} onOpenChange={handleOpenChange}>
                <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-4 border-b">
                        <DialogTitle>Survey Preview</DialogTitle>
                        <DialogDescription>This is an interactive preview of how your survey will appear to users. No data will be saved.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-grow overflow-hidden">
                        <ScrollArea className="h-full">
                            <div className="bg-muted min-h-full">
                                {previewData && !isSubmitted && (
                                    <div className="max-w-4xl mx-auto py-12 px-4">
                                        {previewData.bannerImageUrl && (
                                            <div className="relative w-full aspect-[3/1] rounded-lg overflow-hidden mb-8">
                                                <Image src={previewData.bannerImageUrl} alt={previewData.title || ''} fill className="object-cover" />
                                            </div>
                                        )}
                                        <h1 className="text-3xl md:text-4xl font-bold mb-2 text-center">{previewData.title || '[Untitled Survey]'}</h1>
                                        <p className="text-muted-foreground mb-8 text-center">{previewData.description || '[No description]'}</p>
                                        
                                        <SurveyForm survey={previewData} onSubmitted={() => setIsSubmitted(true)} isPreview />
                                    </div>
                                )}
                                {previewData && isSubmitted && (
                                    <div className="flex items-center justify-center h-full min-h-[50vh] p-4">
                                        <div className="max-w-4xl w-full mx-auto text-center">
                                            <SmartSappLogo className="h-12 mx-auto mb-8" />
                                            {previewData.bannerImageUrl && (
                                                <div className="relative w-full aspect-[3/1] rounded-lg overflow-hidden mb-8">
                                                    <Image 
                                                        src={previewData.bannerImageUrl} 
                                                        alt={previewData.title || 'Survey thank you banner'} 
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                            )}
                                            <h1 className="text-3xl font-bold mb-4">{previewData.thankYouTitle || 'Thank You!'}</h1>
                                            <p className="text-muted-foreground text-lg">{previewData.thankYouDescription || 'Your response has been submitted successfully.'}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                    <DialogFooter className="p-6 pt-4 border-t">
                        <Button onClick={() => handleOpenChange(false)}>Close Preview</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
