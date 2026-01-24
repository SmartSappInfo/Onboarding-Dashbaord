import Link from "next/link";
import { SmartSappLogo, MinexLogo } from "@/components/icons";
import { Facebook, Twitter, Linkedin, Instagram, Youtube } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#0A1427] text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Column 1: SmartSapp */}
          <div className="space-y-4">
            <Link href="https://www.smartsapp.com" className="flex items-center space-x-2">
              <SmartSappLogo className="h-7" variant="white" />
            </Link>
            <p className="text-sm text-gray-400">
              SmartSapp by MineX 360 Services.
            </p>
          </div>

          {/* Column 2: MineX */}
          <div className="space-y-4">
            <MinexLogo className="h-10" />
            <nav className="flex flex-col space-y-2 text-sm">
                <Link href="#" className="text-gray-400 hover:text-white transition-colors">About the company</Link>
                <Link href="#" className="text-gray-400 hover:text-white transition-colors">Contact MineX</Link>
            </nav>
          </div>

          {/* Column 3: Useful Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-white">Useful Links</h3>
            <nav className="flex flex-col space-y-2 text-sm">
                <Link href="/admin" className="text-gray-400 hover:text-white transition-colors">Admin</Link>
                <Link href="#" className="text-gray-400 hover:text-white transition-colors">Contact Us</Link>
                <Link href="#" className="text-gray-400 hover:text-white transition-colors">Terms of Use</Link>
                <Link href="#" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</Link>
            </nav>
          </div>

          {/* Column 4: Follow Us */}
          <div className="space-y-4">
             <h3 className="font-semibold text-white">Follow Us</h3>
             <div className="flex items-center gap-4">
                <Link href="#" aria-label="Facebook" className="text-gray-400 hover:text-white transition-colors"><Facebook size={20} /></Link>
                <Link href="#" aria-label="Twitter" className="text-gray-400 hover:text-white transition-colors"><Twitter size={20} /></Link>
                <Link href="#" aria-label="LinkedIn" className="text-gray-400 hover:text-white transition-colors"><Linkedin size={20} /></Link>
                <Link href="#" aria-label="Instagram" className="text-gray-400 hover:text-white transition-colors"><Instagram size={20} /></Link>
                <Link href="#" aria-label="YouTube" className="text-gray-400 hover:text-white transition-colors"><Youtube size={20} /></Link>
             </div>
             <div className="text-sm space-y-2 pt-4">
                <p><a href="mailto:contact@smartsapp.com" className="text-gray-400 hover:text-white transition-colors">Email: contact@smartsapp.com</a></p>
                <p><a href="tel:+233501608002" className="text-gray-400 hover:text-white transition-colors">Phone: +233 501 608 002</a></p>
             </div>
          </div>
        </div>

        <div className="mt-16 text-center border-t border-gray-800 pt-8">
            <p className="text-sm text-gray-500">
                Copyright © 2026 SmartSapp.
            </p>
        </div>
      </div>
    </footer>
  );
}
