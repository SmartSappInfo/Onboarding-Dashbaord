import QRStudioClient from '@/app/admin/qr-studio/QRStudioClient';

export const metadata = {
  title: 'QR Studio | SmartSapp',
  description: 'Create branded, trackable QR codes for your SmartSapp links and external destinations.',
};

export default function QRStudioPage() {
  return <QRStudioClient />;
}
