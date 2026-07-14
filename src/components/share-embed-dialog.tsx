'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check, ExternalLink, Code, Link, Terminal, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTenant } from '@/context/TenantContext';
import type { FormFieldDef } from '@/components/page-builder/embeds/FormView';
import { cn } from '@/lib/utils';

interface ShareEmbedDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  resourceName: string;
  publicUrl: string;
  embedUrl: string;
  defaultHeight?: number;
  fields?: FormFieldDef[];
  formId?: string;
  workspaceId?: string;
  organizationId?: string;
}

type EmbedStyle = 'inline-widget' | 'popup-modal' | 'slide-drawer' | 'raw-html';

export default function ShareEmbedDialog({
  isOpen,
  onOpenChange,
  title,
  resourceName,
  publicUrl,
  embedUrl,
  defaultHeight = 600,
  fields,
  formId,
  workspaceId,
  organizationId,
}: ShareEmbedDialogProps) {
  const { toast } = useToast();
  const { activeOrganization } = useTenant();

  const [copiedLink, setCopiedLink] = React.useState(false);
  const [copiedEmbed, setCopiedEmbed] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState(false);

  // Embed Customizer States
  const [embedStyle, setEmbedStyle] = React.useState<EmbedStyle>('inline-widget');
  const [buttonText, setButtonText] = React.useState(`Open ${resourceName}`);
  const [accentColor, setAccentColor] = React.useState(activeOrganization?.brandPrimaryColor || '#3B5FFF');

  // Generate unique ID to scope css / js selectors securely
  const uniqueId = React.useMemo(() => {
    return `src_${Math.random().toString(36).substring(2, 8)}`;
  }, []);

  // Sync brand color picker if tenant loads after initial render
  React.useEffect(() => {
    if (activeOrganization?.brandPrimaryColor) {
      setAccentColor(activeOrganization.brandPrimaryColor);
    }
  }, [activeOrganization?.brandPrimaryColor]);

  const embedCode = `<iframe src="${embedUrl}" width="100%" height="${defaultHeight}" style="border: none; background: transparent; overflow: hidden;" allow="geolocation; microphone; camera"></iframe>`;

  // Dynamically compute the advanced copied code blocks
  const generatedCode = React.useMemo(() => {
    const safeCta = buttonText.replace(/"/g, '&quot;');
    const safeUrl = embedUrl.includes('?') ? `${embedUrl}&embed=true` : `${embedUrl}?embed=true`;

    if (embedStyle === 'inline-widget') {
      return `<div id="smartsapp-widget-${uniqueId}" class="smartsapp-embed-container" style="width: 100%; min-height: 500px; display: flex; align-items: center; justify-content: center; background: transparent; border-radius: 16px; overflow: hidden; border: 1px solid rgba(0,0,0,0.06);">
  <div class="smartsapp-spinner" style="border: 3px solid rgba(99,102,241,0.1); border-top: 3px solid ${accentColor}; border-radius: 50%; width: 36px; height: 36px; animation: smartsapp-spin 1s linear infinite;"></div>
  <style>
    @keyframes smartsapp-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
  <noscript>
    <iframe src="${safeUrl}" style="width: 100%; height: 500px; border: none; background: transparent;"></iframe>
  </noscript>
</div>
<script>
  (function(w, d, id, url) {
    var c = d.getElementById(id);
    var f = d.createElement('iframe');
    f.src = url;
    f.style.width = '100%';
    f.style.height = '100%';
    f.style.minHeight = '500px';
    f.style.border = 'none';
    f.style.background = 'transparent';
    f.style.overflow = 'hidden';
    f.setAttribute('allow', 'geolocation; microphone; camera');
    
    w.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'resize' && e.data.embedId === id) {
        f.style.height = e.data.height + 'px';
        f.style.minHeight = e.data.height + 'px';
      }
    });

    f.onload = function() {
      var s = c.querySelector('.smartsapp-spinner');
      if (s) s.remove();
      var style = c.querySelector('style');
      if (style) style.remove();
    };
    c.appendChild(f);
  })(window, document, 'smartsapp-widget-${uniqueId}', '${safeUrl}');
</script>`;
    }

    if (embedStyle === 'popup-modal') {
      return `<button onclick="openSmartSappModal_${uniqueId}()" style="background: ${accentColor}; color: #ffffff; border: none; padding: 12px 24px; border-radius: 9999px; font-size: 14px; font-weight: 600; cursor: pointer; transition: transform 0.2s, opacity 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.08);" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'" onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform='scale(1)'">${safeCta}</button>

<div id="smartsapp-modal-${uniqueId}" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); align-items: center; justify-content: center; z-index: 999999; padding: 16px; opacity: 0; transition: opacity 0.3s ease;">
  <div style="position: relative; width: 100%; max-width: 600px; height: 80%; max-height: 700px; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); transform: scale(0.95); transition: transform 0.3s ease; display: flex; flex-direction: column;">
    <button onclick="closeSmartSappModal_${uniqueId}()" style="position: absolute; top: 16px; right: 16px; width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.08); background: #ffffff; color: #64748b; font-size: 20px; font-weight: 300; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.04); z-index: 10;" aria-label="Close">&times;</button>
    <iframe src="${safeUrl}" style="width: 100%; flex: 1; border: none; background: transparent;"></iframe>
  </div>
</div>

<script>
  function openSmartSappModal_${uniqueId}() {
    var m = document.getElementById('smartsapp-modal-${uniqueId}');
    m.style.display = 'flex';
    setTimeout(function() {
      m.style.opacity = '1';
      m.firstElementChild.style.transform = 'scale(1)';
    }, 50);
  }
  function closeSmartSappModal_${uniqueId}() {
    var m = document.getElementById('smartsapp-modal-${uniqueId}');
    m.style.opacity = '0';
    m.firstElementChild.style.transform = 'scale(0.95)';
    setTimeout(function() { m.style.display = 'none'; }, 300);
  }
</script>`;
    }

    if (embedStyle === 'slide-drawer') {
      return `<button onclick="openSmartSappDrawer_${uniqueId}()" style="background: ${accentColor}; color: #ffffff; border: none; padding: 12px 24px; border-radius: 9999px; font-size: 14px; font-weight: 600; cursor: pointer; transition: transform 0.2s, opacity 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.08);" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'" onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform='scale(1)'">${safeCta}</button>

<div id="smartsapp-drawer-overlay-${uniqueId}" onclick="closeSmartSappDrawer_${uniqueId}()" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.4); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 999998; opacity: 0; transition: opacity 0.3s ease;"></div>

<div id="smartsapp-drawer-${uniqueId}" style="position: fixed; top: 0; right: -500px; width: 500px; max-width: 100%; height: 100%; background: #ffffff; z-index: 999999; transition: right 0.35s cubic-bezier(0.32, 0.72, 0, 1); box-shadow: -10px 0 30px rgba(0,0,0,0.1); display: flex; flex-direction: column;">
  <div style="padding: 16px; display: flex; justify-content: flex-start; background: #ffffff; position: absolute; top: 0; left: 0; right: 0; height: 60px; z-index: 10;">
    <button onclick="closeSmartSappDrawer_${uniqueId}()" style="width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.08); background: #ffffff; color: #64748b; font-size: 20px; font-weight: 300; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.04);" aria-label="Close">&times;</button>
  </div>
  <iframe src="${safeUrl}" style="width: 100%; flex: 1; border: none; background: transparent; padding-top: 60px;"></iframe>
</div>

<script>
  function openSmartSappDrawer_${uniqueId}() {
    var o = document.getElementById('smartsapp-drawer-overlay-${uniqueId}');
    var d = document.getElementById('smartsapp-drawer-${uniqueId}');
    o.style.display = 'block';
    d.style.display = 'block';
    setTimeout(function() {
      o.style.opacity = '1';
      d.style.right = '0';
    }, 50);
  }
  function closeSmartSappDrawer_${uniqueId}() {
    var o = document.getElementById('smartsapp-drawer-overlay-${uniqueId}');
    var d = document.getElementById('smartsapp-drawer-${uniqueId}');
    o.style.opacity = '0';
    d.style.right = '-500px';
    setTimeout(function() {
      o.style.display = 'none';
      d.style.display = 'none';
    }, 350);
  }
</script>`;
    }

    if (embedStyle === 'raw-html' && fields && formId && workspaceId && organizationId) {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://go.smartsapp.com';
      const fieldsHtml = fields.map((field) => {
        let inputHtml = '';
        if (field.type === 'textarea') {
          inputHtml = `<textarea name="${field.id}" id="${field.id}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''} style="width: 100%; padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.2s; box-sizing: border-box; resize: vertical; min-height: 100px;" onfocus="this.style.borderColor='${accentColor}'" onblur="this.style.borderColor='#cbd5e1'"></textarea>`;
        } else if (field.type === 'select') {
          inputHtml = `<select name="${field.id}" id="${field.id}" ${field.required ? 'required' : ''} style="width: 100%; padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 14px; font-family: inherit; outline: none; background: #ffffff; box-sizing: border-box;" onfocus="this.style.borderColor='${accentColor}'" onblur="this.style.borderColor='#cbd5e1'"><option value="">Select option...</option></select>`;
        } else {
          inputHtml = `<input type="${field.type || 'text'}" name="${field.id}" id="${field.id}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''} style="width: 100%; padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.2s; box-sizing: border-box;" onfocus="this.style.borderColor='${accentColor}'" onblur="this.style.borderColor='#cbd5e1'" />`;
        }

        return `  <div style="margin-bottom: 20px;">
    <label for="${field.id}" style="display: block; margin-bottom: 8px; font-size: 13px; font-weight: 600; color: #334155;">${field.label}${field.required ? ' <span style="color: #ef4444;">*</span>' : ''}</label>
    ${inputHtml}
  </div>`;
      }).join('\n');

      return `<form action="${origin}/api/external/forms/submit" method="POST" style="width: 100%; max-width: 500px; margin: 0 auto; padding: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -4px rgba(0,0,0,0.05); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-sizing: border-box;">
  <input type="hidden" name="formId" value="${formId}" />
  <input type="hidden" name="workspaceId" value="${workspaceId}" />
  <input type="hidden" name="organizationId" value="${organizationId}" />
  <!-- Optional: Redirect URL after submission -->
  <!-- <input type="hidden" name="redirectUrl" value="https://yourwebsite.com/thank-you" /> -->

  <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 20px; font-weight: 700; color: #0f172a;">${title}</h3>
  <p style="margin-top: 0; margin-bottom: 24px; font-size: 14px; color: #64748b; line-height: 1.5;">Please fill out the form below.</p>

${fieldsHtml}

  <button type="submit" style="width: 100%; background: ${accentColor}; color: #ffffff; border: none; padding: 14px 20px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Submit</button>
</form>`;
    }

    return '';
  }, [embedStyle, buttonText, accentColor, embedUrl, uniqueId, fields, formId, workspaceId, organizationId, title]);

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

  const handleCopyCustomCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopiedCode(true);
      toast({
        title: 'Code Copied!',
        description: 'Custom widget embed code copied to clipboard.',
      });
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Failed to copy custom code:', err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-6 gap-6 rounded-[2rem] border border-border/40 bg-background/80 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-bold tracking-tight">{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Share this {resourceName.toLowerCase()} directly or embed it inside your own web page or host platform.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="link" className="w-full">
          <TabsList className="grid grid-cols-3 w-full p-1 bg-muted/60 dark:bg-zinc-800/50 rounded-xl mb-4">
            <TabsTrigger value="link" className="rounded-lg font-semibold gap-1.5 py-2">
              <Link className="h-4 w-4" />
              Direct Link
            </TabsTrigger>
            <TabsTrigger value="embed" className="rounded-lg font-semibold gap-1.5 py-2">
              <Code className="h-4 w-4" />
              Iframe
            </TabsTrigger>
            <TabsTrigger value="code" className="rounded-lg font-semibold gap-1.5 py-2">
              <Terminal className="h-4 w-4" />
              Code Embed
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
                  className="rounded-xl px-4 py-5 font-semibold gap-2 active:scale-[0.97] transition-all duration-200"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {copiedLink ? (
                      <motion.span
                        key="check"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="flex items-center gap-1.5"
                      >
                        <Check className="h-4 w-4 stroke-[2.5px]" />
                        Copied
                      </motion.span>
                    ) : (
                      <motion.span
                        key="copy"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
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
              <div className="space-y-0.5 pr-2">
                <h4 className="text-sm font-semibold">Open Public Page</h4>
                <p className="text-xs text-muted-foreground">Test the live landing page link in a new browser tab.</p>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl font-semibold gap-1.5 shrink-0" asChild>
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
                className="rounded-xl font-semibold gap-2 active:scale-[0.97] transition-all duration-200 w-full py-5"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {copiedEmbed ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="flex items-center gap-1.5"
                    >
                      <Check className="h-4 w-4 stroke-[2.5px]" />
                      Copied Iframe snippet
                    </motion.span>
                  ) : (
                    <motion.span
                      key="copy"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
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

          <TabsContent value="code" className="space-y-4 outline-none">
            {/* Embed Style Select Buttons */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Select Embed Style
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setEmbedStyle('inline-widget')}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200 cursor-pointer",
                    embedStyle === 'inline-widget'
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border/40 hover:bg-muted/30"
                  )}
                >
                  <span className="text-xs font-semibold">Inline Widget</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEmbedStyle('popup-modal')}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200 cursor-pointer",
                    embedStyle === 'popup-modal'
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border/40 hover:bg-muted/30"
                  )}
                >
                  <span className="text-xs font-semibold">Popup Modal</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEmbedStyle('slide-drawer')}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200 cursor-pointer",
                    embedStyle === 'slide-drawer'
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border/40 hover:bg-muted/30"
                  )}
                >
                  <span className="text-xs font-semibold">Slide Panel</span>
                </button>
                <button
                  type="button"
                  disabled={resourceName !== 'Form' || !fields}
                  onClick={() => setEmbedStyle('raw-html')}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                    embedStyle === 'raw-html'
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border/40 hover:bg-muted/30"
                  )}
                >
                  <span className="text-xs font-semibold">Raw HTML Form</span>
                </button>
              </div>
            </div>

            {/* Advanced Configuration Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-border/40 p-4 rounded-2xl bg-zinc-500/5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CTA Button Label</span>
                </div>
                <Input
                  disabled={embedStyle === 'inline-widget' || embedStyle === 'raw-html'}
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  className="h-9 rounded-lg border-border/40 text-xs"
                  placeholder="e.g. Open Form"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full border border-border/40" style={{ backgroundColor: accentColor }} />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-semibold">Accent Theme Color</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-9 w-12 p-0.5 rounded-lg border-border/40 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-9 flex-1 rounded-lg border-border/40 text-xs font-mono"
                    placeholder="#3B5FFF"
                  />
                </div>
              </div>
            </div>

            {/* Generated Code Display Block */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Copy Code Snippet
              </label>
              <div className="relative">
                <pre className="p-4 rounded-2xl bg-zinc-950 text-zinc-100 overflow-x-auto text-[11px] font-mono leading-relaxed border border-zinc-800 max-h-[140px] text-wrap select-all">
                  {generatedCode}
                </pre>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleCopyCustomCode}
                className="rounded-xl font-semibold gap-2 active:scale-[0.97] transition-all duration-200 w-full py-5"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {copiedCode ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="flex items-center gap-1.5"
                    >
                      <Check className="h-4 w-4 stroke-[2.5px]" />
                      Copied Custom Code
                    </motion.span>
                  ) : (
                    <motion.span
                      key="copy"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="flex items-center gap-1.5"
                    >
                      <Copy className="h-4 w-4" />
                      Copy Embed Code
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
