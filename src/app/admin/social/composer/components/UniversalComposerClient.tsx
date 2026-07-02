'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageContainerFluid } from '@/components/ui/page-container';
import { 
  Sparkles, 
  Linkedin, 
  Facebook, 
  Instagram, 
  Twitter, 
  Youtube, 
  Send, 
  Calendar, 
  Loader2, 
  Eye, 
  Settings, 
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Globe
} from 'lucide-react';
import BrandVoiceSettings from '../../components/BrandVoiceSettings';
import { generateSocialVariationAction, createSocialPostAction } from '@/app/actions/social-composer-actions';
import { cn } from '@/lib/utils';

// Icon platform resolution
const platformIcons: Record<string, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  x: Twitter,
  youtube: Youtube,
};

const platformColors: Record<string, { text: string; border: string; bg: string }> = {
  facebook: { text: 'text-blue-500', border: 'border-blue-500/20', bg: 'bg-blue-500/5' },
  instagram: { text: 'text-pink-500', border: 'border-pink-500/20', bg: 'bg-pink-500/5' },
  linkedin: { text: 'text-indigo-500', border: 'border-indigo-500/20', bg: 'bg-indigo-500/5' },
  x: { text: 'text-slate-400', border: 'border-slate-500/20', bg: 'bg-slate-500/5' },
  youtube: { text: 'text-red-500', border: 'border-red-500/20', bg: 'bg-red-500/5' },
};

interface PlatformDetail {
  caption: string;
  mediaUrls: string[];
  hashtags: string[];
  scheduledTime: string;
  generating: boolean;
}

