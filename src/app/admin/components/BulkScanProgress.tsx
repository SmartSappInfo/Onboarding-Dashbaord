'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface Props {
  isScanning: boolean;
  total: number;
  processed: number;
  onCancel?: () => void;
}

export function BulkScanProgress({ isScanning, total, processed, onCancel }: Props) {
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <AnimatePresence>
      {isScanning && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 right-6 z-50 w-[400px]"
        >
          <div className="bg-slate-900 border border-slate-700 shadow-2xl shadow-black rounded-2xl overflow-hidden p-5 backdrop-blur-xl bg-opacity-95">
            
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <ShieldCheck className="text-indigo-400" size={20} />
                </div>
                <div>
                  <h4 className="text-slate-100 font-bold text-sm">Bulk Hygiene Scan Active</h4>
                  <p className="text-slate-400 text-xs mt-0.5">Sanitizing filtered list...</p>
                </div>
              </div>
              
              <div className="flex flex-col items-end">
                <span className="text-xl font-black text-white">{percentage}%</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{processed} / {total}</span>
              </div>
            </div>

            <Progress value={percentage} className="h-2 bg-slate-800" />

            <div className="mt-4 flex items-center justify-between text-xs text-slate-400 font-medium">
              <div className="flex items-center gap-1.5">
                {percentage === 100 ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Loader2 size={14} className="animate-spin text-indigo-400" />}
                {percentage === 100 ? 'Verification Complete' : 'Probing target servers...'}
              </div>
              
              {onCancel && percentage < 100 && (
                <button 
                  onClick={onCancel}
                  className="text-rose-400 hover:text-rose-300 hover:underline underline-offset-2 transition-all"
                >
                  Cancel Batch
                </button>
              )}
            </div>
            
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
