'use client';

/**
 * @fileoverview Platform-Wide Share & Embed Dialog
 *
 * ARCHITECTURAL GUIDANCE & CAUTION FOR FUTURE MAINTAINERS:
 * ────────────────────────────────────────────────────────
 * 1. Single Source of Truth for Sharing:
 *    - Serves Surveys, Forms, Meetings, Pages, and QR Studio.
 *    - Provides 5 unified distribution channels:
 *      1. Direct Link (Public long URL)
 *      2. Dynamic Shortcode (/q/[slug] with Firestore redirect and scan tracking)
 *      3. Interactive Vector QR Code (qr-code-styling preview, PNG/SVG download, studio launcher)
 *      4. Standard Iframe snippet
 *      5. Advanced Code Embed (Inline widget, Modal popup, Slide panel, Raw HTML)
 *
 * 2. Shortcode & Dynamic QR Symmetrical Foundation:
 *    - Dynamic shortcodes and dynamic QR codes share the exact same underlying Firestore
 *      document in `organizations/{orgId}/workspaces/{wsId}/qr_codes/{id}` and global `short_paths/{slug}`.
 *    - Reuses server actions `getQRCodeByUrl`, `createQRCode`, and `updateQRShortPath` from `@/lib/qr-actions`.
 *    - Avoids duplicate URL shortening or separate database schemas.
 *
 * 3. Context Autoresolution:
 *    - Callers can explicitly pass `workspaceId` and `organizationId`, or let them resolve
 *      automatically from `useTenant()`.
 *    - User identity resolves cleanly from `currentUser` prop or `useUser()`.
 *
 * 4. Strict Zero-any Invariant:
 *    - All props, callbacks, and handlers are strictly typed.
 *
 * @testability Covered by `src/components/__tests__/share-embed-dialog.test.tsx`.
 */

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { useToast } from '@/hooks/use-toast';
import {
  Copy,
  Check,
  ExternalLink,
  Code,
  Link as LinkIcon,
  Terminal,
  Settings2,
  QrCode,
  Radio,
  Download,
  Sparkles,
  Loader2,
  Edit2,
  X,
  Palette,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/firebase';
import type { FormFieldDef } from '@/components/page-builder/embeds/FormView';
import { cn } from '@/lib/utils';
import { getQRCodeByUrl, createQRCode, updateQRShortPath } from '@/lib/qr-actions';
import QRPreview, { downloadQR } from '@/app/admin/qr-studio/components/qr-preview';
import UnifiedQRSheet from '@/components/qr-studio/unified-qr-sheet';
import type { QRDotStyle } from '@/lib/types';

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
  currentUser?: { userId: string; name: string; email: string };
  initialTab?: 'link' | 'shortcode' | 'qr' | 'embed' | 'code';
}

type EmbedStyle = 'inline-widget' | 'popup-modal' | 'slide-drawer' | 'raw-html';

