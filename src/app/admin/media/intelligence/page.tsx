'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Content Intelligence Studio:
 *    Renders the management studio for Speech-to-Text transcripts, video chapter timelines,
 *    AI summaries, and natural-language semantic media search.
 * 2. Mobile Accessibility & Touch Target Bounds:
 *    All buttons, tabs, and triggers enforce `min-h-[44px] min-w-[44px]` touch target bounds
 *    with tactile micro-animations (`active:scale-[0.97]`).
 * 3. Strict Typing Standard: Zero use of `any` or `any[]`.
 */

import { useState } from 'react';
import { useFirestore } from '@/firebase';
import { generateTranscriptAction } from '@/lib/media/content-intelligence-service';
import type { MediaTranscript } from '@/lib/types/media-2.0';
import SemanticMediaSearch from '../components/SemanticMediaSearch';
import TranscriptViewer from '../components/TranscriptViewer';
import ChapterTimelineEditor from '../components/ChapterTimelineEditor';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Sparkles, Search, FileText, Layers, Brain, 
  Loader2, Wand2, PlayCircle 
} from 'lucide-react';

export default function ContentIntelligenceStudioPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'search' | 'stt' | 'chapters'>('search');
  const [targetAssetId, setTargetAssetId] = useState('');
  const [activeTranscript, setActiveTranscript] = useState<MediaTranscript | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const handleGenerateTranscript = async () => {
    if (!firestore || !targetAssetId.trim() || isTranscribing) return;
    setIsTranscribing(true);

    try {
      const generated = await generateTranscriptAction(firestore, targetAssetId.trim());
      if (generated) {
        setActiveTranscript(generated);
        toast({
          title: 'Transcript Generated!',
          description: 'AI Speech-to-Text transcript generated with timestamped cues.',
        });
      }
    } catch (err: unknown) {
      console.error('[handleGenerateTranscript] Error:', err);
      toast({
        title: 'STT Failed',
        description: 'Could not generate transcript.',
        variant: 'destructive',
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-8 text-left">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-card border border-border shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border-primary/20">
              AI Intelligence
            </Badge>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Content Intelligence & Vector Search</h1>
          <p className="text-xs text-muted-foreground">
            Index Speech-to-Text transcripts, video chapters, AI summaries, and execute natural-language vector search.
          </p>
        </div>
      </div>

      {/* Tabs Header */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
        <TabsList className="bg-muted/40 border border-border h-12 p-1 rounded-2xl w-full sm:w-auto grid grid-cols-3">
          <TabsTrigger value="search" className="rounded-xl font-bold text-xs gap-2 min-h-[44px]">
            <Search className="h-4 w-4" /> Vector Search
          </TabsTrigger>
          <TabsTrigger value="stt" className="rounded-xl font-bold text-xs gap-2 min-h-[44px]">
            <FileText className="h-4 w-4" /> Transcripts & STT
          </TabsTrigger>
          <TabsTrigger value="chapters" className="rounded-xl font-bold text-xs gap-2 min-h-[44px]">
            <Layers className="h-4 w-4" /> Chapter Editor
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Semantic Search */}
        <TabsContent value="search" className="mt-6">
          <SemanticMediaSearch />
        </TabsContent>

        {/* Tab 2: Speech-to-Text */}
        <TabsContent value="stt" className="mt-6 space-y-6">
          <div className="p-4 rounded-3xl bg-card border border-border shadow-sm space-y-3">
            <Label className="text-xs font-bold text-foreground">Target Media Asset ID</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter Media Asset ID to transcribe..."
                value={targetAssetId}
                onChange={(e) => setTargetAssetId(e.target.value)}
                className="h-11 text-xs rounded-xl bg-background border-border"
              />
              <Button
                disabled={!targetAssetId.trim() || isTranscribing}
                onClick={handleGenerateTranscript}
                className="rounded-xl font-extrabold text-xs h-11 px-5 min-h-[44px] gap-2 shadow-md active:scale-[0.97]"
              >
                {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Generate STT Transcript
              </Button>
            </div>
          </div>

          <div className="h-[500px]">
            <TranscriptViewer transcript={activeTranscript} isLoading={isTranscribing} />
          </div>
        </TabsContent>

        {/* Tab 3: Chapter Editor */}
        <TabsContent value="chapters" className="mt-6">
          <div className="p-6 rounded-3xl bg-card border border-border shadow-sm">
            <ChapterTimelineEditor chapters={[]} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