export default function UniversalComposerClient() {
  const router = useRouter();
  const { activeWorkspaceId, activeOrganizationId } = useTenant();
  const { toast } = useToast();

  const [baseCaption, setBaseCaption] = React.useState('');
  const [postTitle, setPostTitle] = React.useState('');
  const [mediaUrlInput, setMediaUrlInput] = React.useState('');
  const [mediaUrls, setMediaUrls] = React.useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = React.useState<Record<string, boolean>>({
    linkedin: true,
    facebook: false,
    instagram: false,
    x: false,
  });

  const [platformData, setPlatformData] = React.useState<Record<string, PlatformDetail>>({
    linkedin: { caption: '', mediaUrls: [], hashtags: [], scheduledTime: '', generating: false },
    facebook: { caption: '', mediaUrls: [], hashtags: [], scheduledTime: '', generating: false },
    instagram: { caption: '', mediaUrls: [], hashtags: [], scheduledTime: '', generating: false },
    x: { caption: '', mediaUrls: [], hashtags: [], scheduledTime: '', generating: false },
    youtube: { caption: '', mediaUrls: [], hashtags: [], scheduledTime: '', generating: false },
  });

  const [isPublishing, setIsPublishing] = React.useState(false);
  const [activePreviewTab, setActivePreviewTab] = React.useState('linkedin');

  // Trigger AI adaptation per platform
  const handleAdaptPlatform = async (platform: string) => {
    if (!baseCaption.trim()) {
      toast({
        title: 'Draft is Empty',
        description: 'Please write a base draft idea first before generating variations.',
        variant: 'destructive',
      });
      return;
    }

    setPlatformData(prev => ({
      ...prev,
      [platform]: { ...prev[platform], generating: true }
    }));

    try {
      const res = await generateSocialVariationAction({
        basePrompt: baseCaption,
        platform,
        workspaceId: activeWorkspaceId,
        orgId: activeOrganizationId,
      });

      if (res.success && res.text) {
        setPlatformData(prev => ({
          ...prev,
          [platform]: { 
            ...prev[platform], 
            caption: res.text || '', 
            generating: false 
          }
        }));
        toast({
          title: 'Copy Tailored',
          description: `Optimized variation generated successfully for ${platform}.`,
        });
      } else {
        throw new Error(res.error || 'API generation returned failed status');
      }
    } catch (err: unknown) {
      console.error(`[COMPOSER:ADAPT:${platform}] Error:`, err);
      const msg = err instanceof Error ? err.message : 'Unknown generation error';
      setPlatformData(prev => ({
        ...prev,
        [platform]: { ...prev[platform], generating: false }
      }));
      toast({
        title: 'Adaptation Failed',
        description: msg,
        variant: 'destructive',
      });
    }
  };

  // Run AI adaptation for all selected platforms in parallel (Eliminating Waterfalls)
  const handleAdaptAll = async () => {
    const selected = Object.entries(selectedPlatforms)
      .filter(([_, isSelected]) => isSelected)
      .map(([platform]) => platform);

    if (selected.length === 0) {
      toast({
        title: 'No platforms selected',
        description: 'Select at least one social network to generate variations.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Running AI Studio',
      description: `Adapting content for ${selected.join(', ')}...`,
    });

    await Promise.all(selected.map(platform => handleAdaptPlatform(platform)));
  };

  // Handle Post submission
  const handlePublish = async (status: 'draft' | 'scheduled' | 'published') => {
    if (!postTitle.trim()) {
      toast({
        title: 'Title Required',
        description: 'Please input a post name to categorize this event.',
        variant: 'destructive',
      });
      return;
    }

    const selected = Object.entries(selectedPlatforms)
      .filter(([_, isSelected]) => isSelected)
      .map(([platform]) => platform);

    if (selected.length === 0) {
      toast({
        title: 'Select Platform',
        description: 'You must publish to at least one social network profile.',
        variant: 'destructive',
      });
      return;
    }

    setIsPublishing(true);

    try {
      const variationsPayload: Record<string, {
        caption: string;
        mediaUrls: string[];
        hashtags: string[];
        scheduledTime: string;
        utmParams: { source: string; medium: string; campaign: string; content: string };
      }> = {};

      selected.forEach(platform => {
        const data = platformData[platform];
        variationsPayload[platform] = {
          caption: data.caption || baseCaption,
          mediaUrls,
          hashtags: data.hashtags,
          scheduledTime: data.scheduledTime || new Date().toISOString(),
          utmParams: {
            source: platform,
            medium: 'social',
            campaign: 'social_campaign',
            content: postTitle.toLowerCase().replace(/\s+/g, '_'),
          }
        };
      });

      const res = await createSocialPostAction({
        workspaceId: activeWorkspaceId,
        orgId: activeOrganizationId,
        title: postTitle,
        baseCaption,
        mediaUrls,
        variations: variationsPayload,
        status,
      });

      if (res.success) {
        toast({
          title: status === 'published' ? 'Post Published' : 'Post Saved',
          description: status === 'published' 
            ? 'Your simulated post was processed successfully.' 
            : 'Scheduled social post updated in queue.',
        });
        router.push(`/admin/social/accounts`);
      } else {
        throw new Error(res.error || 'Server Action call returned failure');
      }
    } catch (err: unknown) {
      console.error('[COMPOSER:SAVE] Error:', err);
      const msg = err instanceof Error ? err.message : 'Unknown write error';
      toast({
        title: 'Action Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Add media asset simulation helper
  const handleAddMedia = () => {
    if (!mediaUrlInput.trim()) return;
    setMediaUrls(prev => [...prev, mediaUrlInput.trim()]);
    setMediaUrlInput('');
  };

  return (
    <PageContainerFluid className="space-y-8 max-w-6xl mx-auto py-8">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
            Universal Composer
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Draft once and generate tailored, channel-specific variations utilizing your AI brand voice profile.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="rounded-xl h-10 px-4 font-semibold text-xs tracking-wide active:scale-[0.97] transition-all"
            onClick={() => handlePublish('draft')}
            disabled={isPublishing}
          >
            Save Draft
          </Button>
          <Button 
            variant="secondary" 
            className="rounded-xl h-10 px-4 font-semibold text-xs tracking-wide active:scale-[0.97] transition-all gap-1.5"
            onClick={() => handlePublish('scheduled')}
            disabled={isPublishing}
          >
            <Calendar className="h-4 w-4" /> Schedule Post
          </Button>
          <Button 
            className="rounded-xl h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs tracking-wide active:scale-[0.97] transition-all gap-1.5 shadow-lg shadow-emerald-500/10"
            onClick={() => handlePublish('published')}
            disabled={isPublishing}
          >
            {isPublishing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Publish Now (Simulated)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Editor Configs */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border border-border/30 rounded-3xl bg-card/40 backdrop-blur-md overflow-hidden relative">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Post Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="post-title" className="text-xs font-semibold">Post Title / Campaign Name</Label>
                <Input
                  id="post-title"
                  placeholder="e.g., Open House Promotion - Fall 2026"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  className="rounded-xl border-border/30 h-10 bg-background/50 text-xs"
                />
              </div>

              {/* Target Platforms Toggles */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold block mb-2">Target Platforms</Label>
                <div className="flex flex-wrap gap-3">
                  {Object.keys(selectedPlatforms).map((platform) => {
                    const Icon = platformIcons[platform] || Globe;
                    const colors = platformColors[platform] || { text: 'text-foreground', border: 'border-border/30', bg: 'bg-muted/10' };
                    const isChecked = selectedPlatforms[platform];

                    return (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => {
                          setSelectedPlatforms(prev => ({ ...prev, [platform]: !prev[platform] }));
                          if (!isChecked) setActivePreviewTab(platform);
                        }}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 border rounded-xl font-bold text-xs tracking-wider transition-all duration-200 active:scale-[0.97]",
                          isChecked 
                            ? cn("bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400")
                            : "bg-background/40 border-border/30 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", isChecked ? "text-emerald-500" : "text-muted-foreground")} />
                        <span className="capitalize">{platform}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Base Content Draft */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="base-composer" className="text-xs font-semibold">Base Draft Idea</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleAdaptAll}
                    className="h-8 text-[10px] uppercase font-bold tracking-wider rounded-lg text-emerald-500 hover:bg-emerald-500/10 gap-1 active:scale-[0.97] transition-all"
                  >
                    <Sparkles className="h-3 w-3" /> Adapt Selected with AI
                  </Button>
                </div>
                <Textarea
                  id="base-composer"
                  rows={5}
                  placeholder="e.g., Join us this Saturday at 10am for our Campus Tour. See the classroom spaces, meet teachers, and discover why we are the #1 local choice."
                  value={baseCaption}
                  onChange={(e) => setBaseCaption(e.target.value)}
                  className="rounded-xl border-border/30 bg-background/50 text-xs leading-relaxed"
                />
              </div>

              {/* Media input */}
              <div className="space-y-2">
                <Label htmlFor="media-input" className="text-xs font-semibold">Attachment URLs (Image / Video)</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ImageIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="media-input"
                      placeholder="https://images.unsplash.com/photo-..."
                      value={mediaUrlInput}
                      onChange={(e) => setMediaUrlInput(e.target.value)}
                      className="pl-9 rounded-xl border-border/30 h-10 bg-background/50 text-xs"
                    />
                  </div>
                  <Button 
                    type="button" 
                    onClick={handleAddMedia}
                    className="rounded-xl h-10 px-4 bg-muted text-foreground hover:bg-muted/80 text-xs font-bold active:scale-[0.97]"
                  >
                    Add
                  </Button>
                </div>
                {mediaUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {mediaUrls.map((url, index) => (
                      <div key={index} className="relative rounded-xl border border-border/30 bg-background/40 p-2 pr-8 text-[10px] font-medium truncate max-w-xs">
                        {url}
                        <button
                          type="button"
                          className="absolute right-2 top-2 text-red-500 hover:text-red-600 font-bold"
                          onClick={() => setMediaUrls(prev => prev.filter((_, idx) => idx !== index))}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Dynamic Adaptation Variations Section */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Platform Specific Overrides</h2>
            {Object.entries(selectedPlatforms).filter(([_, isSelected]) => isSelected).map(([platform]) => {
              const Icon = platformIcons[platform] || Globe;
              const data = platformData[platform];

              return (
                <Card key={platform} className="border border-border/30 rounded-2xl bg-card/30 backdrop-blur-sm overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0 border-b border-border/10 bg-muted/10">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="capitalize text-xs font-bold">{platform} Variation</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAdaptPlatform(platform)}
                      disabled={data.generating}
                      className="text-[10px] uppercase font-bold tracking-wider rounded-lg h-7 hover:bg-emerald-500/10 text-emerald-500 gap-1 active:scale-[0.97] transition-all"
                    >
                      {data.generating ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      Re-adapt
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <Textarea
                      rows={3}
                      placeholder={`Tailored copy for ${platform}...`}
                      value={data.caption || baseCaption}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPlatformData(prev => ({
                          ...prev,
                          [platform]: { ...prev[platform], caption: val }
                        }));
                      }}
                      className="rounded-xl border-border/30 bg-background/50 text-xs leading-relaxed"
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right Column: Previews & Settings tabs */}
        <div className="lg:col-span-5 space-y-6">
          <Tabs defaultValue="previews" className="w-full">
            <TabsList className="grid grid-cols-2 rounded-2xl bg-muted/40 p-1 border border-border/20 h-11">
              <TabsTrigger value="previews" className="rounded-xl text-xs font-bold tracking-wider gap-1.5 data-[state=active]:bg-background/80">
                <Eye className="h-4 w-4" /> Live Previews
              </TabsTrigger>
              <TabsTrigger value="voice-settings" className="rounded-xl text-xs font-bold tracking-wider gap-1.5 data-[state=active]:bg-background/80">
                <Settings className="h-4 w-4" /> Tone Config
              </TabsTrigger>
            </TabsList>

            {/* Previews content tab */}
            <TabsContent value="previews" className="space-y-4 pt-2">
              <Tabs value={activePreviewTab} onValueChange={setActivePreviewTab} className="w-full">
                <TabsList className="flex gap-1.5 bg-transparent overflow-x-auto justify-start h-auto p-0 scrollbar-none">
                  {Object.entries(selectedPlatforms).filter(([_, isSel]) => isSel).map(([platform]) => {
                    const Icon = platformIcons[platform] || Globe;
                    return (
                      <TabsTrigger 
                        key={platform} 
                        value={platform} 
                        className="rounded-xl text-xs capitalize py-2 px-4 border border-border/30 data-[state=active]:bg-emerald-500/10 data-[state=active]:border-emerald-500/30 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 gap-1.5 transition-all duration-200"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {platform}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {/* Previews mockup rendering cards */}
                {Object.keys(platformData).map((platform) => {
                  const data = platformData[platform];
                  const Icon = platformIcons[platform] || Globe;
                  const displayCaption = data.caption || baseCaption || 'Draft details will display here...';
                  const colors = platformColors[platform] || { text: 'text-foreground', border: 'border-border/30', bg: 'bg-muted/10' };

                  return (
                    <TabsContent key={platform} value={platform} className="pt-3">
                      <Card className="border border-border/20 rounded-3xl bg-background overflow-hidden shadow-2xl relative">
                        {/* Mock Header */}
                        <div className="border-b border-border/10 p-4 flex items-center gap-3 bg-muted/5">
                          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center border", colors.border, colors.bg)}>
                            <Icon className={cn("h-4 w-4", colors.text)} />
                          </div>
                          <div>
                            <span className="font-bold text-xs block capitalize">{platform} Post Simulation</span>
                            <span className="text-[10px] text-muted-foreground font-medium">Draft variation</span>
                          </div>
                        </div>

                        {/* Post Mock Content */}
                        <div className="p-6 space-y-4">
                          <p className="text-xs text-foreground leading-relaxed whitespace-pre-line font-medium">
                            {displayCaption}
                          </p>

                          {mediaUrls.length > 0 ? (
                            <div className="aspect-video rounded-2xl border border-border/30 bg-muted/40 overflow-hidden relative group">
                              <img 
                                src={mediaUrls[0]} 
                                alt="Post media preview" 
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-[9px] px-2 py-0.5 rounded-full text-white font-bold">
                                1 of {mediaUrls.length} Media Attached
                              </div>
                            </div>
                          ) : (
                            <div className="aspect-video rounded-2xl border border-dashed border-border/30 bg-muted/10 flex flex-col items-center justify-center text-muted-foreground p-6">
                              <ImageIcon className="h-8 w-8 opacity-40 mb-2" />
                              <span className="text-[10px] font-semibold">No media attached</span>
                            </div>
                          )}
                        </div>
                      </Card>
                    </TabsContent>
                  );
                })}
              </Tabs>
            </TabsContent>

            {/* Voice Settings tab content */}
            <TabsContent value="voice-settings" className="pt-2">
              <BrandVoiceSettings />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageContainerFluid>
  );
}
