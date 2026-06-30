'use client';

import { CheckCircle2, FileText, ArrowRight, Download, Save, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';

interface CompressorStatsProps {
  fileName: string;
  originalSize: number;
  compressedSize: number;
  savingsPercentage: number;
  imagesOptimized: number;
  onDownload: () => void;
  onSaveToLibrary: () => void;
  onReset: () => void;
  isSavingToLibrary: boolean;
  librarySaved: boolean;
}

export function CompressorStats({
  fileName,
  originalSize,
  compressedSize,
  savingsPercentage,
  imagesOptimized,
  onDownload,
  onSaveToLibrary,
  onReset,
  isSavingToLibrary,
  librarySaved
}: CompressorStatsProps) {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const hasSavings = savingsPercentage > 0;

  return (
    <div className="w-full space-y-6">
      {/* Success banner */}
      <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-500">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <p className="text-xs font-bold tracking-tight">PDF Compression Successful</p>
      </div>

      {/* File Info */}
      <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-2xl shadow-sm">
        <div className="p-3 bg-muted/50 rounded-xl border border-border">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground truncate">{fileName}</p>
          <p className="text-xs text-muted-foreground">
            {imagesOptimized > 0
              ? `Optimized ${imagesOptimized} image${imagesOptimized === 1 ? '' : 's'} & cleaned structure`
              : 'Cleaned metadata, grouped streams and defragmented PDF'}
          </p>
        </div>
      </div>

      {/* Before & After Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Original */}
        <Card className="border border-border/80 shadow-sm bg-transparent rounded-2xl">
          <CardContent className="p-5 space-y-2 text-left">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Original Size</span>
            <div className="text-xl font-extrabold text-foreground">{formatBytes(originalSize)}</div>
          </CardContent>
        </Card>

        {/* Compressed */}
        <Card className="border border-border/80 shadow-sm bg-transparent rounded-2xl">
          <CardContent className="p-5 space-y-2 text-left">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Compressed Size</span>
            <div className="text-xl font-extrabold text-foreground">{formatBytes(compressedSize)}</div>
          </CardContent>
        </Card>

        {/* Savings */}
        <Card className="border border-primary/20 bg-primary/5 shadow-sm rounded-2xl">
          <CardContent className="p-5 space-y-2 text-left">
            <span className="text-[10px] uppercase font-bold tracking-wider text-primary">Saved Size</span>
            <div className="text-xl font-extrabold text-primary">
              {hasSavings ? `-${savingsPercentage.toFixed(1)}%` : '0% (Already Optimized)'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Row */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button
          onClick={onDownload}
          className="flex-1 h-12 rounded-xl font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-97 transition-all"
        >
          <Download className="mr-2 h-4 w-4" />
          Download Compressed PDF
        </Button>

        <Button
          onClick={onSaveToLibrary}
          disabled={isSavingToLibrary || librarySaved}
          variant="outline"
          className="flex-1 h-12 rounded-xl font-bold text-sm tracking-tight border-border/80 hover:bg-card active:scale-97 transition-all"
        >
          {isSavingToLibrary ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {librarySaved ? 'Saved to Workspace' : isSavingToLibrary ? 'Saving...' : 'Save to Media Hub'}
        </Button>

        <Button
          onClick={onReset}
          variant="ghost"
          className="h-12 rounded-xl font-bold text-sm tracking-tight hover:bg-muted/10 active:scale-97 transition-all shrink-0 px-6"
        >
          Compress Another
        </Button>
      </div>
    </div>
  );
}
