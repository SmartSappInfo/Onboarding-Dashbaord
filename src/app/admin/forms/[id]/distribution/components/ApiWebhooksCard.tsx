'use client';

/**
 * SmartSapp Forms 2.0: Developer API & Webhook Distribution Card
 * 
 * Provides REST API specifications, sample cURL requests, and webhook
 * dispatch metadata for headless programmatic submission.
 */

import React, { useState } from 'react';
import { 
  Terminal, 
  Copy, 
  Check, 
  Webhook, 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { Form } from '@/lib/types';

interface ApiWebhooksCardProps {
  form: Form;
}

export default function ApiWebhooksCard({ form }: ApiWebhooksCardProps) {
  const { toast } = useToast();
  const [hasCopiedCurl, setHasCopiedCurl] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.smartsapp.com';
  const slug = form.slug || form.id;
  const endpointUrl = `${origin}/api/v1/forms/${slug}/submissions`;

  // Construct dynamic payload sample from actual form fields
  const samplePayload: Record<string, string> = {};
  if (form.fields && form.fields.length > 0) {
    form.fields.forEach((f) => {
      const key = f.appFieldId || f.id;
      samplePayload[key] = `sample_${key}_value`;
    });
  } else {
    samplePayload['fullName'] = 'Kwame Mensah';
    samplePayload['email'] = 'kwame@example.com';
  }

  const curlSnippet = `curl -X POST "${endpointUrl}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_WORKSPACE_API_KEY" \\
  -d '${JSON.stringify({ data: samplePayload }, null, 2)}'`;

  const handleCopyCurl = async () => {
    try {
      await navigator.clipboard.writeText(curlSnippet);
      setHasCopiedCurl(true);
      toast({ title: 'cURL Command Copied', description: 'API submission snippet copied to clipboard.' });
      setTimeout(() => setHasCopiedCurl(false), 2500);
    } catch {
      toast({ title: 'Copy Failed', description: 'Could not copy snippet.', variant: 'destructive' });
    }
  };

  return (
    <Card className="rounded-3xl border-border/60 bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              Developer API & Headless Distribution
            </CardTitle>
            <CardDescription className="text-xs">
              Submit form data programmatically from backend microservices, iOS/Android native apps, or IoT devices.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 border-blue-500/20">
            REST API v1
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Endpoint Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Submission Endpoint
            </span>
            <Badge variant="secondary" className="font-mono text-[10px] font-bold">
              POST
            </Badge>
          </div>

          <div className="p-3 rounded-2xl bg-muted/20 border border-border/40 font-mono text-xs text-foreground truncate select-all">
            {endpointUrl}
          </div>
        </div>

        {/* cURL Command Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              cURL Request Sample
            </span>
            <Button
              size="sm"
              onClick={handleCopyCurl}
              className="h-8 px-3 rounded-xl text-xs font-bold gap-1.5"
            >
              {hasCopiedCurl ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {hasCopiedCurl ? 'Copied' : 'Copy cURL'}
            </Button>
          </div>

          <pre className="p-4 rounded-2xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed select-all">
            {curlSnippet}
          </pre>
        </div>

        {/* Webhooks Information */}
        <div className="space-y-2 pt-2 border-t border-border/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Webhook className="h-3.5 w-3.5 text-primary" />
              Automated Outbound Webhooks
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-muted/10 border border-border/40 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-foreground">Dispatched Event: form.submitted</p>
              <p className="text-[11px] text-muted-foreground">
                Configured webhooks receive instant real-time JSON payloads upon every successful submission.
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-semibold">
              {form.actions?.webhooks?.length || 0} Webhook{form.actions?.webhooks?.length !== 1 ? 's' : ''} Active
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
