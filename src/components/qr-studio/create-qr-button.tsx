'use client';

import * as React from 'react';
import { QrCode, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UnifiedQRSheet from '@/components/qr-studio/unified-qr-sheet';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/firebase';
import type { QRCodeType } from '@/lib/types';

interface CreateQRButtonProps {
  resourceType: QRCodeType;
  resourceId: string;
  resourceName: string;
  destinationUrl: string;
  variant?: 'button' | 'icon' | 'compact';
}

/**
 * Reusable "Create QR Code" button that launches the advanced UnifiedQRSheet
 * for embedding in share/publish panels across surveys, forms, landing pages, etc.
 */
export default function CreateQRButton({
  resourceType,
  resourceName,
  destinationUrl,
  variant = 'button',
}: CreateQRButtonProps) {
  const { activeOrganizationId, activeWorkspaceId } = useTenant();
  const { user } = useUser();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {variant === 'icon' ? (
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} title="Create QR Code">
          <QrCode className="h-4 w-4" />
        </Button>
      ) : variant === 'compact' ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
          <QrCode className="h-3.5 w-3.5" />
          <span>QR</span>
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)} className="w-full gap-2 rounded-xl">
          <Plus className="h-4 w-4" />
          Create QR Code
        </Button>
      )}

      {open && user && (
        <UnifiedQRSheet
          open={open}
          onOpenChange={setOpen}
          url={destinationUrl}
          resourceName={resourceName}
          resourceType={resourceType}
          workspaceId={activeWorkspaceId || ''}
          organizationId={activeOrganizationId || ''}
          currentUser={{
            userId: user.uid,
            name: user.displayName || '',
            email: user.email || '',
          }}
        />
      )}
    </>
  );
}
