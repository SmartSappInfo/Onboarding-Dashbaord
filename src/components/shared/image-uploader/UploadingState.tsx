import React from 'react';

interface UploadingStateProps {
  previewUrl?: string;
  progress: number;
  className?: string;
}

export function UploadingState({ previewUrl, progress, className }: UploadingStateProps) {
  return (
    <div className="w-full relative h-[220px] rounded-2xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center text-center">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="Uploading preview" className="absolute inset-0 w-full h-full object-cover z-0 blur-md opacity-30" />
      ) : null}
      
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <path className="text-slate-800" strokeWidth="2.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path className="text-emerald-500 transition-all duration-300" strokeDasharray={`${progress}, 100`} strokeWidth="2.5" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          </svg>
          <span className="text-[10px] font-black text-slate-200">{progress}%</span>
        </div>
        <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase animate-pulse">Uploading...</span>
      </div>
      
      <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-900/50">
        <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
