'use client';

import * as React from 'react';
import {
  ExternalLink,
  ClipboardList,
  ClipboardSignature,
  Layout,
  Globe,
  FileText,
  Calendar,
  Receipt,
  UserCircle,
  Wifi,
  Mail,
  MessageCircle,
  MessageSquare,
  Type,
  FileUp,
} from 'lucide-react';
import type { QRCodeType } from '@/lib/types';
import type { WizardState } from './create-qr-wizard';

interface StepTypeProps {
  state: WizardState;
  updateState: (patch: Partial<WizardState>) => void;
}

const QR_TYPE_OPTIONS: { value: QRCodeType; label: string; description: string; icon: React.ElementType; group: string }[] = [
  // SmartSapp Resources
  { value: 'survey', label: 'Survey', description: 'Link to a SmartSapp survey', icon: ClipboardList, group: 'SmartSapp Links' },
  { value: 'form', label: 'Form', description: 'Link to a SmartSapp form', icon: ClipboardSignature, group: 'SmartSapp Links' },
  { value: 'landing_page', label: 'Landing Page', description: 'Link to a campaign page', icon: Layout, group: 'SmartSapp Links' },
  { value: 'public_portal', label: 'Public Portal', description: 'Link to a public portal', icon: Globe, group: 'SmartSapp Links' },
  { value: 'doc_signing', label: 'Doc Signing', description: 'Link to a signing packet', icon: FileText, group: 'SmartSapp Links' },
  { value: 'meeting', label: 'Meeting', description: 'Link to a meeting booking page', icon: Calendar, group: 'SmartSapp Links' },
  { value: 'invoice', label: 'Invoice / Payment', description: 'Link to an invoice or payment', icon: Receipt, group: 'SmartSapp Links' },
  // External
  { value: 'url', label: 'External URL', description: 'Any website or link', icon: ExternalLink, group: 'External' },
  // Data Types
  { value: 'vcard', label: 'vCard / Contact', description: 'Share contact information', icon: UserCircle, group: 'Data' },
  { value: 'wifi', label: 'Wi-Fi', description: 'Connect to a network', icon: Wifi, group: 'Data' },
  { value: 'email', label: 'Email', description: 'Pre-fill an email', icon: Mail, group: 'Data' },
  { value: 'sms', label: 'SMS', description: 'Pre-fill a text message', icon: MessageCircle, group: 'Data' },
  { value: 'whatsapp', label: 'WhatsApp', description: 'Open a WhatsApp chat', icon: MessageSquare, group: 'Data' },
  { value: 'text', label: 'Plain Text', description: 'Display text on scan', icon: Type, group: 'Data' },
  { value: 'file', label: 'File / PDF', description: 'Link to a downloadable file', icon: FileUp, group: 'Data' },
];

const GROUPS = ['SmartSapp Links', 'External', 'Data'];

export default function StepType({ state, updateState }: StepTypeProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">What type of QR code?</h2>
        <p className="text-sm text-muted-foreground mt-1">Choose what your QR code will link to.</p>
      </div>

      {GROUPS.map((group) => {
        const options = QR_TYPE_OPTIONS.filter((o) => o.group === group);
        return (
          <div key={group} className="space-y-3">
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{group}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {options.map((option) => {
                const isSelected = state.type === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateState({ type: option.value, destination: {} })}
                    className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-md shadow-primary/10 ring-1 ring-primary/20'
                        : 'border-border bg-card hover:border-primary/30 hover:bg-muted/30'
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl shrink-0 ${isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <option.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>{option.label}</p>
                      <p className="text-[11px] text-muted-foreground">{option.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
