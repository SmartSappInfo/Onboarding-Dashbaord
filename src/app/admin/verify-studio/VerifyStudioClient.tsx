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
    setCurrentStep(1); // Syntax
    addLog('> Initializing verification for: ' + email);
    
    // Simulate real-time stepping for the UI (WOW factor)
    await new Promise(r => setTimeout(r, 600));
    addLog('> [SYNTAX] Validating RFC format...');
    setCurrentStep(2); // Burner
    
    await new Promise(r => setTimeout(r, 600));
    addLog('> [DISPOSABLE] Cross-referencing burner domains registry...');
    setCurrentStep(3); // DNS
    
    await new Promise(r => setTimeout(r, 600));
    addLog('> [DNS] Looking up MX Exchange records...');
    setCurrentStep(4); // SMTP
    
    await new Promise(r => setTimeout(r, 800));
    addLog('> [SMTP] Opening TCP Socket to target Mail Exchanger (Port 25)...');
    addLog('> [SMTP] -> HELO smartsapp.com');
    addLog('> [SMTP] <- 250 OK');
    addLog('> [SMTP] -> MAIL FROM:<verify@smartsapp.com>');
    
    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data: VerifyEmailResult & { error?: string } = await res.json();
      
      if (data.error) {
        addLog(`> [ERROR] ${data.error}`);
      } else {
        addLog('> [SMTP] <- 250 OK');
        addLog(`> [SMTP] -> RCPT TO:<${email}>`);
        if (data.status === 'verified') {
            addLog('> [SMTP] <- 250 OK (Mailbox exists)');
        } else {
            addLog(`> [SMTP] <- 550 (Status: ${data.status})`);
        }
        addLog('> [DONE] Verification Complete.');
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
    const color = score >= 90 ? 'stroke-emerald-400' : score >= 70 ? 'stroke-blue-400' : score >= 40 ? 'stroke-amber-400' : 'stroke-rose-500';
    const circumference = 2 * Math.PI * 45; // r=45
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-800/50" />
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
          <span className="text-3xl font-black text-white">{score}</span>
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Score</span>
        </div>
      </div>
    );
  };

  const StepItem = ({ stepNumber, label, isActive, isDone, passed }: any) => (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${isActive ? 'bg-slate-800/80 border-slate-700 shadow-lg shadow-black/20' : 'bg-transparent border-transparent opacity-50'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDone ? (passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400') : isActive ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
            {isDone ? (passed ? <CheckCircle2 size={16} /> : <XCircle size={16} />) : isActive ? <Loader2 size={16} className="animate-spin" /> : <span className="text-xs font-bold">{stepNumber}</span>}
        </div>
        <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-slate-400'}`}>{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-slate-200 p-8 pt-20 max-w-7xl mx-auto font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4 tracking-wide">
            <ShieldCheck size={14} /> NEW FEATURE
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white mb-2">Verify Studio</h1>
          <p className="text-slate-400 max-w-2xl text-lg">
            High-performance native email verification. Protect your sender reputation by diagnosing syntax, DNS, burners, and live mailboxes.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-900/50 rounded-lg w-fit border border-slate-800 mb-8 backdrop-blur-sm">
        {[
            { id: 'sandbox', icon: Search, label: 'Sandbox Diagnostics' },
            { id: 'bulk', icon: FileSpreadsheet, label: 'Bulk List Processor' },
            { id: 'database', icon: Activity, label: 'Burner Database' },
        ].map(t => (
            <button 
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === t.id ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
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
              <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-md shadow-2xl overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                <CardHeader>
                  <CardTitle className="text-white text-lg">Single Email Target</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={(e) => { e.preventDefault(); handleVerify(); }} className="flex flex-col gap-4">
                    <Input 
                      placeholder="e.g. j.doe@corporate.com" 
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="bg-black/50 border-slate-800 h-12 text-lg text-white placeholder:text-slate-600 focus-visible:ring-indigo-500"
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
              <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-md">
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
                      <Card className="bg-slate-900/60 border-slate-700 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                            <ShieldCheck size={120} />
                        </div>
                        <CardContent className="p-8 flex items-center gap-8">
                            <ScoreGauge score={result.score} />
                            <div className="flex flex-col gap-2 z-10">
                                <h3 className="text-sm font-semibold text-slate-400 tracking-wider uppercase">Verification Status</h3>
                                <div className="flex items-center gap-3">
                                    <span className={`text-4xl font-black capitalize ${result.status === 'verified' ? 'text-emerald-400' : result.status === 'likely_valid' ? 'text-blue-400' : result.status === 'risky' ? 'text-amber-400' : 'text-rose-500'}`}>
                                        {result.status.replace('_', ' ')}
                                    </span>
                                    {result.status === 'verified' && <CheckCircle2 className="text-emerald-400" size={32} />}
                                    {result.status === 'risky' && <AlertCircle className="text-amber-400" size={32} />}
                                    {result.status === 'invalid' && <XCircle className="text-rose-500" size={32} />}
                                </div>
                                <p className="text-slate-300 mt-2 text-lg">
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
                <Card className="bg-[#0f111a] border-slate-800 flex-1 min-h-[300px] overflow-hidden flex flex-col shadow-inner font-mono">
                    <div className="flex items-center gap-2 px-4 py-2 bg-black/40 border-b border-slate-800">
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center p-20 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
                <ShieldCheck size={48} className="text-slate-700 mb-4" />
                <h3 className="text-xl font-bold text-slate-300 mb-2">Module Under Construction</h3>
                <p className="text-slate-500 max-w-md">The {activeTab === 'bulk' ? 'Bulk List Processor' : 'Burner Database'} interface is currently rolling out in the next update. Please use the Sandbox Diagnostics for now.</p>
            </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
