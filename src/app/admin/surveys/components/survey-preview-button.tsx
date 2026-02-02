'use client';

import * as React from 'react';
import type { Survey } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useFormContext } from 'react-hook-form';
import SurveyPreviewRenderer from './survey-preview-renderer';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function SurveyPreviewButton() {
    const [isOpen, setIsOpen] = React.useState(false);
    const { getValues } = useFormContext<Survey>();
    const [previewData, setPreviewData] = React.useState<Partial<Survey>>({});

    const handlePreviewClick = () => {
        setPreviewData(getValues());
        setIsOpen(true);
    };
    
    return (
        <>
            <Button type="button" variant="outline" onClick={handlePreviewClick}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-4 border-b">
                        <DialogTitle>Survey Preview</DialogTitle>
                        <DialogDescription>This is a non-interactive preview of how your survey will appear to users.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-grow overflow-hidden">
                        <ScrollArea className="h-full">
                            <div className="bg-muted">
                                <div className="max-w-2xl mx-auto py-12 px-4">
                                    {previewData.bannerImageUrl && (
                                        <div className="relative w-full h-40 md:h-60 rounded-lg overflow-hidden mb-8">
                                            <Image src={previewData.bannerImageUrl} alt={previewData.title || ''} layout="fill" objectFit="cover" />
                                        </div>
                                    )}
                                    <h1 className="text-3xl md:text-4xl font-bold mb-2">{previewData.title || '[Untitled Survey]'}</h1>
                                    <p className="text-muted-foreground mb-8">{previewData.description || '[No description]'}</p>

                                    <div className="space-y-8">
                                        {previewData.elements?.map(el => (
                                            <SurveyPreviewRenderer key={el.id} element={el} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    </div>
                    <DialogFooter className="p-6 pt-4 border-t">
                        <Button onClick={() => setIsOpen(false)}>Close Preview</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
