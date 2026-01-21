import { Copyright } from 'lucide-react';
import Logo from './logo';

const Footer = () => {
  return (
    <footer className="mt-16 bg-muted/40">
      <div className="container mx-auto px-4 py-8 md:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <Logo />
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Copyright className="h-4 w-4" /> {new Date().getFullYear()} SmartsApp. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
