import Link from 'next/link';
import Logo from './logo';
import { Button } from './ui/button';

const Header = () => {
  return (
    <header className="supports-[backdrop-filter]:bg-background/60 border-b-border/40 bg-background/95 py-4 px-4 backdrop-blur md:px-8">
      <div className="container mx-auto flex items-center justify-between">
        <Link href="/" aria-label="Back to homepage">
          <Logo />
        </Link>
        <Button asChild>
          <a href="https://smartsapp.com/contact-us" target="_blank" rel="noopener noreferrer">
            Contact Us
          </a>
        </Button>
      </div>
    </header>
  );
};

export default Header;
