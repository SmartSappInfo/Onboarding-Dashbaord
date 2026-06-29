'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check, ExternalLink, Code, Link } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ShareEmbedDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  resourceName: string;
  publicUrl: string;
  embedUrl: string;
  defaultHeight?: number;
}

export default function ShareEmbedDialog({
  isOpen,
  onOpenChange,
  title,
  resourceName,
  publicUrl,
  embedUrl,
  defaultHeight = 600,
}: ShareEmbedDialogProps) {
  const { toast } = useToast();
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [copiedEmbed, setCopiedEmbed] = React.useState(false);

  const embedCode = `<iframe src="${embedUrl}" width="100%" height="${defaultHeight}" style="border: none; background: transparent; overflow: hidden;" allow="geolocation; microphone; camera"></iframe>`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedLink(true);
      toast({
        title: 'Link Copied!',
        description: `${resourceName} link copied to your clipboard.`,
      });
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleCopyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopiedEmbed(true);
      toast({
        title: 'Embed Code Copied!',
        description: 'Iframe code snippet copied to your clipboard.',
      });
      setTimeout(() => setCopiedEmbed(false), 2000);
    } catch (err) {
      console.error('Failed to copy embed code:', err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-6 gap-6 rounded-[2rem] border border-border/40 bg-background/80 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-bold tracking-tight">{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Share this {resourceName.toLowerCase()} directly or embed it inside your own web page or host platform.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="link" className="w-full">
          <TabsList className="grid grid-cols-2 w-full p-1 bg-muted/60 dark:bg-zinc-800/50 rounded-xl mb-4">
            <TabsTrigger value="link" className="rounded-lg font-semibold gap-1.5 py-2">
              <Link className="h-4 w-4" />
              Direct Link
            </TabsTrigger>
            <TabsTrigger value="embed" className="rounded-lg font-semibold gap-1.5 py-2">
              <Code className="h-4 w-4" />
              Iframe Embed
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4 outline-none">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Public Page URL
              </label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={publicUrl}
                  className="rounded-xl border-border/40 bg-zinc-500/5 focus-visible:ring-primary font-mono text-xs py-5"
                />
                <Button
                  onClick={handleCopyLink}
                  className="rounded-xl px-4 py-5 font-semibold gap-2 active:scale-95 transition-all duration-300"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {copiedLink ? (
                      <motion.span
                        key="check"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        className="flex items-center gap-1.5"
                      >
                        <Check className="h-4 w-4 stroke-[2.5px]" />
                        Copied
                      </motion.span>
                    ) : (
                      <motion.span
                        key="copy"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        className="flex items-center gap-1.5"
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </div>
            </div>

            <div className="flex justify-between items-center bg-zinc-500/5 dark:bg-white/5 border border-border/40 p-4 rounded-2xl">
              <div className="space-y-0.5">
                <h4 className="text-sm font-semibold">Open Public Page</h4>
                <p className="text-xs text-muted-foreground">Test the live landing page link in a new browser tab.</p>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl font-semibold gap-1.5" asChild>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  View Live
                </a>
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="embed" className="space-y-4 outline-none">
            <div className="space-y-2">
              <div className="flex justify-between items-end ml-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Iframe HTML Snippet
                </label>
                <span className="text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  embed=true enabled
                </span>
              </div>
              
              <div className="relative">
                <pre className="p-4 rounded-2xl bg-zinc-950 text-zinc-100 overflow-x-auto text-[11px] font-mono leading-relaxed border border-zinc-800 max-h-[140px] text-wrap select-all">
                  {embedCode}
                </pre>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleCopyEmbed}
                className="rounded-xl font-semibold gap-2 active:scale-95 transition-all duration-300 w-full py-5"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {copiedEmbed ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      className="flex items-center gap-1.5"
                    >
                      <Check className="h-4 w-4 stroke-[2.5px]" />
                      Copied Iframe snippet
                    </motion.span>
                  ) : (
                    <motion.span
                      key="copy"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      className="flex items-center gap-1.5"
                    >
                      <Copy className="h-4 w-4" />
                      Copy Iframe Embed Code
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground text-center leading-normal px-2">
              Paste this HTML snippet on platforms like WordPress (Custom HTML block), Webflow (Embed block), or Shopify page editors to display the component seamlessly.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
