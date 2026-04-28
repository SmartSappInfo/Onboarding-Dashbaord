'use client';

import * as React from 'react';
import { ExternalLink, Link2, AlertCircle, CheckCircle2, Wifi, Mail, Phone, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WizardState } from './create-qr-wizard';

interface StepDestinationProps {
  state: WizardState;
  updateState: (patch: Partial<WizardState>) => void;
  validationErrors?: string[];
}

const SMARTSAPP_TYPES = ['survey', 'form', 'landing_page', 'public_portal', 'doc_signing', 'meeting', 'invoice'];

// ─────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string): boolean {
  return /^\+?[\d\s\-()]{7,}$/.test(phone.trim());
}

export default function StepDestination({ state, updateState, validationErrors = [] }: StepDestinationProps) {
  const isSmartSappType = SMARTSAPP_TYPES.includes(state.type);
  const isExternalUrl = state.type === 'url';
  const isDataType = !isSmartSappType && !isExternalUrl;

  // URL validation state
  const urlValue = state.destination.url || '';
  const hasUrlInput = urlValue.length > 0;

  const urlValidation = React.useMemo(() => {
    if (!hasUrlInput) return null;
    if (isExternalUrl || isSmartSappType) {
      if (isValidUrl(urlValue)) return { valid: true, message: 'Valid URL' };
      if (urlValue.length > 5) return { valid: false, message: 'Enter a valid URL starting with https://' };
      return null; // still typing
    }
    return null;
  }, [urlValue, hasUrlInput, isExternalUrl, isSmartSappType]);

  const hasFieldError = (field: string) => validationErrors.includes(field);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">
          {isSmartSappType ? 'Choose destination' : isExternalUrl ? 'Enter URL' : 'Enter details'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isSmartSappType
            ? 'Paste the link to your SmartSapp resource, or enter it manually.'
            : isExternalUrl
            ? 'Paste any website URL.'
            : `Enter the ${state.type} details to encode in the QR code.`}
        </p>
      </div>

      {/* URL-based types */}
      {(isSmartSappType || isExternalUrl) && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dest-url" className="text-sm font-semibold">
              {isSmartSappType ? 'Resource URL' : 'Website URL'}
            </Label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="dest-url"
                placeholder={isSmartSappType ? 'https://app.smartsapp.com/surveys/...' : 'https://example.com'}
                value={urlValue}
                onChange={(e) =>
                  updateState({
                    destination: { ...state.destination, url: e.target.value },
                  })
                }
                className={`pl-10 pr-10 rounded-xl h-11 bg-muted/30 border transition-colors ${
                  hasFieldError('url')
                    ? 'border-destructive ring-1 ring-destructive/20'
                    : urlValidation?.valid === false
                    ? 'border-amber-500 ring-1 ring-amber-500/20'
                    : urlValidation?.valid === true
                    ? 'border-emerald-500 ring-1 ring-emerald-500/20'
                    : 'border-transparent'
                }`}
              />
              {/* Validation icon */}
              {urlValidation && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {urlValidation.valid ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  )}
                </div>
              )}
            </div>
            {/* Validation message */}
            {urlValidation && !urlValidation.valid && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {urlValidation.message}
              </p>
            )}
            {hasFieldError('url') && !urlValidation && (
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                A destination URL is required
              </p>
            )}
            {isSmartSappType && (
              <p className="text-[11px] text-muted-foreground">
                Tip: Copy the public link from your {state.type.replace('_', ' ')} and paste it here.
              </p>
            )}
          </div>

          {isSmartSappType && (
            <div className="space-y-2">
              <Label htmlFor="dest-name" className="text-sm font-semibold">
                Resource Name <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="dest-name"
                placeholder={`e.g. Admissions ${state.type.replace('_', ' ')}`}
                value={state.destination.resourceName || ''}
                onChange={(e) =>
                  updateState({
                    destination: { ...state.destination, resourceName: e.target.value },
                  })
                }
                className="rounded-xl h-11 bg-muted/30 border-none"
              />
            </div>
          )}
        </div>
      )}

      {/* Data types - expanded inputs */}
      {isDataType && (
        <div className="space-y-4">
          {/* ───── Email ───── */}
          {state.type === 'email' && (
            <EmailForm state={state} updateState={updateState} hasFieldError={hasFieldError} />
          )}

          {/* ───── SMS ───── */}
          {state.type === 'sms' && (
            <SMSForm state={state} updateState={updateState} hasFieldError={hasFieldError} protocol="sms" label="SMS" />
          )}

          {/* ───── WhatsApp ───── */}
          {state.type === 'whatsapp' && (
            <SMSForm state={state} updateState={updateState} hasFieldError={hasFieldError} protocol="whatsapp" label="WhatsApp" />
          )}

          {/* ───── Text ───── */}
          {state.type === 'text' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Text Content</Label>
              <Textarea
                placeholder="Enter the text to encode..."
                value={state.destination.url || ''}
                onChange={(e) => updateState({ destination: { ...state.destination, url: e.target.value } })}
                className={`rounded-xl bg-muted/30 min-h-[120px] border transition-colors ${
                  hasFieldError('url') ? 'border-destructive ring-1 ring-destructive/20' : 'border-transparent'
                }`}
              />
              {hasFieldError('url') && (
                <p className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Text content is required
                </p>
              )}
            </div>
          )}

          {/* ───── WiFi ───── */}
          {state.type === 'wifi' && (
            <WiFiForm state={state} updateState={updateState} hasFieldError={hasFieldError} />
          )}

          {/* ───── vCard ───── */}
          {state.type === 'vcard' && (
            <VCardForm state={state} updateState={updateState} hasFieldError={hasFieldError} />
          )}

          {/* ───── File ───── */}
          {state.type === 'file' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">File URL</Label>
              <Input
                placeholder="https://example.com/document.pdf"
                value={state.destination.url || ''}
                onChange={(e) => updateState({ destination: { ...state.destination, url: e.target.value } })}
                className={`rounded-xl h-11 bg-muted/30 border transition-colors ${
                  hasFieldError('url') ? 'border-destructive ring-1 ring-destructive/20' : 'border-transparent'
                }`}
              />
              {hasFieldError('url') && (
                <p className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> A file URL is required
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Preview of what will be encoded */}
      {state.destination.url && (
        <div className="p-4 rounded-xl bg-muted/30 border border-border">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1">Will encode</p>
          <p className="text-sm text-foreground font-mono break-all">{state.destination.url}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Email Form
// ─────────────────────────────────────────────────

function EmailForm({ state, updateState, hasFieldError }: {
  state: WizardState;
  updateState: (patch: Partial<WizardState>) => void;
  hasFieldError: (field: string) => boolean;
}) {
  const [email, setEmail] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');

  const emailValid = email.length === 0 || isValidEmail(email);

  const buildMailto = React.useCallback(() => {
    if (!email) return '';
    let mailto = `mailto:${email}`;
    const params: string[] = [];
    if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
    if (body) params.push(`body=${encodeURIComponent(body)}`);
    if (params.length > 0) mailto += `?${params.join('&')}`;
    return mailto;
  }, [email, subject, body]);

  React.useEffect(() => {
    updateState({ destination: { ...state.destination, url: buildMailto() } });
  }, [buildMailto]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Email Address</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="recipient@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`pl-10 rounded-xl h-11 bg-muted/30 border transition-colors ${
              hasFieldError('url') && !email
                ? 'border-destructive ring-1 ring-destructive/20'
                : !emailValid
                ? 'border-amber-500 ring-1 ring-amber-500/20'
                : 'border-transparent'
            }`}
          />
        </div>
        {!emailValid && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Enter a valid email address
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Subject <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input
          placeholder="e.g. Inquiry about..."
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="rounded-xl h-11 bg-muted/30 border-none"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Body <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Textarea
          placeholder="Pre-filled email body..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="rounded-xl bg-muted/30 border-none min-h-[80px]"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// SMS / WhatsApp Form
// ─────────────────────────────────────────────────

function SMSForm({ state, updateState, hasFieldError, protocol, label }: {
  state: WizardState;
  updateState: (patch: Partial<WizardState>) => void;
  hasFieldError: (field: string) => boolean;
  protocol: 'sms' | 'whatsapp';
  label: string;
}) {
  const [phone, setPhone] = React.useState('');
  const [message, setMessage] = React.useState('');

  const phoneValid = phone.length === 0 || isValidPhone(phone);

  React.useEffect(() => {
    if (!phone) {
      updateState({ destination: { ...state.destination, url: '' } });
      return;
    }
    const cleanPhone = phone.replace(/[\s\-()]/g, '');
    let url: string;
    if (protocol === 'whatsapp') {
      url = `https://wa.me/${cleanPhone}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
    } else {
      url = `sms:${cleanPhone}${message ? `?body=${encodeURIComponent(message)}` : ''}`;
    }
    updateState({ destination: { ...state.destination, url } });
  }, [phone, message]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-semibold">{label} Number</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="+1234567890"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={`pl-10 rounded-xl h-11 bg-muted/30 border transition-colors ${
              hasFieldError('url') && !phone
                ? 'border-destructive ring-1 ring-destructive/20'
                : !phoneValid
                ? 'border-amber-500 ring-1 ring-amber-500/20'
                : 'border-transparent'
            }`}
          />
        </div>
        {!phoneValid && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Enter a valid phone number with country code
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Pre-filled Message <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Textarea
          placeholder={`Message that will appear when they open ${label}...`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="rounded-xl bg-muted/30 border-none min-h-[80px]"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// WiFi Form
// ─────────────────────────────────────────────────

function WiFiForm({ state, updateState, hasFieldError }: {
  state: WizardState;
  updateState: (patch: Partial<WizardState>) => void;
  hasFieldError: (field: string) => boolean;
}) {
  const [ssid, setSsid] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [encryption, setEncryption] = React.useState<'WPA' | 'WEP' | 'nopass'>('WPA');

  React.useEffect(() => {
    if (!ssid) {
      updateState({ destination: { ...state.destination, url: '' } });
      return;
    }
    // Standard WiFi QR format: WIFI:S:<SSID>;T:<WPA|WEP|nopass>;P:<password>;;
    const wifiString = `WIFI:S:${ssid};T:${encryption};P:${password};;`;
    updateState({ destination: { ...state.destination, url: wifiString, resourceName: ssid } });
  }, [ssid, password, encryption]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Network Name (SSID)</Label>
        <div className="relative">
          <Wifi className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="MyWiFiNetwork"
            value={ssid}
            onChange={(e) => setSsid(e.target.value)}
            className={`pl-10 rounded-xl h-11 bg-muted/30 border transition-colors ${
              hasFieldError('url') && !ssid ? 'border-destructive ring-1 ring-destructive/20' : 'border-transparent'
            }`}
          />
        </div>
        {hasFieldError('url') && !ssid && (
          <p className="text-[11px] text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Network name is required
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Encryption</Label>
        <Select value={encryption} onValueChange={(val) => setEncryption(val as 'WPA' | 'WEP' | 'nopass')}>
          <SelectTrigger className="rounded-xl h-11 bg-muted/30 border-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="WPA">WPA / WPA2 / WPA3</SelectItem>
            <SelectItem value="WEP">WEP</SelectItem>
            <SelectItem value="nopass">None (Open)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {encryption !== 'nopass' && (
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Password</Label>
          <Input
            type="password"
            placeholder="Enter WiFi password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl h-11 bg-muted/30 border-none"
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// vCard Form
// ─────────────────────────────────────────────────

function VCardForm({ state, updateState, hasFieldError }: {
  state: WizardState;
  updateState: (patch: Partial<WizardState>) => void;
  hasFieldError: (field: string) => boolean;
}) {
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [title, setTitle] = React.useState('');

  React.useEffect(() => {
    if (!fullName) {
      updateState({ destination: { ...state.destination, url: '' } });
      return;
    }
    // Build vCard 3.0 string
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${fullName}`,
    ];
    if (phone) lines.push(`TEL:${phone}`);
    if (email) lines.push(`EMAIL:${email}`);
    if (company) lines.push(`ORG:${company}`);
    if (title) lines.push(`TITLE:${title}`);
    lines.push('END:VCARD');

    const vcard = lines.join('\n');
    updateState({ destination: { ...state.destination, url: vcard, resourceName: fullName } });
  }, [fullName, phone, email, company, title]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Full Name</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="John Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={`pl-10 rounded-xl h-11 bg-muted/30 border transition-colors ${
              hasFieldError('url') && !fullName ? 'border-destructive ring-1 ring-destructive/20' : 'border-transparent'
            }`}
          />
        </div>
        {hasFieldError('url') && !fullName && (
          <p className="text-[11px] text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Full name is required
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Phone <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            placeholder="+1234567890"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-xl h-11 bg-muted/30 border-none"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Email <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            placeholder="john@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl h-11 bg-muted/30 border-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Company <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            placeholder="Acme Inc."
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="rounded-xl h-11 bg-muted/30 border-none"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Title <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            placeholder="Product Manager"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-xl h-11 bg-muted/30 border-none"
          />
        </div>
      </div>
    </div>
  );
}
