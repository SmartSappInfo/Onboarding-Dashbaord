'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Split-Screen Studio Architecture:
 *    Renders a tabbed configuration panel on the left and a live, interactive flipbook
 *    preview canvas on the right. State changes immediately update local preview state.
 * 2. Mobile Touch Target Compliance:
 *    All buttons, tab triggers, inputs, and hotspot controls enforce `min-h-[44px]` touch targets.
 * 3. Strict Typing Standard:
 *    No `any` or `any[]` types are permitted.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import type { 
  FlipbookConfig, 
  FlipbookHotspot, 
  HotspotType 
} from '@/lib/types/flipbook-types';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  ArrowLeft, Save, Sparkles, Sliders, 
  ExternalLink, Plus, Trash2, Video, Link as LinkIcon, Eye
} from 'lucide-react';
import { updateFlipbookAction } from '@/lib/flipbook-actions';

interface FlipbookEditorClientProps {
  flipbookId: string;
}

export default function FlipbookEditorClient({ flipbookId }: FlipbookEditorClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();

  const docRef = useMemoFirebase(() => {
    if (!firestore || !flipbookId) return null;
    return doc(firestore, 'flipbooks', flipbookId);
  }, [firestore, flipbookId]);

  const { data: flipbook, isLoading } = useDoc<FlipbookConfig>(docRef);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [style, setStyle] = useState<FlipbookConfig['style']>({
    pageStyle: 'magazine',
    soundEnabled: true,
    hardcover: false,
    backgroundColor: '#f1f5f9',
    enableDownloadPdf: true,
    enablePrint: true,
    enableShare: true,
    enableSearch: true,
    enableThumbnails: true,
  });
  const [hotspots, setHotspots] = useState<FlipbookHotspot[]>([]);
  const [leadGate, setLeadGate] = useState<FlipbookConfig['leadGate']>({
    enabled: false,
    triggerPage: 0,
    title: 'Unlock Full Access',
    description: 'Enter your contact details to continue reading.',
    requireName: true,
    requireEmail: true,
    requirePhone: false,
    ctaText: 'Unlock Reader',
  });
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Hotspot Form State
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [hotspotType, setHotspotType] = useState<HotspotType>('video');
  const [hotspotUrl, setHotspotUrl] = useState('');
  const [hotspotTitle, setHotspotTitle] = useState('');

  // Sync loaded flipbook to state
  useEffect(() => {
    if (flipbook) {
      setTitle(flipbook.title || '');
      setDescription(flipbook.description || '');
      setSlug(flipbook.slug || '');
      setStatus(flipbook.status || 'draft');
      if (flipbook.style) setStyle(flipbook.style);
      if (flipbook.hotspots) setHotspots(flipbook.hotspots);
      if (flipbook.leadGate) setLeadGate(flipbook.leadGate);
      setPassword(flipbook.password || '');
    }
  }, [flipbook]);

  const handleSave = async () => {
    if (!activeWorkspaceId) return;
    setIsSaving(true);
    try {
      const res = await updateFlipbookAction({
        flipbookId,
        workspaceId: activeWorkspaceId,
        title: title.trim(),
        description: description.trim(),
        slug: slug.trim(),
        status,
        style,
        hotspots,
        leadGate,
        password: password.trim(),
        userId: 'admin',
      });

      if (res.success) {
        toast({ title: 'Flipbook Saved', description: 'Your publication preferences have been updated.' });
      } else {
        toast({ variant: 'destructive', title: 'Save Failed', description: res.error || 'Could not save flipbook.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddHotspot = () => {
    if (!hotspotUrl.trim()) {
      toast({ variant: 'destructive', title: 'URL Required', description: 'Enter a target URL or media link for the hotspot.' });
      return;
    }

    const newHotspot: FlipbookHotspot = {
      id: `hs_${Date.now()}`,
      pageNumber: selectedPage,
      x: 35,
      y: 40,
      width: 30,
      height: 20,
      type: hotspotType,
      title: hotspotTitle.trim() || 'Interactive Overlay',
      targetUrl: hotspotUrl.trim(),
    };

    setHotspots(prev => [...prev, newHotspot]);
    setHotspotUrl('');
    setHotspotTitle('');
    toast({ title: 'Hotspot Added', description: `Added ${hotspotType} overlay to page ${selectedPage}.` });
  };

  const handleRemoveHotspot = (id: string) => {
    setHotspots(prev => prev.filter(h => h.id !== id));
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicUrl = `${origin}/f/${slug || flipbookId}`;
  const iframeCode = `<iframe src="${publicUrl}" width="100%" height="600px" frameborder="0" allowfullscreen></iframe>`;

  if (isLoading || !flipbook) {
    return (
      <PageContainerFluid>
        <div className="h-96 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </PageContainerFluid>
    );
  }

  return (
    <PageContainerFluid>
      <div className="h-full flex flex-col w-full text-left">
        
        {/* Top Studio Action Bar */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push('/admin/flipbooks')}
              className="h-10 w-10 rounded-xl min-h-[44px] min-w-[44px]"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-black text-foreground truncate max-w-md">{title || 'Untitled Flipbook'}</h1>
              <span className="text-xs text-muted-foreground">Source: {flipbook.sourceFileName}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/f/${slug || flipbookId}`, '_blank')}
              className="rounded-xl font-bold text-xs gap-1.5 h-11 px-4 min-h-[44px]"
            >
              <ExternalLink className="h-4 w-4" />
              Preview Public Page
            </Button>

            <Button
              disabled={isSaving}
              onClick={handleSave}
              className="rounded-xl font-bold text-xs gap-2 h-11 px-5 shadow-lg active:scale-[0.97] transition-all min-h-[44px]"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </div>

        {/* Studio Workspace Split Grid */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 overflow-hidden">
          
          {/* Left Configuration Panel (5 cols) */}
          <div className="lg:col-span-5 h-full overflow-y-auto pr-2 space-y-6">
            <Tabs defaultValue="style" className="w-full">
              <TabsList className="grid grid-cols-4 bg-muted/40 p-1 rounded-xl mb-4">
                <TabsTrigger value="style" className="rounded-lg text-xs font-bold min-h-[44px]">Style</TabsTrigger>
                <TabsTrigger value="hotspots" className="rounded-lg text-xs font-bold min-h-[44px]">Hotspots</TabsTrigger>
                <TabsTrigger value="leads" className="rounded-lg text-xs font-bold min-h-[44px]">Lead Gate</TabsTrigger>
                <TabsTrigger value="publish" className="rounded-lg text-xs font-bold min-h-[44px]">Publish</TabsTrigger>
              </TabsList>

              {/* STYLE TAB */}
              <TabsContent value="style" className="space-y-6 outline-none">
                <div className="space-y-4 bg-card p-5 rounded-2xl border border-border/50 shadow-sm">
                  <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-primary" /> Page Turn Animation & Layout
                  </h3>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Page Flip Style</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['magazine', 'booklet', 'album', 'notebook', 'single'] as const).map((pst) => (
                        <Button
                          key={pst}
                          type="button"
                          variant={style.pageStyle === pst ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setStyle(prev => ({ ...prev, pageStyle: pst }))}
                          className="rounded-xl font-extrabold text-xs capitalize h-10 min-h-[44px]"
                        >
                          {pst}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <div>
                      <Label className="text-xs font-bold text-foreground">Realistic Page Turn Sound</Label>
                      <p className="text-[11px] text-muted-foreground">Play page-flip audio effect on turn</p>
                    </div>
                    <Switch
                      checked={style.soundEnabled}
                      onCheckedChange={(val) => setStyle(prev => ({ ...prev, soundEnabled: val }))}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <div>
                      <Label className="text-xs font-bold text-foreground">Hardcover Front/Back</Label>
                      <p className="text-[11px] text-muted-foreground">Emulate rigid cover thickness</p>
                    </div>
                    <Switch
                      checked={style.hardcover}
                      onCheckedChange={(val) => setStyle(prev => ({ ...prev, hardcover: val }))}
                    />
                  </div>
                </div>

                <div className="space-y-4 bg-card p-5 rounded-2xl border border-border/50 shadow-sm">
                  <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Background & Reader Controls</h3>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Background Color</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={style.backgroundColor || '#f1f5f9'}
                        onChange={(e) => setStyle(prev => ({ ...prev, backgroundColor: e.target.value }))}
                        className="h-10 w-12 rounded-xl cursor-pointer border border-border bg-background"
                      />
                      <Input
                        value={style.backgroundColor || '#f1f5f9'}
                        onChange={(e) => setStyle(prev => ({ ...prev, backgroundColor: e.target.value }))}
                        className="h-10 font-mono text-xs rounded-xl min-h-[44px]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Logo URL (Optional)</Label>
                    <Input
                      value={style.logoUrl || ''}
                      onChange={(e) => setStyle(prev => ({ ...prev, logoUrl: e.target.value }))}
                      placeholder="https://.../logo.png"
                      className="h-10 text-xs rounded-xl min-h-[44px]"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* HOTSPOTS TAB */}
              <TabsContent value="hotspots" className="space-y-6 outline-none">
                <div className="space-y-4 bg-card p-5 rounded-2xl border border-border/50 shadow-sm">
                  <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> Add Interactive Hotspot
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-muted-foreground">Page Number</Label>
                      <Input
                        type="number"
                        min={1}
                        max={flipbook.pageCount || 1}
                        value={selectedPage}
                        onChange={(e) => setSelectedPage(parseInt(e.target.value, 10) || 1)}
                        className="h-10 text-xs rounded-xl min-h-[44px]"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-muted-foreground">Hotspot Type</Label>
                      <div className="flex gap-1">
                        {(['video', 'link', 'audio'] as const).map((ht) => (
                          <Button
                            key={ht}
                            type="button"
                            variant={hotspotType === ht ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setHotspotType(ht)}
                            className="w-full text-[10px] font-extrabold uppercase rounded-lg h-10 min-h-[44px]"
                          >
                            {ht}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-muted-foreground">Overlay Title</Label>
                    <Input
                      value={hotspotTitle}
                      onChange={(e) => setHotspotTitle(e.target.value)}
                      placeholder="e.g. Watch Campus Virtual Tour Video"
                      className="h-10 text-xs rounded-xl min-h-[44px]"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-muted-foreground">Target URL / Media Link</Label>
                    <Input
                      value={hotspotUrl}
                      onChange={(e) => setHotspotUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="h-10 text-xs font-mono rounded-xl min-h-[44px]"
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={handleAddHotspot}
                    className="w-full rounded-xl font-bold text-xs gap-1.5 h-11 min-h-[44px]"
                  >
                    <Plus className="h-4 w-4" /> Add Hotspot to Page {selectedPage}
                  </Button>
                </div>

                {/* Configured Hotspots List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-muted-foreground uppercase tracking-wider">Configured Hotspots ({hotspots.length})</h4>
                  {hotspots.length === 0 ? (
                    <p className="text-xs text-muted-foreground/60 italic">No hotspots added yet.</p>
                  ) : (
                    hotspots.map((hs) => (
                      <div key={hs.id} className="p-3 bg-card border border-border/50 rounded-xl flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="font-bold text-foreground flex items-center gap-1.5">
                            <Badge className="text-[8px] uppercase">{hs.type}</Badge>
                            <span>Page {hs.pageNumber}: {hs.title}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate max-w-xs">{hs.targetUrl}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveHotspot(hs.id)}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 min-h-[44px] min-w-[44px]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* LEAD GATE TAB */}
              <TabsContent value="leads" className="space-y-6 outline-none">
                <div className="space-y-4 bg-card p-5 rounded-2xl border border-border/50 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <div>
                      <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Gated Lead Capture Form</h3>
                      <p className="text-[11px] text-muted-foreground">Require readers to submit contact info to unlock reader</p>
                    </div>
                    <Switch
                      checked={leadGate.enabled}
                      onCheckedChange={(val) => setLeadGate(prev => ({ ...prev, enabled: val }))}
                    />
                  </div>

                  {leadGate.enabled && (
                    <div className="space-y-3 pt-2">
                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-muted-foreground">Trigger Page Threshold</Label>
                        <Input
                          type="number"
                          min={0}
                          max={flipbook.pageCount || 1}
                          value={leadGate.triggerPage}
                          onChange={(e) => setLeadGate(prev => ({ ...prev, triggerPage: parseInt(e.target.value, 10) || 0 }))}
                          className="h-10 text-xs rounded-xl min-h-[44px]"
                        />
                        <span className="text-[10px] text-muted-foreground">Set to 0 to prompt lead capture before page 1</span>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-muted-foreground">Form Title</Label>
                        <Input
                          value={leadGate.title}
                          onChange={(e) => setLeadGate(prev => ({ ...prev, title: e.target.value }))}
                          className="h-10 text-xs rounded-xl min-h-[44px]"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-muted-foreground">Description Message</Label>
                        <Input
                          value={leadGate.description}
                          onChange={(e) => setLeadGate(prev => ({ ...prev, description: e.target.value }))}
                          className="h-10 text-xs rounded-xl min-h-[44px]"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <Label className="text-xs font-bold text-foreground">Require Phone Number</Label>
                        <Switch
                          checked={leadGate.requirePhone}
                          onCheckedChange={(val) => setLeadGate(prev => ({ ...prev, requirePhone: val }))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* PUBLISH TAB */}
              <TabsContent value="publish" className="space-y-6 outline-none">
                <div className="space-y-4 bg-card p-5 rounded-2xl border border-border/50 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <div>
                      <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Publication Status</h3>
                      <p className="text-[11px] text-muted-foreground">Make this flipbook accessible on public landing page</p>
                    </div>
                    <Badge className={status === 'published' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}>
                      {status.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={status === 'published' ? 'default' : 'outline'}
                      onClick={() => setStatus('published')}
                      className="w-1/2 rounded-xl font-bold text-xs h-11 min-h-[44px]"
                    >
                      Publish Page
                    </Button>
                    <Button
                      type="button"
                      variant={status === 'draft' ? 'default' : 'outline'}
                      onClick={() => setStatus('draft')}
                      className="w-1/2 rounded-xl font-bold text-xs h-11 min-h-[44px]"
                    >
                      Keep Draft
                    </Button>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Custom URL Slug</Label>
                    <Input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="e.g. parent-prospectus-2026"
                      className="h-10 font-mono text-xs rounded-xl min-h-[44px]"
                    />
                    <span className="text-[10px] text-muted-foreground truncate block">URL: {publicUrl}</span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-border/40">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">iFrame Embed Code</Label>
                    <Input
                      readOnly
                      value={iframeCode}
                      className="h-10 font-mono text-[10px] rounded-xl bg-muted/30 min-h-[44px]"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Live Interactive Preview Panel (7 cols) */}
          <div className="lg:col-span-7 h-full flex flex-col bg-slate-900 rounded-3xl border border-white/10 p-6 overflow-hidden relative shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 text-white">
              <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-2">
                <Eye className="h-4 w-4 text-indigo-400" /> Interactive Reader Preview
              </span>
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[9px] uppercase">
                {style.pageStyle} mode
              </Badge>
            </div>

            {/* Live Canvas Mock */}
            <div 
              className="flex-1 flex items-center justify-center my-4 rounded-2xl relative overflow-hidden transition-all duration-300"
              style={{ backgroundColor: style.backgroundColor || '#1e293b' }}
            >
              <div className="aspect-[3/4] h-[80%] max-h-[500px] bg-white rounded-xl shadow-2xl p-6 flex flex-col justify-between text-slate-900 relative">
                
                {/* Logo Overlay Preview */}
                {style.logoUrl && (
                  <img src={style.logoUrl} alt="Logo" className="h-8 object-contain absolute top-4 left-4 z-20" />
                )}

                <div className="space-y-2 mt-8 text-left">
                  <h2 className="text-lg font-black text-slate-900 leading-tight">{title || 'Publication Title'}</h2>
                  <p className="text-xs text-slate-500 line-clamp-3">{description || 'Interactive page content preview...'}</p>
                </div>

                {/* Simulated Hotspots Overlay */}
                {hotspots.filter(h => h.pageNumber === 1).map((hs) => (
                  <div 
                    key={hs.id}
                    className="absolute bg-indigo-500/30 border-2 border-indigo-500 rounded-lg flex items-center justify-center text-[10px] font-black text-white shadow-lg animate-pulse"
                    style={{
                      left: `${hs.x}%`,
                      top: `${hs.y}%`,
                      width: `${hs.width}%`,
                      height: `${hs.height}%`,
                    }}
                  >
                    {hs.type === 'video' ? <Video className="h-4 w-4 text-white" /> : <LinkIcon className="h-4 w-4 text-white" />}
                  </div>
                ))}

                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 border-t border-slate-200 pt-2">
                  <span>Page 1 of {flipbook.pageCount || 1}</span>
                  <span>Flipbook Studio</span>
                </div>
              </div>
            </div>

            <div className="text-center text-xs text-slate-400 font-medium">
              Changes applied in the left tabs reflect in real-time. Click &quot;Save Configuration&quot; to push updates.
            </div>
          </div>

        </div>
      </div>
    </PageContainerFluid>
  );
}