const QR_COLOR_PRESETS = [
  { label: 'Brand', color: '#4F46E5' },
  { label: 'Dark', color: '#0F172A' },
  { label: 'Emerald', color: '#059669' },
  { label: 'Indigo', color: '#6366F1' },
  { label: 'Amber', color: '#D97706' },
  { label: 'Rose', color: '#E11D48' },
];

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
  currentUser,
  initialTab = 'link',
}: ShareEmbedDialogProps) {
  const { toast } = useToast();
  const { activeOrganizationId, activeWorkspaceId, activeOrganization } = useTenant();
  const { user } = useUser();

  // Resolved tenant & user context
  const effectiveWorkspaceId = workspaceId || activeWorkspaceId || '';
  const effectiveOrganizationId = organizationId || activeOrganizationId || activeOrganization?.id || '';
  const effectiveUser = React.useMemo(() => {
    if (currentUser) return currentUser;
    return {
      userId: user?.uid || 'user',
      name: user?.displayName || 'User',
      email: user?.email || '',
    };
  }, [currentUser, user]);

  const [activeTab, setActiveTab] = React.useState<string>(initialTab);

  // Copy indicator states
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [copiedShortcode, setCopiedShortcode] = React.useState(false);
  const [copiedEmbed, setCopiedEmbed] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState(false);

  // Shortcode Lifecycle State
  const [shortcode, setShortcode] = React.useState<string>('');
  const [existingQrId, setExistingQrId] = React.useState<string | null>(null);
  const [totalScans, setTotalScans] = React.useState<number>(0);
  const [isLoadingShortcode, setIsLoadingShortcode] = React.useState<boolean>(false);
  const [isGeneratingShortcode, setIsGeneratingShortcode] = React.useState<boolean>(false);
  const [isEditingSlug, setIsEditingSlug] = React.useState<boolean>(false);
  const [customSlugDraft, setCustomSlugDraft] = React.useState<string>('');
  const [isSavingSlug, setIsSavingSlug] = React.useState<boolean>(false);

  // QR Code Generator States
  const [qrTarget, setQrTarget] = React.useState<'short' | 'direct'>('short');
  const [qrDotColor, setQrDotColor] = React.useState<string>(
    activeOrganization?.brandPrimaryColor || '#4F46E5'
  );
  const [qrDotType, setQrDotType] = React.useState<QRDotStyle>('rounded');
  const [qrIncludeLogo, setQrIncludeLogo] = React.useState<boolean>(true);
  const [isDownloadingQr, setIsDownloadingQr] = React.useState<boolean>(false);
  const [isQrStudioSheetOpen, setIsQrStudioSheetOpen] = React.useState<boolean>(false);

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
      setQrDotColor(activeOrganization.brandPrimaryColor);
    }
  }, [activeOrganization?.brandPrimaryColor]);

  // Synchronize initialTab when dialog opens
  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Fetch existing QR / shortcode record when dialog opens
  React.useEffect(() => {
    if (!isOpen || !publicUrl || !effectiveOrganizationId || !effectiveWorkspaceId) return;

    let isMounted = true;
    setIsLoadingShortcode(true);

    getQRCodeByUrl(effectiveOrganizationId, effectiveWorkspaceId, publicUrl)
      .then((existing) => {
        if (!isMounted) return;
        if (existing) {
          setExistingQrId(existing.id);
          const currentShortPath = existing.shortPath || '';
          setShortcode(currentShortPath);
          setCustomSlugDraft(currentShortPath);
          setTotalScans(existing.stats?.totalScans || 0);
          if (existing.design?.foregroundColor) {
            setQrDotColor(existing.design.foregroundColor);
          }
          if (existing.design?.dotStyle) {
            setQrDotType(existing.design.dotStyle as QRDotStyle);
          }
        } else {
          setExistingQrId(null);
          setShortcode('');
          setCustomSlugDraft('');
          setTotalScans(0);
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to lookup QR/shortcode record for URL:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingShortcode(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, publicUrl, effectiveOrganizationId, effectiveWorkspaceId]);

  // Resolved dynamic short URL
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://go.smartsapp.com';
  const shortUrl = shortcode ? `${origin}/q/${shortcode}` : '';

  // Resolved target URL for QR preview and download
  const resolvedQrData = React.useMemo(() => {
    if (qrTarget === 'short' && shortUrl) {
      return shortUrl;
    }
    return publicUrl;
  }, [qrTarget, shortUrl, publicUrl]);

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
    <iframe id="smartsapp-iframe-${uniqueId}" src="${safeUrl}" style="width: 100%; flex: 1; border: none; background: transparent;"></iframe>
  </div>
</div>

<script>
  function openSmartSappModal_${uniqueId}() {
    var m = document.getElementById('smartsapp-modal-${uniqueId}');
    var iframe = document.getElementById('smartsapp-iframe-${uniqueId}');
    if (iframe && window.location.search && !iframe.getAttribute('data-params-appended')) {
      var currentSrc = iframe.src;
      var joiner = currentSrc.indexOf('?') !== -1 ? '&' : '?';
      iframe.src = currentSrc + joiner + window.location.search.substring(1);
      iframe.setAttribute('data-params-appended', 'true');
    }
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
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'smartsapp:redirect') {
      closeSmartSappModal_${uniqueId}();
      if (e.data.url && e.data.presentation === 'page') {
        window.location.href = e.data.url;
      }
    }
  });
</script>`;
    }

    if (embedStyle === 'slide-drawer') {
      return `<button onclick="openSmartSappDrawer_${uniqueId}()" style="background: ${accentColor}; color: #ffffff; border: none; padding: 12px 24px; border-radius: 9999px; font-size: 14px; font-weight: 600; cursor: pointer; transition: transform 0.2s, opacity 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.08);" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'" onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform='scale(1)'">${safeCta}</button>

<div id="smartsapp-drawer-overlay-${uniqueId}" onclick="closeSmartSappDrawer_${uniqueId}()" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.4); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 999998; opacity: 0; transition: opacity 0.3s ease;"></div>

<div id="smartsapp-drawer-${uniqueId}" style="position: fixed; top: 0; right: -500px; width: 500px; max-width: 100%; height: 100%; background: #ffffff; z-index: 999999; transition: right 0.35s cubic-bezier(0.32, 0.72, 0, 1); box-shadow: -10px 0 30px rgba(0,0,0,0.1); display: flex; flex-direction: column;">
  <div style="padding: 16px; display: flex; justify-content: flex-start; background: #ffffff; position: absolute; top: 0; left: 0; right: 0; height: 60px; z-index: 10;">
    <button onclick="closeSmartSappDrawer_${uniqueId}()" style="width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.08); background: #ffffff; color: #64748b; font-size: 20px; font-weight: 300; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.04);" aria-label="Close">&times;</button>
  </div>
  <iframe id="smartsapp-drawer-iframe-${uniqueId}" src="${safeUrl}" style="width: 100%; flex: 1; border: none; background: transparent; padding-top: 60px;"></iframe>
</div>

<script>
  function openSmartSappDrawer_${uniqueId}() {
    var o = document.getElementById('smartsapp-drawer-overlay-${uniqueId}');
    var d = document.getElementById('smartsapp-drawer-${uniqueId}');
    var iframe = document.getElementById('smartsapp-drawer-iframe-${uniqueId}');
    if (iframe && window.location.search && !iframe.getAttribute('data-params-appended')) {
      var currentSrc = iframe.src;
      var joiner = currentSrc.indexOf('?') !== -1 ? '&' : '?';
      iframe.src = currentSrc + joiner + window.location.search.substring(1);
      iframe.setAttribute('data-params-appended', 'true');
    }
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
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'smartsapp:redirect') {
      closeSmartSappDrawer_${uniqueId}();
      if (e.data.url && e.data.presentation === 'page') {
        window.location.href = e.data.url;
      }
    }
  });
