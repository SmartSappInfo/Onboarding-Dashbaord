'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { getQRCode } from '@/lib/qr-actions';
import type { QRCode } from '@/lib/types';
import { QrCode } from 'lucide-react';

const QRPreview = dynamic(() => import('@/app/admin/qr-studio/components/qr-preview'), { ssr: false });

interface EmbeddedQRCodeProps {
  qrId: string;
  organizationId: string;
  workspaceId: string;
  isInModal?: boolean;
  onClose?: () => void;
}

export function EmbeddedQRCode({ qrId, organizationId, workspaceId, isInModal = false, onClose }: EmbeddedQRCodeProps) {
  const [qrCode, setQrCode] = useState<QRCode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!qrId || !organizationId || !workspaceId) return;

    let active = true;
    const fetchQR = async () => {
      try {
        const data = await getQRCode(organizationId, workspaceId, qrId);
        if (active && data) {
          setQrCode(data);
        }
      } catch (err) {
        console.error('Failed to load QR code design', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchQR();
    return () => {
      active = false;
    };
  }, [qrId, organizationId, workspaceId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider animate-pulse">Loading QR Code...</p>
      </div>
    );
  }

  if (!qrCode) {
    return (
      <div className="text-center p-8 text-destructive font-semibold">
        QR Code not found.
      </div>
    );
  }

  // Construct short path URL, falling back to redirectUrl if shortPath isn't defined
  const qrValue = qrCode.shortPath ? `${window.location.origin}/q/${qrCode.shortPath}` : (qrCode.redirectUrl || '');

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6 text-center">
      <div className="p-6 bg-white dark:bg-white rounded-[2rem] shadow-xl border border-slate-100 dark:border-zinc-800">
        <QRPreview data={qrValue} design={qrCode.design} size={240} />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">{qrCode.name || 'Scan Me'}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Scan the QR code with your phone camera.</p>
      </div>
    </div>
  );
}
