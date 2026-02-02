
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
        return (
            <Card>
                <CardContent className="pt-6">
                    <Label className="text-base font-semibold">
                        {question.title}
                        {question.isRequired && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <div className="mt-4 space-y-2">
                        {question.type === 'text' && <Input placeholder={question.placeholder} disabled />}
                        {question.type === 'long-text' && <Textarea placeholder={question.placeholder} disabled />}
                        {question.type === 'yes-no' && (
                            <RadioGroup disabled className="flex gap-4">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="Yes" /><Label>Yes</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="No" /><Label>No</Label></div>
                            </RadioGroup>
                        )}
                        {question.type === 'multiple-choice' && (
                            <RadioGroup disabled className="space-y-2">
                                {question.options?.map(opt => <div key={opt} className="flex items-center space-x-2"><RadioGroupItem value={opt} /><Label>{opt}</Label></div>)}
                            </RadioGroup>
                        )}
                        {question.type === 'checkboxes' && (
                            <div className="space-y-2">
                                {question.options?.map(opt => <div key={opt} className="flex items-start space-x-2"><Checkbox disabled /><Label className="font-normal">{opt}</Label></div>)}
                                {question.allowOther && <div className="flex items-start space-x-2 pt-2"><Checkbox disabled /><Input disabled placeholder="Other (please specify)" className="h-8 flex-1" /></div>}
                            </div>
                        )}
                        {question.type === 'dropdown' && <Select disabled><SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger></Select>}
                        {question.type === 'rating' && <StarRatingPreview />}
                        {question.type === 'date' && <Button variant="outline" disabled className="w-[280px] justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4" /><span>Pick a date</span></Button>}
                        {question.type === 'time' && <Input type="time" step="1" disabled className="w-fit bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none" />}
                        {question.type === 'file-upload' && (
                            <Button variant="outline" disabled>
                                <Upload className="mr-2 h-4 w-4" />
                                Upload a file
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    }

    const block = element as SurveyLayoutBlock;
    switch (block.type) {
        case 'section': return <h2 className="text-2xl font-bold mt-12 mb-6 border-b-2 border-primary pb-2">{block.title}</h2>;
        case 'heading': return <h2 className="text-2xl font-bold mt-8 mb-4 border-b pb-2">{block.title}</h2>;
        case 'description': return <p className="text-muted-foreground my-4">{block.text}</p>;
        case 'divider': return <hr className="my-8" />;
        case 'image': return block.url ? <div className="relative aspect-video my-6 rounded-lg overflow-hidden"><Image src={block.url} alt={block.title || 'Survey Image'} layout="fill" objectFit="contain" /></div> : null;
        case 'video': return block.url ? <div className="my-6"><VideoEmbed url={block.url} /></div> : null;
        case 'audio': return block.url ? <audio controls src={block.url} className="w-full my-6" /> : null;
        case 'document': return block.url ? <Button asChild variant="outline" className="my-6"><a href={block.url} target="_blank" rel="noopener noreferrer">Download Document</a></Button> : null;
        case 'embed': return block.html ? <div className="my-6" dangerouslySetInnerHTML={{ __html: block.html }} /> : null;
        case 'logic': return null;
        default: return null;
    }
}