</script>`;
    }

    if (embedStyle === 'raw-html' && fields && formId && effectiveWorkspaceId && effectiveOrganizationId) {
      const originHost = typeof window !== 'undefined' ? window.location.origin : 'https://go.smartsapp.com';
      const fieldsHtml = fields.map((field) => {
        let inputHtml = '';
        if (field.type === 'textarea') {
          inputHtml = `<textarea name="${field.id}" id="${field.id}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''} style="width: 100%; padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.2s; box-sizing: border-box; resize: vertical; min-height: 100px;" onfocus="this.style.borderColor='${accentColor}'" onblur="this.style.borderColor='#cbd5e1'"></textarea>`;
        } else if (field.type === 'select') {
          inputHtml = `<select name="${field.id}" id="${field.id}" ${field.required ? 'required' : ''} style="width: 100%; padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 14px; font-family: inherit; outline: none; background: #ffffff; box-sizing: border-box;" onfocus="this.style.borderColor='${accentColor}'" onblur="this.style.borderColor='#cbd5e1'"><option value="">Select option…</option></select>`;
        } else {
          inputHtml = `<input type="${field.type || 'text'}" name="${field.id}" id="${field.id}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''} style="width: 100%; padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.2s; box-sizing: border-box;" onfocus="this.style.borderColor='${accentColor}'" onblur="this.style.borderColor='#cbd5e1'" />`;
        }

        return `  <div style="margin-bottom: 20px;">
    <label for="${field.id}" style="display: block; margin-bottom: 8px; font-size: 13px; font-weight: 600; color: #334155;">${field.label}${field.required ? ' <span style="color: #ef4444;">*</span>' : ''}</label>
    ${inputHtml}
  </div>`;
      }).join('\n');

      return `<form action="${originHost}/api/external/forms/submit" method="POST" style="width: 100%; max-width: 500px; margin: 0 auto; padding: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -4px rgba(0,0,0,0.05); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-sizing: border-box;">
  <input type="hidden" name="formId" value="${formId}" />
  <input type="hidden" name="workspaceId" value="${effectiveWorkspaceId}" />
  <input type="hidden" name="organizationId" value="${effectiveOrganizationId}" />
  <!-- Optional: Redirect URL after submission -->
  <!-- <input type="hidden" name="redirectUrl" value="https://yourwebsite.com/thank-you" /> -->

  <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 20px; font-weight: 700; color: #0f172a;">${title}</h3>
  <p style="margin-top: 0; margin-bottom: 24px; font-size: 14px; color: #64748b; line-height: 1.5;">Please fill out the form below.</p>

${fieldsHtml}

  <button type="submit" style="width: 100%; background: ${accentColor}; color: #ffffff; border: none; padding: 14px 20px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Submit</button>
</form>`;
    }

    return '';
  }, [embedStyle, buttonText, accentColor, embedUrl, uniqueId, fields, formId, effectiveWorkspaceId, effectiveOrganizationId, title]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedLink(true);
      toast({
        title: 'Link Copied!',
        description: `${resourceName} link copied to your clipboard.`,
      });
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err: unknown) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleCopyShortUrl = async () => {
    if (!shortUrl) return;
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopiedShortcode(true);
      toast({
        title: 'Shortcode Copied!',
        description: `Trackable short link copied to your clipboard.`,
      });
      setTimeout(() => setCopiedShortcode(false), 2000);
    } catch (err: unknown) {
      console.error('Failed to copy shortcode:', err);
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      console.error('Failed to copy custom code:', err);
    }
  };

  const handleCreateShortcode = async () => {
    if (!effectiveOrganizationId || !effectiveWorkspaceId) {
      toast({
        title: 'Workspace Required',
        description: 'Please select an active workspace to generate a shortcode.',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingShortcode(true);
    try {
      const res = await createQRCode({
        organizationId: effectiveOrganizationId,
        workspaceId: effectiveWorkspaceId,
        name: `${resourceName} Dynamic Link`,
        mode: 'dynamic',
        type: 'url',
        destination: { url: publicUrl },
        design: {
          foregroundColor: qrDotColor,
          dotStyle: qrDotType,
        },
        createdBy: effectiveUser,
        customShortPath: customSlugDraft.trim() || undefined,
      });

      setExistingQrId(res.id);
      setShortcode(res.shortPath || '');
      setCustomSlugDraft(res.shortPath || '');
      setIsEditingSlug(false);

      toast({
        title: 'Shortcode Created!',
        description: `Your dynamic link "/q/${res.shortPath}" is now active.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create shortcode';
      toast({
        title: 'Creation Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingShortcode(false);
    }
  };

  const handleUpdateShortcodeSlug = async () => {
    if (!existingQrId || !effectiveOrganizationId || !effectiveWorkspaceId) return;

    const sanitized = customSlugDraft.trim();
    if (!sanitized) {
      toast({
        title: 'Invalid Shortcode',
        description: 'Shortcode cannot be empty.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingSlug(true);
    try {
      const res = await updateQRShortPath(
        effectiveOrganizationId,
        effectiveWorkspaceId,
        existingQrId,
        sanitized
      );

      if (!res.success) {
        toast({
          title: 'Slug Unavailable',
          description: res.error || 'Failed to update shortcode slug.',
          variant: 'destructive',
        });
        return;
      }

      setShortcode(sanitized);
      setIsEditingSlug(false);
      toast({
        title: 'Shortcode Updated!',
        description: `Your link is now active at /q/${sanitized}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update shortcode';
      toast({
        title: 'Update Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSavingSlug(false);
    }
  };

  const handleDownloadQR = async (format: 'png' | 'svg') => {
    setIsDownloadingQr(true);
    try {
      const cleanSlug = (shortcode || resourceName || 'code')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-');
      const filename = `${cleanSlug}-qr`;

      await downloadQR(
        resolvedQrData,
        {
          foregroundColor: qrDotColor,
          dotStyle: qrDotType,
          logoUrl: qrIncludeLogo ? (activeOrganization?.logoUrl || '/icon-192x192.png') : undefined,
          logoSize: 22,
          logoMargin: 4,
        },
        format,
        filename
      );

      toast({
        title: 'QR Code Downloaded',
        description: `Saved as ${filename}.${format}`,
      });
    } catch (err: unknown) {
      console.error('Failed to download QR code:', err);
      toast({
        title: 'Download Failed',
        description: 'Could not export QR code image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloadingQr(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-[640px] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-300"
        >
          {/* Header Demarcation with Title, CardInfoTooltip & Flex-Centered Close Button */}
          <DialogHeader className="px-6 py-5 min-h-[64px] border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between shrink-0 space-y-0">
            <div className="flex items-center gap-2.5">
              <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                {title}
              </DialogTitle>
              <CardInfoTooltip
                text={`Share this ${resourceName.toLowerCase()} directly, distribute via trackable shortcode, or embed it across websites and physical prints.`}
                side="bottom"
              />
              <DialogDescription className="sr-only">
                Share this {resourceName.toLowerCase()} directly, distribute via trackable shortcode, or embed it across websites and physical prints.
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                className="rounded-full h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none active:scale-95 cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
            </DialogClose>
          </DialogHeader>

          {/* Modal Body Container with Standard Padding & Responsive Scroll */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-76px)] flex-1">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-5 w-full p-1 bg-muted/80 border border-border/60 rounded-xl mb-4 text-xs">
              <TabsTrigger value="link" className="rounded-lg font-semibold gap-1.5 py-2 px-1 text-xs text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all">
                <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Direct Link</span>
                <span className="sm:hidden">Link</span>
              </TabsTrigger>
              <TabsTrigger value="shortcode" className="rounded-lg font-semibold gap-1.5 py-2 px-1 text-xs text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all">
                <Radio className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Shortcode</span>
                <span className="sm:hidden">Short</span>
              </TabsTrigger>
              <TabsTrigger value="qr" className="rounded-lg font-semibold gap-1.5 py-2 px-1 text-xs text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all">
                <QrCode className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">QR Code</span>
                <span className="sm:hidden">QR</span>
              </TabsTrigger>
              <TabsTrigger value="embed" className="rounded-lg font-semibold gap-1.5 py-2 px-1 text-xs text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all">
                <Code className="h-3.5 w-3.5 shrink-0" />
                <span>Iframe</span>
              </TabsTrigger>
              <TabsTrigger value="code" className="rounded-lg font-semibold gap-1.5 py-2 px-1 text-xs text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all">
                <Terminal className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Code Embed</span>
                <span className="sm:hidden">Widget</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: DIRECT LINK */}
            <TabsContent value="link" className="space-y-4 outline-none">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                  Public Page URL
                </label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={publicUrl}
                    className="rounded-xl border-border/80 bg-muted/40 text-foreground focus-visible:ring-primary font-mono text-xs py-5"
                  />
                  <Button
                    onClick={handleCopyLink}
                    className="rounded-xl px-4 py-5 font-semibold gap-2 active:scale-[0.97] transition-all duration-200 min-h-[44px] bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
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

              <div className="flex justify-between items-center bg-muted/40 border border-border/80 p-4 rounded-2xl">
                <div className="space-y-0.5 pr-2">
                  <h4 className="text-sm font-semibold text-foreground">Open Public Page</h4>
                  <p className="text-xs text-muted-foreground">Test the live landing page link in a new browser tab.</p>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl font-semibold gap-1.5 shrink-0 min-h-[44px] border-border/80 bg-card text-foreground hover:bg-muted active:scale-[0.97]" asChild>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    View Live
                  </a>
                </Button>
              </div>
            </TabsContent>

            {/* TAB 2: DYNAMIC SHORTCODE */}
            <TabsContent value="shortcode" className="space-y-4 outline-none">
              {isLoadingShortcode ? (
                <div className="flex flex-col items-center justify-center p-8 gap-3 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-xs font-medium">Looking up shortcode & scan telemetry…</p>
                </div>
              ) : shortcode ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Trackable Shortlink
                      </label>
                      <Badge variant="outline" className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                        ⚡ Active Dynamic Link
                      </Badge>
                    </div>

                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={shortUrl}
                        className="rounded-xl border-border/80 bg-muted/40 text-foreground focus-visible:ring-primary font-mono text-xs py-5"
                      />
                      <Button
                        onClick={handleCopyShortUrl}
                        className="rounded-xl px-4 py-5 font-semibold gap-2 active:scale-[0.97] transition-all duration-200 min-h-[44px] bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          {copiedShortcode ? (
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

                  {/* Telemetry & Quick Action Card */}
                  <div className="border border-border/80 bg-muted/40 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-foreground">Scan Analytics</span>
                        <p className="text-[11px] text-muted-foreground">Real-time scan counter logged via Firestore telemetry.</p>
                      </div>
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/15 font-bold border border-primary/20 text-xs px-2.5 py-1">
                        {totalScans} Total Scans
                      </Badge>
                    </div>

                    {isEditingSlug ? (
                      <div className="pt-2 border-t border-border/60 space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">Custom Shortcode Slug</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">/q/</span>
                          <Input
                            value={customSlugDraft}
                            onChange={(e) => setCustomSlugDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                            placeholder="my-custom-slug"
                            className="h-9 rounded-lg font-mono text-xs flex-1 border-border/80 bg-card text-foreground"
                          />
                          <Button
                            size="sm"
                            onClick={handleUpdateShortcodeSlug}
                            disabled={isSavingSlug || !customSlugDraft.trim() || customSlugDraft === shortcode}
                            className="rounded-lg font-semibold gap-1 min-h-[36px] active:scale-[0.97] bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                          >
                            {isSavingSlug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setIsEditingSlug(false);
                              setCustomSlugDraft(shortcode);
                            }}
                            className="rounded-lg h-9 w-9 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingSlug(true)}
                          className="rounded-xl text-xs font-semibold gap-1.5 h-9 text-foreground hover:bg-muted/60 active:scale-[0.97]"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Customize Slug
                        </Button>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl text-xs font-semibold gap-1.5 h-9 border-border/80 bg-card text-foreground hover:bg-muted active:scale-[0.97]"
                            asChild
                          >
                            <a href={shortUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                              View Live
                            </a>
                          </Button>

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setActiveTab('qr')}
                            className="rounded-xl text-xs font-semibold gap-1.5 h-9 bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-[0.97]"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                            View QR Code
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border border-dashed border-border/80 bg-muted/20 rounded-2xl p-6 text-center space-y-3">
                    <div className="h-10 w-10 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <Radio className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-foreground">Generate Dynamic Shortcode</h4>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        Create a trackable `/q/...` short link with live scan analytics, instant redirection, and vector QR capabilities.
                      </p>
                    </div>

                    <div className="max-w-xs mx-auto space-y-2 pt-2 text-left">
                      <Label className="text-xs text-muted-foreground">Optional Custom Slug</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">/q/</span>
                        <Input
                          value={customSlugDraft}
                          onChange={(e) => setCustomSlugDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                          placeholder="e.g. onboard-2026"
                          className="h-9 rounded-lg font-mono text-xs border-border/80 bg-card text-foreground"
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleCreateShortcode}
                      disabled={isGeneratingShortcode}
                      className="rounded-xl px-5 py-5 font-semibold gap-2 active:scale-[0.97] transition-all min-h-[44px] w-full max-w-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                    >
                      {isGeneratingShortcode ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating Shortcode…
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Generate Shortcode
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 3: HIGH-RESOLUTION QR CODE */}
            <TabsContent value="qr" className="space-y-4 outline-none">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
                {/* Visual Preview Container */}
                <div className="sm:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl border border-border/80 bg-muted/40 space-y-2">
                  <div className="p-3.5 bg-white rounded-2xl shadow-sm border border-border/60 flex items-center justify-center">
                    <QRPreview
                      data={resolvedQrData}
                      size={180}
                      design={{
                        foregroundColor: qrDotColor,
                        dotStyle: qrDotType,
                        backgroundColor: '#FFFFFF',
                        logoUrl: qrIncludeLogo ? (activeOrganization?.logoUrl || '/icon-192x192.png') : undefined,
                        logoSize: 22,
                        logoMargin: 4,
                      }}
                      showFrame={false}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground text-center truncate max-w-[200px] font-medium" title={resolvedQrData}>
                    {qrTarget === 'short' && shortcode ? `/q/${shortcode}` : 'Direct URL'}
                  </span>
                </div>

                {/* Configuration Options */}
                <div className="sm:col-span-7 space-y-4">
                  {/* Encoded Target URL Toggle */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      QR Target Destination
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setQrTarget('short')}
                        disabled={!shortcode}
                        className={cn(
                          "flex flex-col items-start p-2.5 rounded-xl border text-left transition-all duration-200 min-h-[44px] cursor-pointer active:scale-[0.97]",
                          qrTarget === 'short' && shortcode
                            ? "border-primary bg-primary/10 text-primary dark:bg-primary/20 shadow-xs ring-1 ring-primary/40 font-semibold"
                            : "border-border/80 bg-card text-foreground hover:bg-muted/60 dark:hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                        )}
                      >
                        <span className="text-xs font-semibold">Shortlink (/q/…)</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Dynamic & trackable</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQrTarget('direct')}
                        className={cn(
                          "flex flex-col items-start p-2.5 rounded-xl border text-left transition-all duration-200 min-h-[44px] cursor-pointer active:scale-[0.97]",
                          qrTarget === 'direct'
                            ? "border-primary bg-primary/10 text-primary dark:bg-primary/20 shadow-xs ring-1 ring-primary/40 font-semibold"
                            : "border-border/80 bg-card text-foreground hover:bg-muted/60 dark:hover:bg-muted/40 font-medium"
                        )}
                      >
                        <span className="text-xs font-semibold">Direct Full URL</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Standard web page</span>
                      </button>
                    </div>
                  </div>

                  {/* Brand Color Palettes */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Palette className="h-3 w-3" />
                        Dot Color
                      </Label>
                      <span className="text-[11px] font-mono text-muted-foreground font-semibold">{qrDotColor}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {QR_COLOR_PRESETS.map((preset) => {
                        const isSelected = qrDotColor.toLowerCase() === preset.color.toLowerCase();
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setQrDotColor(preset.color)}
                            title={preset.label}
                            className={cn(
                              "h-7 w-7 rounded-full border border-black/20 dark:border-white/30 transition-all duration-150 cursor-pointer flex items-center justify-center shadow-xs",
                              isSelected
                                ? "ring-2 ring-primary ring-offset-2 ring-offset-card scale-110"
                                : "hover:scale-105 opacity-90 hover:opacity-100"
                            )}
                            style={{ backgroundColor: preset.color }}
                          >
                            {isSelected && (
                              <Check className="h-3.5 w-3.5 text-white drop-shadow-sm stroke-[3px]" />
                            )}
                          </button>
                        );
                      })}
                      <div
                        className={cn(
                          "relative h-7 w-7 rounded-full border border-dashed border-border/90 hover:border-primary transition-all duration-150 cursor-pointer flex items-center justify-center shadow-xs overflow-hidden",
                          !QR_COLOR_PRESETS.some((p) => p.color.toLowerCase() === qrDotColor.toLowerCase()) &&
                            "ring-2 ring-primary ring-offset-2 ring-offset-card scale-110"
                        )}
                        title="Custom Hex Color"
                      >
                        <input
                          type="color"
                          value={qrDotColor}
                          onChange={(e) => setQrDotColor(e.target.value)}
                          className="absolute -inset-4 w-16 h-16 cursor-pointer opacity-0"
                          aria-label="Pick custom dot color"
                        />
                        <div className="w-full h-full rounded-full" style={{ backgroundColor: qrDotColor }} />
                      </div>
                    </div>
                  </div>

                  {/* Dot Shape Selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Dot Shape
                    </Label>
                    <div className="grid grid-cols-4 gap-1.5 text-xs">
                      {(['rounded', 'dots', 'square', 'classy'] as const).map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => setQrDotType(style)}
                          className={cn(
                            "py-2 px-2 rounded-xl border text-center capitalize transition-all duration-150 cursor-pointer text-xs min-h-[36px] active:scale-[0.97]",
                            qrDotType === style
                              ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
                              : "border-border/80 bg-card text-foreground hover:bg-muted/60 dark:hover:bg-muted/40 font-medium"
                          )}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Logo Overlay Toggle */}
                  <div className="flex items-center justify-between pt-1">
                    <Label htmlFor="qr-logo-toggle" className="text-xs font-semibold text-foreground cursor-pointer select-none">
                      Include Center Brand Logo
                    </Label>
                    <Switch
                      id="qr-logo-toggle"
                      checked={qrIncludeLogo}
                      onCheckedChange={setQrIncludeLogo}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t border-border/80">
                <Button
                  onClick={() => handleDownloadQR('png')}
                  disabled={isDownloadingQr}
                  className="rounded-xl font-semibold gap-1.5 min-h-[44px] active:scale-[0.97] bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                >
                  <Download className="h-4 w-4" />
                  Download PNG
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleDownloadQR('svg')}
                  disabled={isDownloadingQr}
                  className="rounded-xl font-semibold gap-1.5 min-h-[44px] active:scale-[0.97] border-border/80 bg-card text-foreground hover:bg-muted"
                >
                  <Download className="h-4 w-4" />
                  Download SVG
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => setIsQrStudioSheetOpen(true)}
                  className="rounded-xl font-semibold gap-1.5 min-h-[44px] active:scale-[0.97] bg-secondary text-secondary-foreground hover:bg-secondary/80"
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                  QR Studio Designer
                </Button>
              </div>
            </TabsContent>

            {/* TAB 4: IFRAME SNIPPET */}
            <TabsContent value="embed" className="space-y-4 outline-none">
              <div className="space-y-2">
                <div className="flex justify-between items-end ml-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Iframe HTML Snippet
                  </label>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    embed=true enabled
                  </span>
                </div>
                
                <div className="relative">
                  <pre className="p-4 rounded-2xl bg-zinc-950 text-zinc-100 overflow-x-auto text-[11px] font-mono leading-relaxed border border-border/80 max-h-[140px] text-wrap select-all">
                    {embedCode}
                  </pre>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleCopyEmbed}
                  className="rounded-xl font-semibold gap-2 active:scale-[0.97] transition-all duration-200 w-full py-5 min-h-[44px] bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
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

            {/* TAB 5: ADVANCED CODE EMBED */}
            <TabsContent value="code" className="space-y-4 outline-none">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                  Select Embed Style
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => setEmbedStyle('inline-widget')}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-h-[44px] active:scale-[0.97]",
                      embedStyle === 'inline-widget'
                        ? "border-primary bg-primary/10 text-primary dark:bg-primary/20 font-semibold shadow-xs ring-1 ring-primary/40"
                        : "border-border/80 bg-card text-foreground hover:bg-muted/60 dark:hover:bg-muted/40 font-medium"
                    )}
                  >
                    <span className="text-xs font-semibold">Inline Widget</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmbedStyle('popup-modal')}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-h-[44px] active:scale-[0.97]",
                      embedStyle === 'popup-modal'
                        ? "border-primary bg-primary/10 text-primary dark:bg-primary/20 font-semibold shadow-xs ring-1 ring-primary/40"
                        : "border-border/80 bg-card text-foreground hover:bg-muted/60 dark:hover:bg-muted/40 font-medium"
                    )}
                  >
                    <span className="text-xs font-semibold">Popup Modal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmbedStyle('slide-drawer')}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-h-[44px] active:scale-[0.97]",
                      embedStyle === 'slide-drawer'
                        ? "border-primary bg-primary/10 text-primary dark:bg-primary/20 font-semibold shadow-xs ring-1 ring-primary/40"
                        : "border-border/80 bg-card text-foreground hover:bg-muted/60 dark:hover:bg-muted/40 font-medium"
                    )}
                  >
                    <span className="text-xs font-semibold">Slide Panel</span>
                  </button>
                  <button
                    type="button"
                    disabled={resourceName !== 'Form' || !fields}
                    onClick={() => setEmbedStyle('raw-html')}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-h-[44px] active:scale-[0.97]",
                      embedStyle === 'raw-html'
                        ? "border-primary bg-primary/10 text-primary dark:bg-primary/20 font-semibold shadow-xs ring-1 ring-primary/40"
                        : "border-border/80 bg-card text-foreground hover:bg-muted/60 dark:hover:bg-muted/40 font-medium"
                    )}
                  >
                    <span className="text-xs font-semibold">Raw HTML Form</span>
                  </button>
                </div>
              </div>

              {/* Advanced Configuration Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-border/80 p-4 rounded-2xl bg-muted/40">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CTA Button Label</span>
                  </div>
                  <Input
                    disabled={embedStyle === 'inline-widget' || embedStyle === 'raw-html'}
                    value={buttonText}
                    onChange={(e) => setButtonText(e.target.value)}
                    className="h-9 rounded-lg border-border/80 bg-card text-foreground text-xs"
                    placeholder="e.g. Open Form"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-full border border-border/80" style={{ backgroundColor: accentColor }} />
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-semibold">Accent Theme Color</span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="h-9 w-12 p-0.5 rounded-lg border-border/80 bg-card cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="h-9 flex-1 rounded-lg border-border/80 bg-card text-foreground text-xs font-mono"
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
                  <pre className="p-4 rounded-2xl bg-zinc-950 text-zinc-100 overflow-x-auto text-[11px] font-mono leading-relaxed border border-border/80 max-h-[140px] text-wrap select-all">
                    {generatedCode}
                  </pre>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleCopyCustomCode}
                  className="rounded-xl font-semibold gap-2 active:scale-[0.97] transition-all duration-200 w-full py-5 min-h-[44px] bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
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
        </div>
      </DialogContent>
    </Dialog>

      {/* Conditionally Mount Unified QR Sheet for Advanced Studio Designer */}
      {isQrStudioSheetOpen && (
        <UnifiedQRSheet
          open={isQrStudioSheetOpen}
          onOpenChange={setIsQrStudioSheetOpen}
          url={resolvedQrData}
          resourceName={resourceName}
          resourceContext={title}
          resourceType="url"
          workspaceId={effectiveWorkspaceId}
          organizationId={effectiveOrganizationId}
          currentUser={effectiveUser}
        />
      )}
    </>
  );
}
