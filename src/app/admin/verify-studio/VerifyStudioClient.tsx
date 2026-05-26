'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, AlertCircle, CheckCircle2, Terminal, 
  Search, FileSpreadsheet, XCircle, Activity, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { VerifyEmailResult } from '@/lib/email-verifier';
import { PageContainer } from '@/components/ui/page-container';

export default function VerifyStudioClient() {
  const [email, setEmail] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerifyEmailResult | null>(null);
  const [activeTab, setActiveTab] = useState<'sandbox' | 'bulk' | 'database'>('sandbox');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(0);

  const addLog = (msg: string) => setTerminalLogs(prev => [...prev, msg]);

  const handleVerify = async () => {
    if (!email) return;

    setIsVerifying(true);
    setResult(null);
    setTerminalLogs([]);
    setCurrentStep(1);
    addLog('> Initializing verification for: ' + email);

    // Step 1: show syntax phase
    await new Promise(r => setTimeout(r, 400));
    addLog('> [SYNTAX] Validating RFC format...');
    setCurrentStep(2);

    await new Promise(r => setTimeout(r, 400));
    addLog('> [DISPOSABLE] Cross-referencing burner domains registry...');
    setCurrentStep(3);

    await new Promise(r => setTimeout(r, 400));
    addLog('> [DNS] Looking up MX Exchange records...');
    setCurrentStep(4);

    addLog('> [SMTP] Opening TCP socket to MX host (port 25)...');

    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data: VerifyEmailResult & { error?: string } = await res.json();

      if (data.error) {
        addLog(`> [ERROR] ${data.error}`);
      } else {
        // Show real DNS MX info if available
        const dnsDetail = (data.details as any)?.dns;
        if (dnsDetail?.primaryMx) {
          addLog(`> [DNS] Primary MX: ${dnsDetail.primaryMx}`);
        }
        if (!data.checks.dns) {
          addLog('> [DNS] No MX records found — domain cannot receive email.');
        }

        // Show real SMTP logs from the engine
        const smtpLogs: string[] = (data.details as any)?.smtp?.logs ?? [];
        smtpLogs.forEach(line => addLog(`> ${line}`));

        // Catch-all note
        if (data.checks.catchAll) {
          addLog('> [SMTP] Domain is a catch-all — accepts any address (RISKY).');
        }

        if ((data.details as any)?.smtp?.uncertain) {
          addLog('> [SMTP] Connection inconclusive (firewall/timeout) — treating as likely valid.');
        }

        addLog(`> [DONE] Verification complete. Status: ${data.status.replace('_', ' ').toUpperCase()}`);
        setResult(data);
        setCurrentStep(5);
      }
    } catch (err) {
      addLog('> [CRITICAL] Network error executing verification.');
    } finally {
      setIsVerifying(false);
    }
  };

  const ScoreGauge = ({ score }: { score: number }) => {
    const color = score >= 90 ? 'stroke-emerald-500 dark:stroke-emerald-400' : score >= 70 ? 'stroke-blue-500 dark:stroke-blue-400' : score >= 40 ? 'stroke-amber-500 dark:stroke-amber-400' : 'stroke-rose-500';
    const circumference = 2 * Math.PI * 45; // r=45
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/60" />
          <motion.circle 
            cx="50" cy="50" r="45" fill="none" strokeWidth="8"
            className={color}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-3xl font-black text-foreground">{score}</span>
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Score</span>
        </div>
      </div>
    );
  };

  const StepItem = ({ stepNumber, label, isActive, isDone, passed }: any) => (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${isActive ? 'bg-muted/80 border-border shadow-sm' : 'bg-transparent border-transparent opacity-50'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDone ? (passed ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400') : isActive ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-muted text-muted-foreground'}`}>
            {isDone ? (passed ? <CheckCircle2 size={16} /> : <XCircle size={16} />) : isActive ? <Loader2 size={16} className="animate-spin" /> : <span className="text-xs font-bold">{stepNumber}</span>}
        </div>
        <span className={`text-sm font-bold ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
    </div>
  );

  return (
    <PageContainer>
    <div className="space-y-8 pb-32 w-full font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold mb-4 tracking-wide">
            <ShieldCheck size={14} /> NEW FEATURE
          </div>
          <h1 className="text-4xl font-black tracking-tight text-foreground mb-2">Verify Studio</h1>
          <p className="text-muted-foreground max-w-2xl text-lg">
            High-performance native email verification. Protect your sender reputation by diagnosing syntax, DNS, burners, and live mailboxes.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-muted/80 rounded-xl w-fit border border-border mb-8 backdrop-blur-sm">
        {[
            { id: 'sandbox', icon: Search, label: 'Sandbox Diagnostics' },
            { id: 'bulk', icon: FileSpreadsheet, label: 'Bulk List Processor' },
            { id: 'database', icon: Activity, label: 'Burner Database' },
        ].map(t => (
            <button 
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === t.id ? 'bg-background text-foreground border shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'}`}
            >
                <t.icon size={16} /> {t.label}
            </button>
        ))}
      </div>

      {/* Sandbox Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'sandbox' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Input & Stepper (Left) */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <Card className="bg-card border-border shadow-md overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                <CardHeader>
                  <CardTitle className="text-foreground text-lg font-bold">Single Email Target</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={(e) => { e.preventDefault(); handleVerify(); }} className="flex flex-col gap-4">
                    <Input 
                      placeholder="e.g. j.doe@corporate.com" 
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="bg-background border-input h-12 text-lg text-foreground placeholder:text-muted-foreground focus-visible:ring-indigo-500"
                    />
                    <Button 
                      type="submit" 
                      disabled={!email || isVerifying}
                      className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base"
                    >
                      {isVerifying ? <Loader2 className="animate-spin mr-2" /> : <Search className="mr-2" size={18} />}
                      {isVerifying ? 'Probing...' : 'Verify Now'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Stepper Display */}
              <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-4 flex flex-col gap-1">
                    <StepItem stepNumber={1} label="Syntax & RFC Compliance" isActive={currentStep >= 1} isDone={currentStep > 1} passed={result ? result.checks.syntax : true} />
                    <StepItem stepNumber={2} label="Disposable Database Filter" isActive={currentStep >= 2} isDone={currentStep > 2} passed={result ? !result.checks.disposable : true} />
                    <StepItem stepNumber={3} label="DNS MX Exchanger Lookup" isActive={currentStep >= 3} isDone={currentStep > 3} passed={result ? result.checks.dns : true} />
                    <StepItem stepNumber={4} label="SMTP Live Mailbox Probe" isActive={currentStep >= 4} isDone={currentStep > 4} passed={result ? result.checks.smtp : true} />
                </CardContent>
              </Card>
            </div>

            {/* Results & Terminal (Right) */}
            <div className="lg:col-span-8 flex flex-col gap-6">
                
                {/* Result Card */}
                {result && (
                  <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                      <Card className="bg-card border-border overflow-hidden relative shadow-md">
                        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none text-foreground">
                            <ShieldCheck size={120} />
                        </div>
                        <CardContent className="p-8 flex items-center gap-8">
                            <ScoreGauge score={result.score} />
                            <div className="flex flex-col gap-2 z-10">
                                <h3 className="text-sm font-semibold text-muted-foreground tracking-wider uppercase">Verification Status</h3>
                                <div className="flex items-center gap-3">
                                    <span className={`text-4xl font-black capitalize ${result.status === 'verified' ? 'text-emerald-600 dark:text-emerald-400' : result.status === 'likely_valid' ? 'text-blue-600 dark:text-blue-400' : result.status === 'risky' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-500'}`}>
                                        {result.status.replace('_', ' ')}
                                    </span>
                                    {result.status === 'verified' && <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={32} />}
                                    {result.status === 'risky' && <AlertCircle className="text-amber-600 dark:text-amber-400" size={32} />}
                                    {result.status === 'invalid' && <XCircle className="text-rose-600 dark:text-rose-500" size={32} />}
                                </div>
                                <p className="text-muted-foreground mt-2 text-lg">
                                    {result.status === 'verified' ? "This email is highly safe to send to. Mailbox exists and is active." : 
                                     result.status === 'likely_valid' ? "Email passes basic checks but cannot be fully confirmed by SMTP." :
                                     result.status === 'risky' ? "Warning: This address is risky (Catch-all or Disposable). Sending may harm reputation." : 
                                     "Do not send. This email address is invalid or non-existent."}
                                </p>
                            </div>
                        </CardContent>
                      </Card>
                  </motion.div>
                )}

                {/* Simulated Terminal */}
                <Card className="bg-[#0b0c10] border-border dark:border-slate-800 flex-1 min-h-[300px] overflow-hidden flex flex-col shadow-inner font-mono text-slate-300">
                    <div className="flex items-center gap-2 px-4 py-2 bg-black/20 border-b border-border dark:border-slate-800">
                        <Terminal size={14} className="text-slate-500" />
                        <span className="text-xs font-semibold text-slate-500">SMTP Handshake Simulation</span>
                    </div>
                    <div className="p-4 overflow-y-auto flex-1 text-sm space-y-1">
                        {terminalLogs.length === 0 ? (
                            <span className="text-slate-600">Waiting for input...</span>
                        ) : (
                            terminalLogs.map((log, i) => (
                                <motion.div 
                                    initial={{ opacity: 0, x: -10 }} 
                                    animate={{ opacity: 1, x: 0 }} 
                                    key={i} 
                                    className={`${log.includes('[ERROR]') || log.includes('[CRITICAL]') ? 'text-rose-400' : log.includes('<-') ? 'text-emerald-400' : log.includes('->') ? 'text-indigo-400' : 'text-slate-400'}`}
                                >
                                    {log}
                                </motion.div>
                            ))
                        )}
                        {isVerifying && (
                            <motion.div animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-2 h-4 bg-slate-400 inline-block align-middle ml-1" />
                        )}
                    </div>
                </Card>

            </div>
          </motion.div>
        )}

        {/* Placeholder Tabs */}
        {activeTab !== 'sandbox' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center p-20 text-center border border-dashed border-border rounded-2xl bg-muted/30">
                <ShieldCheck size={48} className="text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-foreground mb-2">Module Under Construction</h3>
                <p className="text-muted-foreground max-w-md">The {activeTab === 'bulk' ? 'Bulk List Processor' : 'Burner Database'} interface is currently rolling out in the next update. Please use the Sandbox Diagnostics for now.</p>
            </motion.div>
        )}

      </AnimatePresence>
    </div>
    </PageContainer>
  );
}
