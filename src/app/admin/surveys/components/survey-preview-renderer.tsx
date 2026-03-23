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

        return (
            <Card>
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
                                {question.options?.map(opt => <div key={opt} className={cn("flex items-center space-x-2", textAlign === 'center' && 'justify-center')}><RadioGroupItem value={opt} /><Label>{opt}</Label></div>)}
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
                            <div className={cn("flex", textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start')}>
                                <Button variant="outline" disabled>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Upload a file
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
                <div className="my-12 pt-4 border-t-4 border-dashed border-border text-center">
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
        case 'image': return block.url ? <div className={cn("relative aspect-video my-6 rounded-lg overflow-hidden", textAlign === 'center' && 'mx-auto max-w-2xl')}><Image src={block.url} alt={block.title || 'Survey Image'} layout="fill" objectFit="contain" /></div> : null;
        case 'video': return block.url ? <div className={cn("my-6", textAlign === 'center' && 'mx-auto max-w-2xl')}><VideoEmbed url={block.url} /></div> : null;
        case 'audio': return block.url ? <audio controls src={block.url} className="w-full my-6" /> : null;
        case 'document': return block.url ? <div className={alignmentClass}><Button asChild variant="outline" className="my-6"><a href={block.url} target="_blank" rel="noopener noreferrer">Download Document</a></Button></div> : null;
        case 'embed': return block.html ? <div className="my-6" dangerouslySetInnerHTML={{ __html: block.html }} /> : null;
        case 'logic': return null;
        default: return null;
    }
}