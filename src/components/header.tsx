import Link from 'next/link';
import Logo from './logo';
import { Button } from './ui/button';
import { Phone } from 'lucide-react';

const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full bg-transparent py-4">
      <div className="container mx-auto">
        <div className="flex items-center justify-between rounded-full bg-card px-4 py-2 shadow-lg sm:px-6">
          <Link href="/" aria-label="Back to homepage">
            <Logo />
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            <a href="tel:+233501626873" className="hidden items-center gap-2 text-sm font-medium text-foreground hover:text-primary sm:flex">
              <Phone className="h-4 w-4 text-accent" />
              <span>
                Call/WhatsApp <span className="font-semibold text-accent">+233 50 162 6873</span>
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
