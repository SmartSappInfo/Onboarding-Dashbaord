import CreateQRWizard from '@/app/admin/qr-studio/components/create-qr-wizard';

export const metadata = {
  title: 'Create QR Code | QR Studio',
  description: 'Create a new branded QR code.',
};

export default function NewQRPage() {
  return <CreateQRWizard />;
}
