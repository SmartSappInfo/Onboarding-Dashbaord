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
import { CalendarIcon, Star, Upload } from 'lucide-react';
import Image from 'next/image';
import VideoEmbed from '@/components/video-embed';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
        const alignmentClass = textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : textAlign === 'justify' ? 'text-justify' : 'text-left';
        const isTextInput = ['text', 'long-text', 'email', 'phone', 'number', 'link'].includes(question.type);

        return (
            <Card className="overflow-hidden border-2 border-muted/20 shadow-sm transition-all hover:shadow-md">
                <CardContent className={cn("pt-8 pb-10 px-8", alignmentClass)}>
                    <div className="space-y-2 mb-6">
                        <Label className="text-xl font-bold block leading-tight tracking-tight text-foreground/90">
                            <span dangerouslySetInnerHTML={{ __html: question.title }} />
                            {question.isRequired && <span className="text-destructive ml-1.5">*</span>}
                        </Label>
                        {question.description && (
                            <div 
                                className="text-sm text-muted-foreground font-medium leading-relaxed opacity-70"
                                dangerouslySetInnerHTML={{ __html: question.description }}
                            />
                        )}
                    </div>
                    
                    <div className="space-y-4">
                        {isTextInput && (
                            <Input 
                                disabled 
                                placeholder={question.placeholder || (
                                    question.type === 'email' ? 'email@example.com' : 
                                    question.type === 'phone' ? '+1 555-0123' : 
                                    question.type === 'number' ? 'e.g. 42' : 
                                    question.type === 'link' ? 'https://example.com' : 
                                    "Type your answer here..."
                                )} 
                                className="h-12 bg-muted/5 border-2 border-muted/50 rounded-xl px-4 italic"
                            />
                        )}
                        {question.type === 'long-text' && <Textarea placeholder={question.placeholder || "Share your thoughts..."} disabled className="min-h-[100px] bg-muted/5 border-2 border-muted/50 rounded-xl p-4 italic" />}
                        {question.type === 'yes-no' && (
                            <RadioGroup disabled className={cn("flex gap-6", textAlign === 'center' && 'justify-center')}>
                                <div className="flex items-center space-x-3 opacity-60"><RadioGroupItem value="Yes" className="h-5 w-5" /><Label className="text-base">Yes</Label></div>
                                <div className="flex items-center space-x-3 opacity-60"><RadioGroupItem value="No" className="h-5 w-5" /><Label className="text-base">No</Label></div>
                            </RadioGroup>
                        )}
                        {question.type === 'multiple-choice' && (
                            <RadioGroup disabled className="space-y-3">
                                {question.options?.map(opt => (
                                    <div key={opt} className={cn("flex items-center space-x-3 p-3 rounded-lg border border-muted/20 opacity-60 bg-muted/5", textAlign === 'center' && 'justify-center')}>
                                        <RadioGroupItem value={opt} className="h-5 w-5" />
                                        <Label className="text-base font-medium">{opt}</Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        )}
                        {question.type === 'checkboxes' && (
                            <div className="space-y-3">
                                {question.options?.map(opt => (
                                    <div key={opt} className={cn("flex items-center space-x-3 p-3 rounded-lg border border-muted/20 opacity-60 bg-muted/5", textAlign === 'center' && 'justify-center')}>
                                        <Checkbox disabled className="h-5 w-5 rounded-md" />
                                        <Label className="text-base font-medium">{opt}</Label>
                                    </div>
                                ))}
                                {question.allowOther && (
                                    <div className={cn("flex items-center gap-3 pt-2", textAlign === 'center' && 'justify-center')}>
                                        <Checkbox disabled className="h-5 w-5 rounded-md opacity-40" />
                                        <div className="h-10 flex-1 border-b-2 border-dashed border-muted-foreground/20 text-muted-foreground/40 text-sm flex items-center px-2">Other (please specify)</div>
                                    </div>
                                )}
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
                            <div className={cn("flex", textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start')}>
                                <Button variant="outline" disabled className="h-14 px-8 border-2 border-dashed border-primary/30 rounded-xl bg-primary/5 text-primary font-bold uppercase tracking-widest transition-all">
                                    <Upload className="mr-3 h-5 w-5" />
                                    Upload Document
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    }

    const block = element as SurveyLayoutBlock;
    const textAlign = block.style?.textAlign || 'left';
    const alignmentClass = textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : textAlign === 'justify' ? 'text-justify' : 'text-left';

    switch (block.type) {
        case 'section': 
            return (
                <div className="my-16 pb-8 border-b-2 border-dashed border-muted/30 text-center">
                    <h2 id={block.id} className="text-3xl font-black tracking-tight text-foreground/80" dangerouslySetInnerHTML={{ __html: block.title || '' }} />
                    {block.description && <div className="text-muted-foreground mt-3 text-lg font-medium opacity-60 max-w-2xl mx-auto" dangerouslySetInnerHTML={{ __html: block.description }} />}
                    {block.renderAsPage && <Badge variant="secondary" className="mt-6 px-4 py-1 text-xs font-bold uppercase tracking-widest rounded-full">Separate Page</Badge>}
                </div>
            );
        case 'heading': {
            const Tag = (block.variant || 'h2') as any;
            const sizeClass = Tag === 'h1' ? "text-4xl font-extrabold" : Tag === 'h3' ? "text-2xl font-bold" : "text-3xl font-bold";
            return <Tag id={block.id} className={cn(sizeClass, alignmentClass, "mt-12 mb-6 text-foreground/90 leading-tight")}>
                <span dangerouslySetInnerHTML={{ __html: block.title || '' }} />
            </Tag>;
        }
        case 'description': 
            return <div className={cn("text-muted-foreground text-lg leading-relaxed font-medium mb-8 whitespace-pre-wrap opacity-80", alignmentClass)} dangerouslySetInnerHTML={{ __html: block.text || '' }} />;
        case 'divider': return <hr className="my-12 border-t-2 border-muted-foreground/10" />;
        case 'image': return block.url ? (
            <div className={cn("relative aspect-video my-10 rounded-2xl overflow-hidden shadow-xl border-4 border-white/50", textAlign === 'center' && 'mx-auto max-w-2xl')}>
                <Image src={block.url} alt={block.title || 'Survey Image'} layout="fill" objectFit="cover" />
            </div>
        ) : null;
        case 'video': return block.url ? <div className={cn("my-10 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/50", textAlign === 'center' && 'mx-auto max-w-2xl')}><VideoEmbed url={block.url} /></div> : null;
        case 'audio': return block.url ? <div className="my-8 p-6 bg-muted/20 border-2 border-muted/50 rounded-2xl"><audio controls src={block.url} className="w-full" /></div> : null;
        case 'document': return block.url ? (
            <div className={alignmentClass}>
                <Button asChild variant="outline" className="h-14 px-8 rounded-xl border-2 font-bold shadow-sm transition-all hover:shadow-md text-base uppercase tracking-widest">
                    <a href={block.url} target="_blank" rel="noopener noreferrer">Download Document</a>
                </Button>
            </div>
        ) : null;
        case 'embed': return block.html ? <div className="my-10 rounded-2xl overflow-hidden border shadow-inner" dangerouslySetInnerHTML={{ __html: block.html }} /> : null;
        default: return null;
    }
}