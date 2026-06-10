'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Mail, MessageSquare, BellOff, CheckCircle2, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import type { OrgBranding } from '@/lib/types';

interface UnsubscribeClientProps {
  id: string;
  workspaceId: string;
  initialChannel: string;
  workspaceName?: string;
  orgBranding?: OrgBranding | null;
}

export default function UnsubscribeClient({
  id,
  workspaceId,
  initialChannel,
  workspaceName,
  orgBranding
}: UnsubscribeClientProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [preferences, setPreferences] = useState({
    email: initialChannel === 'email' || initialChannel === 'all',
    sms: initialChannel === 'sms' || initialChannel === 'all',
  });

  const handleUnsubscribe = async (all = false) => {
    setStatus('loading');
    try {
      const response = await fetch('/api/messaging/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          workspaceId,
          channels: all ? ['email', 'sms'] : Object.entries(preferences).filter(([_, v]) => !v).map(([k]) => k),
          reason: 'user_request',
        }),
      });

      if (response.ok) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch (err) {
      console.error('Unsubscribe failed:', err);
      setStatus('error');
    }
  };

  const displayName = orgBranding?.name || workspaceName || workspaceId;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]" />
      
      <AnimatePresence mode="wait">
        {status === 'success' ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-md"
          >
            <Card className="border-none shadow-2xl overflow-hidden bg-white/80 backdrop-blur-sm">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <CardTitle className="text-2xl font-bold text-slate-900">Preferences Updated</CardTitle>
                <CardDescription className="text-slate-600 mt-2">
                  We've successfully updated your communication preferences for <b>{displayName}</b>.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center text-sm text-slate-500 pb-8">
                You will no longer receive marketing messages via the selected channels. 
                Transaction-critical alerts may still be delivered.
              </CardContent>
              <CardFooter className="bg-slate-50 border-t flex justify-center py-4">
                <p className="text-xs text-slate-400">© {new Date().getFullYear()} {orgBranding?.name || 'SmartSapp'} Services</p>
              </CardFooter>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <Card className="border-none shadow-2xl">
              <CardHeader className="space-y-1">
                {orgBranding?.logoUrl ? (
                  <div className="relative h-10 w-36 mb-4">
                    <Image
                      src={orgBranding.logoUrl}
                      alt={`${orgBranding.name} logo`}
                      fill
                      className="object-contain object-left"
                      unoptimized={orgBranding.logoUrl.startsWith('http')}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-5 h-5 text-[var(--primary)]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]/80">Security & Privacy</span>
                  </div>
                )}
                <CardTitle className="text-2xl font-bold tracking-tight">Email & SMS Preferences</CardTitle>
                <CardDescription>
                  Manage how {displayName} communicates with you. Unchecking a channel will stop all future non-critical messages.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 py-6">
                <div className="space-y-4">
                  <div className="flex items-start space-x-4 p-4 rounded-xl border bg-slate-50/50 hover:bg-white transition-colors cursor-pointer" onClick={() => setPreferences(prev => ({ ...prev, email: !prev.email }))}>
                    <Mail className="mt-1 h-5 w-5 text-slate-400" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold leading-none cursor-pointer">Email Notifications</Label>
                        <Checkbox 
                          id="email" 
                          checked={preferences.email} 
                          onCheckedChange={(val) => setPreferences(prev => ({ ...prev, email: !!val }))}
                        />
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Weekly updates, campaign reports, and announcements.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4 p-4 rounded-xl border bg-slate-50/50 hover:bg-white transition-colors cursor-pointer" onClick={() => setPreferences(prev => ({ ...prev, sms: !prev.sms }))}>
                    <MessageSquare className="mt-1 h-5 w-5 text-slate-400" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold leading-none cursor-pointer">SMS Alerts</Label>
                        <Checkbox 
                          id="sms" 
                          checked={preferences.sms} 
                          onCheckedChange={(val) => setPreferences(prev => ({ ...prev, sms: !!val }))}
                        />
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Instant mobile alerts for time-sensitive events and reminders.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <Button 
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 text-base font-semibold rounded-xl transition-all active:scale-95" 
                    onClick={() => handleUnsubscribe()}
                    disabled={status === 'loading'}
                  >
                    {status === 'loading' ? 'Saving Preferences...' : 'Update My Preferences'}
                  </Button>
                  <button 
                    className="mt-4 text-xs font-medium text-slate-400 hover:text-red-500 transition-colors flex items-center justify-center gap-1 mx-auto"
                    onClick={() => handleUnsubscribe(true)}
                    disabled={status === 'loading'}
                  >
                    <BellOff className="w-3 h-3" />
                    Unsubscribe from all future messages
                  </button>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4 border-t bg-slate-50/50 pt-6">
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> SSL Secured</span>
                  <span>•</span>
                  <span>Recipient: {id.includes('@') ? id : 'Identified User'}</span>
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
