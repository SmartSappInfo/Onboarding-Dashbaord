'use client';

import React, { useState, useTransition } from 'react';
import { updatePreferencesAction } from '@/app/actions/unsubscribe-actions';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Calendar, Sparkles, CheckCircle2, ShieldCheck, Inbox, AlertTriangle } from 'lucide-react';
import type { OrgBranding } from '@/lib/types';

interface PreferenceFormProps {
  recipient: string;
  contactName?: string;
  entityId?: string;
  workspaceId?: string;
  workspaceName?: string;
  orgBranding?: OrgBranding | null;
  initialPreferences: {
    emailStatus: 'valid' | 'bounced' | 'unsubscribed' | 'complained' | 'snoozed' | 'opt-down';
    unsubscribedCategories: string[];
    snoozedUntil: string;
    optDownFrequency: 'weekly' | 'monthly' | 'default';
  };
}

export default function PreferenceForm({
  recipient,
  contactName,
  entityId,
  workspaceId,
  workspaceName,
  orgBranding,
  initialPreferences,
}: PreferenceFormProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Local state for checkboxes and selections
  const [emailStatus, setEmailStatus] = useState<typeof initialPreferences.emailStatus>(
    initialPreferences.emailStatus
  );
  const [optDownFrequency, setOptDownFrequency] = useState<typeof initialPreferences.optDownFrequency>(
    initialPreferences.optDownFrequency
  );
  
  // Available categories
  const categoriesList = [
    { id: 'reminders', label: 'Reminders & Alerts', desc: 'Confirmations, scheduling notices, and calendar events.' },
    { id: 'campaigns', label: 'Campaigns & Marketing', desc: 'Promotional updates, offers, and new program announcements.' },
    { id: 'surveys', label: 'Surveys & Feedback', desc: 'Feedback requests, questionnaires, and reviews.' },
    { id: 'announcements', label: 'General Announcements', desc: 'Company newsletters, major product updates, and circulars.' },
  ];

  // Initialize unsubscribed categories (active categories are checked, unsubscribed are unchecked)
  const [unsubscribedCategories, setUnsubscribedCategories] = useState<string[]>(
    initialPreferences.unsubscribedCategories || []
  );

  const handleCategoryToggle = (catId: string) => {
    setUnsubscribedCategories((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleSave = () => {
    setErrorMessage('');
    
    // Compute snooze date if snoozed is selected
    let snoozedUntil = '';
    if (emailStatus === 'snoozed') {
      const date = new Date();
      date.setDate(date.getDate() + 30); // 30 days default snooze
      snoozedUntil = date.toISOString();
    }

    startTransition(async () => {
      const result = await updatePreferencesAction(recipient, {
        emailStatus,
        unsubscribedCategories: emailStatus === 'unsubscribed' ? categoriesList.map(c => c.id) : unsubscribedCategories,
        snoozedUntil,
        optDownFrequency,
        entityId,
        workspaceId,
      });

      if (result.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage(result.error || 'Failed to update preferences. Please try again.');
      }
    });
  };

  const displayName = orgBranding?.name || workspaceName || 'SmartSapp';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-200">
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]" />
      
      {/* Decorative ambient blobs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-[var(--primary)]/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-[var(--secondary)]/10 rounded-full blur-[100px] pointer-events-none" />

      <AnimatePresence mode="wait">
        {status === 'success' ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-lg"
          >
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
              <div className="mx-auto w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 animate-pulse" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight mb-3">Preferences Updated</h1>
              <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
                We've successfully updated your email preferences for <b>{displayName}</b>. 
                Your settings are now active.
              </p>
              
              <div className="bg-slate-950/60 rounded-2xl p-5 border border-slate-800/80 text-left mb-8 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Summary of settings:</h4>
                {emailStatus === 'unsubscribed' && (
                  <div className="flex items-center gap-2 text-xs text-red-400 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    Unsubscribed from all marketing communications
                  </div>
                )}
                {emailStatus === 'snoozed' && (
                  <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Emails snoozed for 30 days (resume after {new Date(new Date().setDate(new Date().getDate() + 30)).toLocaleDateString()})
                  </div>
                )}
                {emailStatus === 'opt-down' && (
                  <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    Frequency restricted to: {optDownFrequency === 'weekly' ? 'Weekly Digests' : 'Monthly Summaries'}
                  </div>
                )}
                {['bounced', 'complained'].includes(emailStatus) && (
                  <div className="flex items-center gap-2 text-xs text-amber-500 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Delivery suspended due to: {emailStatus === 'bounced' ? 'hard bounce' : 'spam complaint'}
                  </div>
                )}
                {emailStatus === 'valid' && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Receiving standard communications
                    </div>
                    {unsubscribedCategories.length > 0 && (
                      <p className="text-[11px] text-slate-500 pl-3.5">
                        Opted-out categories: {unsubscribedCategories.map(c => categoriesList.find(cl => cl.id === c)?.label).join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-500 border-t border-slate-800/80 pt-6">
                You can close this tab or return to your inbox.
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xl"
          >
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
              
              {/* Header block */}
              <div className="mb-8">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="p-1.5 bg-[var(--primary)]/10 rounded-lg border border-[var(--primary)]/20">
                    <ShieldCheck className="w-4 h-4 text-[var(--primary)]" />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Secure Privacy Center</span>
                </div>
                <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight leading-none mb-2">
                  Email Preference Center
                </h1>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Manage how <b>{displayName}</b> sends communications to <b>{contactName || recipient}</b>.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3 items-center text-xs text-red-400 font-medium">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {errorMessage}
                </div>
              )}

              {['bounced', 'complained'].includes(emailStatus) && (
                <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3 items-start text-xs text-amber-300 font-medium animate-in fade-in slide-in-from-top-4 duration-300">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500 animate-pulse" />
                  <div>
                    <h4 className="font-bold text-amber-200 mb-1">
                      {emailStatus === 'bounced' 
                        ? 'Email Delivery Suspended (Bounced)' 
                        : 'Email Delivery Suspended (Complaint Filed)'}
                    </h4>
                    <p className="text-slate-400 leading-normal mb-3">
                      We detected a delivery issue ({emailStatus === 'bounced' 
                        ? 'recipient address hard bounced' 
                        : 'spam complaint filed'}) and have automatically paused marketing and non-essential communications. 
                    </p>
                    <button
                      type="button"
                      onClick={() => setEmailStatus('valid')}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold py-1.5 px-3 rounded-lg text-[10px] uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Reactivate & Receive Standard Emails
                    </button>
                  </div>
                </div>
              )}

              {/* Preferences Configurator */}
              <div className="space-y-6">
                
                {/* 1. Global Subscription Toggle */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                    Global Settings
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setEmailStatus(emailStatus === 'unsubscribed' ? 'valid' : 'unsubscribed')}
                      className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all relative overflow-hidden ${
                        emailStatus === 'unsubscribed'
                          ? 'border-red-500 bg-red-500/5'
                          : 'border-slate-850 bg-slate-900/30 hover:border-slate-800'
                      }`}
                    >
                      <span className={`p-1.5 rounded-lg ${emailStatus === 'unsubscribed' ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-500'}`}>
                        <Inbox className="w-4 h-4" />
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">Unsubscribe All</h4>
                        <p className="text-[10px] text-slate-400 leading-normal mt-1">
                          Opt-out of all newsletters and promotional announcements.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEmailStatus(emailStatus === 'snoozed' ? 'valid' : 'snoozed')}
                      className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all relative overflow-hidden ${
                        emailStatus === 'snoozed'
                          ? 'border-amber-500 bg-amber-500/5'
                          : 'border-slate-850 bg-slate-900/30 hover:border-slate-800'
                      }`}
                    >
                      <span className={`p-1.5 rounded-lg ${emailStatus === 'snoozed' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-500'}`}>
                        <Calendar className="w-4 h-4" />
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">Snooze for 30 days</h4>
                        <p className="text-[10px] text-slate-400 leading-normal mt-1">
                          Pause marketing emails for 30 days. Resumes automatically.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 2. Frequency Control (Opt-down) */}
                <div className={`p-5 rounded-2xl border transition-all ${
                  emailStatus === 'opt-down' ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-slate-850 bg-slate-900/10'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="optDown"
                        checked={emailStatus === 'opt-down'}
                        onChange={(e) => setEmailStatus(e.target.checked ? 'opt-down' : 'valid')}
                        className="rounded border-slate-700 bg-slate-850 text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                      <label htmlFor="optDown" className="text-xs font-bold text-slate-200 cursor-pointer">
                        Limit email frequency (Opt Down)
                      </label>
                    </div>
                    {emailStatus === 'opt-down' && (
                      <span className="text-[9px] font-bold text-[var(--primary)] uppercase tracking-wider">Active</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed mb-4">
                    If you still want to hear from us but less often, we can aggregate our messages.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={emailStatus !== 'opt-down'}
                      onClick={() => setOptDownFrequency('weekly')}
                      className={`py-2 px-3 rounded-lg border text-[11px] font-bold transition-all ${
                        optDownFrequency === 'weekly' && emailStatus === 'opt-down'
                          ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                          : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200 disabled:opacity-45'
                      }`}
                    >
                      Weekly Digest
                    </button>
                    <button
                      type="button"
                      disabled={emailStatus !== 'opt-down'}
                      onClick={() => setOptDownFrequency('monthly')}
                      className={`py-2 px-3 rounded-lg border text-[11px] font-bold transition-all ${
                        optDownFrequency === 'monthly' && emailStatus === 'opt-down'
                          ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                          : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200 disabled:opacity-45'
                      }`}
                    >
                      Monthly Summary
                    </button>
                  </div>
                </div>

                {/* 3. Granular Category Options */}
                {emailStatus !== 'unsubscribed' && emailStatus !== 'snoozed' && (
                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                      Customise Email Categories
                    </label>
                    <div className="space-y-2.5">
                      {categoriesList.map((cat) => {
                        const isOptedOut = unsubscribedCategories.includes(cat.id);
                        return (
                          <div
                            key={cat.id}
                            onClick={() => handleCategoryToggle(cat.id)}
                            onKeyDown={(e) => {
                              if (e.key === ' ' || e.key === 'Enter') {
                                e.preventDefault();
                                handleCategoryToggle(cat.id);
                              }
                            }}
                            role="checkbox"
                            aria-checked={!isOptedOut}
                            tabIndex={0}
                            className={`flex items-start justify-between p-3.5 rounded-xl border cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 ${
                              isOptedOut
                                ? 'border-slate-850 bg-slate-900/10 text-slate-500'
                                : 'border-slate-850 bg-slate-900/30 text-slate-200 hover:border-slate-800'
                            }`}
                          >
                            <div className="pr-4">
                              <h5 className="text-[11px] font-bold tracking-tight">{cat.label}</h5>
                              <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">{cat.desc}</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={!isOptedOut}
                              onChange={() => {}} // Handle click on container instead
                              className="rounded border-slate-700 bg-slate-850 text-[var(--primary)] focus:ring-[var(--primary)] pointer-events-none mt-0.5"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Submitting button */}
                <div className="pt-4 border-t border-slate-800/80">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleSave}
                    className="w-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] hover:from-[var(--primary)] hover:to-[var(--secondary)]/90 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 text-xs tracking-wider uppercase flex items-center justify-center gap-2"
                  >
                    {isPending ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Saving Preferences...
                      </>
                    ) : (
                      'Save Preferences'
                    )}
                  </button>
                </div>

              </div>

              {/* Secure note */}
              <div className="flex items-center justify-center gap-3 text-[10px] text-slate-500 mt-6 pt-4 border-t border-slate-850">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> SSL Secured
                </span>
                <span>•</span>
                <span>Recipient: {recipient}</span>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
