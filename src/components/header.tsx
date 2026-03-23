import Link from 'next/link';
import { SmartSappLogo as Logo } from '@/components/icons';
import { Button } from './ui/button';
import { Phone } from 'lucide-react';

const Header = () => {
  return (
    <header className="fixed top-0 z-50 w-full py-4">
      <div className="container px-6 sm:px-10">
        <div className="flex items-center justify-between rounded-full bg-black/20 backdrop-blur-sm border border-white/10 py-1 px-4">
          <Link href="/" aria-label="Back to homepage">
            <Logo className="h-8" />
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            <a
              href="tel:+233501626873"
              className="hidden items-center gap-2 text-sm font-medium text-gray-200 hover:text-white sm:flex"
            >
              <Phone className="h-4 w-4" />
              <span>
                Call/WhatsApp{' '}
                <span className="font-semibold text-white">+233 50 162 6873</span>
              </span>
            </a>
            <Button asChild>
              <a href="#download">Download App</a>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
