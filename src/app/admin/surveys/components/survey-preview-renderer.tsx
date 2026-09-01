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
                <CardContent className="p-0 space-y-6">
                    <div>
                        <div className={cn("flex items-start gap-2", textAlign === 'center' && 'justify-center')}>
                            <Label className="text-2xl font-bold tracking-tight">{question.title}</Label>
                            {question.isRequired && <span className="text-destructive font-bold text-lg leading-none">*</span>}
                        </div>
                        {question.description && (
                            <p className={cn("text-muted-foreground text-sm font-medium mt-1.5 leading-relaxed", alignmentClass)}>
                                {question.description}
                            </p>
                        )}
                    </div>

                    <div className="pt-2">
                        {question.type === 'text' && (
                            <Input disabled placeholder={question.placeholder || "Type your answer here..."} className="h-12 bg-muted/5 border-2 border-muted/50 rounded-xl px-4 text-base font-medium shadow-none" />
                        )}
                        {question.type === 'long-text' && (
                            <Textarea disabled placeholder={question.placeholder || "Type your detailed response here..."} className="min-h-[140px] bg-muted/5 border-2 border-muted/50 rounded-xl p-4 text-base font-medium resize-none shadow-none" />
                        )}
                        {question.type === 'email' && (
                            <Input disabled type="email" placeholder={question.placeholder || "name@example.com"} className="h-12 bg-muted/5 border-2 border-muted/50 rounded-xl px-4 text-base font-medium shadow-none" />
                        )}
                        {question.type === 'phone' && (
                            <Input disabled type="tel" placeholder={question.placeholder || "+1 (555) 000-0000"} className="h-12 bg-muted/5 border-2 border-muted/50 rounded-xl px-4 text-base font-medium shadow-none" />
                        )}
                        {question.type === 'number' && (
                            <Input disabled type="number" placeholder={question.placeholder || "0"} className="h-12 bg-muted/5 border-2 border-muted/50 rounded-xl px-4 text-base font-medium shadow-none" />
                        )}
                        {question.type === 'link' && (
                            <Input disabled type="url" placeholder={question.placeholder || "https://example.com"} className="h-12 bg-muted/5 border-2 border-muted/50 rounded-xl px-4 text-base font-medium shadow-none" />
                        )}
                        {question.type === 'yes-no' && (
                            <div className={cn("flex gap-4", textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start')}>
                                <Button variant="outline" disabled className="h-12 px-8 rounded-xl font-bold border-2 border-muted/50 bg-muted/5">Yes</Button>
                                <Button variant="outline" disabled className="h-12 px-8 rounded-xl font-bold border-2 border-muted/50 bg-muted/5">No</Button>
                            </div>
                        )}
                        {question.type === 'multiple-choice' && (
                            <RadioGroup disabled className="space-y-3">
                                {question.options?.map(opt => (
                                    <div key={opt} className={cn("flex items-center space-x-3 p-3 rounded-lg border border-muted/20 opacity-60 bg-muted/5", textAlign === 'center' && 'justify-center')}>
                                        <RadioGroupItem value={opt} id={opt} />
                                        <Label htmlFor={opt} className="text-base font-medium">{opt}</Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        )}
                        {question.type === 'checkboxes' && (
                            <div className="space-y-3">
                                {question.options?.map(opt => (
                                    <div key={opt} className={cn("flex items-center space-x-3 p-3 rounded-lg border border-muted/20 opacity-60 bg-muted/5", textAlign === 'center' && 'justify-center')}>
                                        <Checkbox disabled id={opt} className="h-5 w-5 rounded-md" />
                                        <Label htmlFor={opt} className="text-base font-medium">{opt}</Label>
                                    </div>
                                ))}
                            </div>
                        )}
                        {question.type === 'dropdown' && (
                            <div className={cn("flex", textAlign === 'center' && 'justify-center')}>
                                <Select disabled>
                                    <SelectTrigger className="w-full sm:w-1/2 h-12 rounded-xl border-2 border-muted/50 bg-muted/5 font-medium px-4">
                                        <SelectValue placeholder="Select an option" />
                                    </SelectTrigger>
                                </Select>
                            </div>
                        )}
                        {question.type === 'rating' && (
                            <div className={cn("flex", textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start')}>
                                <StarRatingPreview />
                            </div>
                        )}
                        {question.type === 'date' && (
                            <div className={cn("flex", textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start')}>
                                <Button variant="outline" disabled className="h-12 w-full sm:w-[280px] justify-start text-left font-medium border-2 border-muted/50 rounded-xl px-4 opacity-70">
                                    <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
                                    <span>Pick a date</span>
                                </Button>
                            </div>
                        )}
                        {question.type === 'time' && (
                            <div className={cn("flex", textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start')}>
                                <div className="h-12 w-full sm:w-fit px-4 border-2 border-muted/50 rounded-xl bg-muted/5 flex items-center gap-2 opacity-60">
                                    <span className="font-mono text-lg">00:00:00</span>
                                </div>
                            </div>
                        )}
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
                        {question.type === 'matrix' && (
                            <div className="w-full border border-border/70 rounded-2xl overflow-hidden bg-card/60">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-muted/50 border-b border-border/50">
                                            <tr>
                                                <th className="p-3 text-left font-bold text-muted-foreground w-1/3">Item / Statement</th>
                                                {(question.matrixColumns || ['Poor', 'Fair', 'Good', 'Excellent']).map((col, cIdx) => (
                                                    <th key={cIdx} className="p-3 text-center font-bold text-muted-foreground">
                                                        {col}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/40">
                                            {(question.matrixRows || ['Statement 1', 'Statement 2', 'Statement 3']).map((row, rIdx) => (
                                                <tr key={rIdx}>
                                                    <td className="p-3 font-medium text-foreground">{row}</td>
                                                    {(question.matrixColumns || ['Poor', 'Fair', 'Good', 'Excellent']).map((_, cIdx) => (
                                                        <td key={cIdx} className="p-3 text-center">
                                                            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 mx-auto" />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {question.type === 'ranking' && (
                            <div className="space-y-2 max-w-lg">
                                {(question.rankingItems || ['Item 1', 'Item 2', 'Item 3']).map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-border/70 bg-card">
                                        <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                                            {idx + 1}
                                        </div>
                                        <span className="text-xs font-medium flex-1">{item}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {question.type === 'slider' && (
                            <div className="p-6 rounded-2xl border border-border/60 bg-muted/10 space-y-4 max-w-lg">
                                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                                    <span>{question.sliderMinLabel || `${question.sliderMin || 0}`}</span>
                                    <Badge variant="secondary" className="font-mono text-xs">
                                        {Math.round(((question.sliderMin || 0) + (question.sliderMax || 100)) / 2)}
                                    </Badge>
                                    <span>{question.sliderMaxLabel || `${question.sliderMax || 100}`}</span>
                                </div>
                                <div className="w-full h-2.5 bg-muted rounded-full relative overflow-hidden">
                                    <div className="h-full bg-primary rounded-full w-1/2" />
                                </div>
                            </div>
                        )}
                        {question.type === 'nps' && (
                            <div className="space-y-3 p-4 rounded-2xl border border-border/60 bg-muted/10 max-w-2xl">
                                <div className="flex flex-wrap gap-1.5 justify-center">
                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                                        <div
                                            key={score}
                                            className="w-9 h-11 rounded-xl flex items-center justify-center font-bold text-xs border border-border bg-card shadow-2xs"
                                        >
                                            {score}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 font-medium">
                                    <span>{question.npsMinLabel || '0 - Not at all likely'}</span>
                                    <span>{question.npsMaxLabel || '10 - Extremely likely'}</span>
                                </div>
                            </div>
                        )}
                        {question.type === 'ces' && (
                            <div className="space-y-3 p-4 rounded-2xl border border-border/60 bg-muted/10 max-w-xl">
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {[1, 2, 3, 4, 5, 6, 7].map((score) => (
                                        <div
                                            key={score}
                                            className="w-10 h-11 rounded-xl flex items-center justify-center font-bold text-xs border border-border bg-card shadow-2xs"
                                        >
                                            {score}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 font-medium">
                                    <span>{question.cesMinLabel || '1 - Strongly Disagree'}</span>
                                    <span>{question.cesMaxLabel || '7 - Strongly Agree'}</span>
                                </div>
                            </div>
                        )}
                        {question.type === 'signature' && (
                            <div className="p-6 rounded-2xl border-2 border-dashed border-border/80 bg-card text-center space-y-2 max-w-md">
                                <div className="text-xs font-serif italic text-muted-foreground">Digital Signature Area</div>
                                <div className="h-px w-48 bg-muted-foreground/30 mx-auto" />
                            </div>
                        )}
                        {question.type === 'consent' && (
                            <div className="p-4 rounded-2xl border border-border/70 bg-muted/20 flex items-start gap-3 max-w-xl">
                                <Checkbox disabled checked className="mt-0.5" />
                                <div className="text-xs font-medium text-foreground">
                                    {question.consentText || 'I agree to the terms and privacy policy.'}
                                </div>
                            </div>
                        )}
                        {question.type === 'calculated' && (
                            <div className="p-4 rounded-2xl border border-primary/30 bg-primary/5 space-y-1 text-xs max-w-md">
                                <div className="font-bold text-primary">Dynamic Computed Field</div>
                                <div className="font-mono text-muted-foreground">
                                    {question.calculationFormula || 'q1 * 0.5 + q2 * 0.5'}
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
                <div className="my-10 border-b-2 border-muted/50 pb-6 text-center">
                    <Badge variant="secondary" className="mb-2 uppercase tracking-widest text-[10px] font-black">Section</Badge>
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
            return <div className={cn("text-muted-foreground text-lg leading-relaxed font-medium mb-8 whitespace-pre-wrap opacity-80", alignmentClass)} dangerouslySetInnerHTML={{ __html: block.text || '' }} />;
        case 'divider': return <hr className="my-12 border-t-2 border-muted-foreground/10" />;
        case 'image': return block.url ? (
            <div className={cn("relative aspect-video my-10 rounded-2xl overflow-hidden shadow-xl border-4 border-white/50", textAlign === 'center' && 'mx-auto max-w-2xl')}>
                <Image src={block.url} alt={block.title || 'Survey Image'} fill className="object-cover" sizes="(max-width: 768px) 100vw, 640px" />
            </div>
        ) : null;
        case 'video': return block.url ? <div className={cn("my-10 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/50", textAlign === 'center' && 'mx-auto max-w-2xl')}><VideoEmbed url={block.url} thumbnailUrl={block.thumbnailUrl} /></div> : null;
        case 'audio': return block.url ? <div className="my-8 p-6 bg-muted/20 border-2 border-muted/50 rounded-2xl"><audio controls src={block.url} className="w-full" /></div> : null;
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
        case 'embed': return block.html ? <div className="my-10 rounded-2xl overflow-hidden border shadow-inner" dangerouslySetInnerHTML={{ __html: block.html }} /> : null;
        default: return null;
    }
}