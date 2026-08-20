'use client';

import type { SurveyElement, SurveyQuestion, SurveyLayoutBlock } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Star, Upload, Download, FileText, FileSpreadsheet, FileImage, File as FileIcon } from 'lucide-react';
import Image from 'next/image';
import VideoEmbed from '@/components/video-embed';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FILE_TYPE_PRESETS } from '@/lib/survey-file-utils';
import { extractFileNameFromStorageUrl } from '@/lib/survey-response-utils';

const isQuestion = (element: SurveyElement): element is SurveyQuestion => 'isRequired' in element;

const StarRatingPreview = () => (
    <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => <Star key={star} className="w-8 h-8 text-gray-300" />)}
    </div>
);

export default function SurveyPreviewRenderer({ element }: { element: SurveyElement }) {
    if (element.hidden) {
        return null;
    }

    if (isQuestion(element)) {
        const question = element;
        const textAlign = question.style?.textAlign || 'left';
        const alignmentClass = textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : 'text-left';
        
        return (
            <Card className="border-0 shadow-none bg-transparent">
                <CardContent className={cn("pt-6", alignmentClass)}>
                    <Label className="text-base font-semibold block leading-tight">
                        <span dangerouslySetInnerHTML={{ __html: question.title }} />
                        {question.isRequired && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <div className="mt-4 space-y-2">
                        {question.type === 'text' && <Input placeholder={question.placeholder} disabled />}
                        {question.type === 'long-text' && <Textarea placeholder={question.placeholder} disabled />}
                        {question.type === 'yes-no' && (
                            <RadioGroup disabled className={cn("flex gap-4", textAlign === 'center' && 'justify-center')}>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="Yes" /><Label>Yes</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="No" /><Label>No</Label></div>
                            </RadioGroup>
                        )}
                        {question.type === 'multiple-choice' && (
                            <RadioGroup disabled className="space-y-2">
                                {question.options?.map(opt => <div key={opt} className={cn("flex items-start space-x-2", textAlign === 'center' && 'justify-center')}><RadioGroupItem value={opt} /><Label>{opt}</Label></div>)}
                                {question.allowOther && <div className={cn("flex items-start space-x-2 pt-2", textAlign === 'center' && 'justify-center')}><RadioGroupItem value="__other__" disabled /><Input disabled placeholder="Other (please specify)" className="h-8 flex-1" /></div>}
                            </RadioGroup>
                        )}
                        {question.type === 'checkboxes' && (
                            <div className="space-y-2">
                                {question.options?.map(opt => <div key={opt} className={cn("flex items-start space-x-2", textAlign === 'center' && 'justify-center')}><Checkbox disabled /><Label className="font-normal">{opt}</Label></div>)}
                                {question.allowOther && <div className={cn("flex items-start space-x-2 pt-2", textAlign === 'center' && 'justify-center')}><Checkbox disabled /><Input disabled placeholder="Other (please specify)" className="h-8 flex-1" /></div>}
                            </div>
                        )}
                        {question.type === 'dropdown' && <div className={cn("flex", textAlign === 'center' && 'justify-center')}><Select disabled><SelectTrigger className="w-full sm:w-1/2"><SelectValue placeholder="Select an option" /></SelectTrigger></Select></div>}
                        {question.type === 'rating' && <div className={cn("flex", textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start')}><StarRatingPreview /></div>}
                        {question.type === 'date' && <div className={cn("flex", textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start')}><Button variant="outline" disabled className="w-[280px] justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4" /><span>Pick a date</span></Button></div>}
                        {question.type === 'time' && <div className={cn("flex", textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start')}><Input type="time" step="1" disabled className="w-fit bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none" /></div>}
                        {question.type === 'file-upload' && (
                            <div className={cn("w-full max-w-2xl", textAlign === 'center' ? 'mx-auto' : textAlign === 'right' ? 'ml-auto' : 'mr-auto')}>
                                <div className="p-6 sm:p-8 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 text-center flex flex-col items-center justify-center space-y-3">
                                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                        <Upload className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-foreground">
                                            <span className="text-primary underline underline-offset-4">Click to upload</span> or drag and drop
                                        </p>
                                        <p className="text-xs font-semibold text-muted-foreground mt-1">
                                            {(() => {
                                                if (!question.allowedFileTypes || question.allowedFileTypes.length === 0 || question.allowedFileTypes.includes('all')) {
                                                    return `Any format • Max ${question.maxFileSizeMB || 25}MB`;
                                                }
                                                const hints: string[] = [];
                                                question.allowedFileTypes.forEach((t) => {
                                                    if (t === 'custom' && question.customFileExtensions) {
                                                        hints.push(question.customFileExtensions);
                                                    } else if (FILE_TYPE_PRESETS[t]) {
                                                        hints.push(FILE_TYPE_PRESETS[t].label.split(' ')[0]);
                                                    }
                                                });
                                                return `Accepts ${hints.join(', ')} • Max ${question.maxFileSizeMB || 25}MB`;
                                            })()}
                                            {question.allowMultipleFiles && ` • Up to ${question.maxFiles || 5} files`}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    }

    const block = element as SurveyLayoutBlock;
    const textAlign = block.style?.textAlign || 'left';
    const alignmentClass = textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : 'text-left';

    switch (block.type) {
        case 'section':
            return (
                <div className="my-6 border-b pb-4 text-center">
                    <h2 id={block.id} className="text-3xl font-bold" dangerouslySetInnerHTML={{ __html: block.title || '' }} />
                    {block.description && <div className="text-muted-foreground mt-2" dangerouslySetInnerHTML={{ __html: block.description }} />}
                    {block.renderAsPage && <Badge variant="outline" className="mt-4 mx-auto block w-fit">New Page</Badge>}
                </div>
            );
        case 'heading': {
            const Tag = block.variant || 'h2';
            const sizeClass = Tag === 'h1' ? "text-3xl font-black" : Tag === 'h3' ? "text-xl font-bold" : "text-2xl font-bold";
            return <Tag id={block.id} className={cn(sizeClass, alignmentClass, "mt-8 mb-4 border-b pb-2")} dangerouslySetInnerHTML={{ __html: block.title || '' }} />;
        }
        case 'description': 
            return <div className={cn("text-muted-foreground my-4", alignmentClass)} dangerouslySetInnerHTML={{ __html: block.text || '' }} />;
        case 'divider': return <hr className="my-8 border-t-2" />;
        case 'image': return block.url ? <div className={cn("relative aspect-video my-6 rounded-lg overflow-hidden", textAlign === 'center' && 'mx-auto max-w-2xl')}><Image src={block.url} alt={block.title || 'Survey Image'} fill className="object-contain" sizes="(max-width: 768px) 100vw, 640px" /></div> : null;
        case 'video': return block.url ? <div className={cn("my-6", textAlign === 'center' && 'mx-auto max-w-2xl')}><VideoEmbed url={block.url} thumbnailUrl={block.thumbnailUrl} /></div> : null;
        case 'audio': return block.url ? <audio controls src={block.url} className="w-full my-6" /> : null;
        case 'document': {
            const hasCopy = Boolean(block.title?.trim() || block.description?.trim());
            const rawFileName = block.fileName || (block.url ? extractFileNameFromStorageUrl(block.url) : 'Document');
            const ext = rawFileName.includes('.') ? rawFileName.substring(rawFileName.lastIndexOf('.')).toLowerCase() : '';
            const isSpreadsheet = ['.xlsx', '.xls', '.csv'].includes(ext);
            const isPdf = ext === '.pdf';
            const isImage = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
            const buttonLabel = block.buttonText?.trim() || 'Download Document';

            return (
                <div id={block.id} className={cn("my-6 w-full max-w-2xl", textAlign === 'center' ? 'mx-auto' : textAlign === 'right' ? 'ml-auto' : 'mr-auto')}>
                    {hasCopy ? (
                        <div className="p-6 rounded-2xl bg-card border border-border/60 shadow-sm space-y-4 text-left">
                            <div className="flex items-center gap-3.5">
                                <div className={cn(
                                    "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                                    isSpreadsheet ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" :
                                    isPdf ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" :
                                    isImage ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20" :
                                    "bg-primary/10 text-primary border border-primary/20"
                                )}>
                                    {isSpreadsheet ? <FileSpreadsheet className="h-5 w-5" /> : isPdf ? <FileText className="h-5 w-5" /> : isImage ? <FileImage className="h-5 w-5" /> : <FileIcon className="h-5 w-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    {block.title && (
                                        <h4 className="text-base sm:text-lg font-bold tracking-tight text-foreground leading-snug">
                                            {block.title}
                                        </h4>
                                    )}
                                    <p className="text-xs font-semibold text-muted-foreground truncate">{rawFileName}</p>
                                </div>
                            </div>

                            {block.description && (
                                <p className="text-sm text-muted-foreground font-medium leading-relaxed whitespace-pre-wrap pl-0.5">
                                    {block.description}
                                </p>
                            )}

                            {block.url && (
                                <div className="pt-2">
                                    <Button asChild variant="outline" className="min-h-[44px] h-11 px-6 rounded-xl border-2 font-bold shadow-sm text-sm tracking-tight w-full sm:w-auto">
                                        <a href={block.url} target="_blank" rel="noopener noreferrer">
                                            <Download className="mr-2 h-4 w-4 text-primary" />
                                            {buttonLabel}
                                        </a>
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : block.url ? (
                        <div className={alignmentClass}>
                            <Button asChild variant="outline" className="min-h-[44px] h-12 px-8 rounded-xl border-2 font-bold shadow-sm text-base tracking-tight">
                                <a href={block.url} target="_blank" rel="noopener noreferrer">
                                    <Download className="mr-2.5 h-5 w-5 text-primary" />
                                    {buttonLabel}
                                </a>
                            </Button>
                        </div>
                    ) : null}
                </div>
            );
        }
        case 'embed': return block.html ? <div className="my-6" dangerouslySetInnerHTML={{ __html: block.html }} /> : null;
        default: return null;
    }
}