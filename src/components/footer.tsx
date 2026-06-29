'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { OrgBranding } from '@/lib/types';
import { SmartSappLogo, MinexLogo } from '@/components/icons';
import { Facebook, Twitter, Linkedin, Instagram, Youtube, Mail, Phone, MapPin, Globe } from 'lucide-react';
import { resolveCustomFooterHtml } from '@/lib/services/landing-footer-service';
import { cn } from '@/lib/utils';

export interface FooterProps {
  orgBranding?: OrgBranding | null;
  className?: string;
}

export default function Footer({ orgBranding, className }: FooterProps) {
  const [mounted, setMounted] = React.useState(false);
  
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const currentYear = mounted ? new Date().getFullYear().toString() : '2026';

  // If footer is explicitly disabled by the organization, don't render anything
  if (orgBranding && orgBranding.landingPageFooterEnabled === false) {
    return null;
  }

  const style = orgBranding?.landingPageFooterStyle || 'default';
  const logoUrl = orgBranding?.logoUrl;
  const orgName = orgBranding?.name || 'SmartSapp';
  const address = orgBranding?.address;
  const email = orgBranding?.email;
  const phone = orgBranding?.phone;
  const website = orgBranding?.website;
  const socials = orgBranding?.socialLinks || {};

  const brandColor = orgBranding?.brandPrimaryColor || '#3B5FFF';

  // Safe checks for active socials
  const hasSocials = !!(socials.facebook || socials.twitter || socials.linkedin || socials.instagram || socials.youtube);

  // Style A: Default (Dynamic version of the original multi-column footer)
  if (style === 'default') {
    return (
      <footer className={cn("bg-[#0A1427] text-white border-t border-border/10", className)}>
        <div className="container px-6 sm:px-10 py-16 mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 text-center lg:text-left">
            {/* Column 1: Brand & Logo */}
            <div className="space-y-4">
              <div className="flex items-center justify-center lg:justify-start space-x-2">
                {logoUrl ? (
                  <div className="relative h-10 w-32 shrink-0">
                    <Image
                      src={logoUrl}
                      alt={`${orgName} logo`}
                      fill
                      className="object-contain object-center lg:object-left"
                      unoptimized={logoUrl.startsWith('http')}
                    />
                  </div>
                ) : (
                  <SmartSappLogo className="h-7" variant="white" />
                )}
              </div>
              <p className="text-xs text-gray-400 font-medium">
                {orgBranding?.name ? `${orgName}` : 'SmartSapp by MineX 360 Services.'}
              </p>
            </div>

            {/* Column 2: Quick Links */}
            <div className="space-y-4">
              <h3 className="font-semibold text-white text-sm tracking-wider uppercase">Useful Links</h3>
              <nav className="flex flex-col space-y-2 text-xs">
                <Link href="/login" className="text-gray-400 hover:text-white transition-colors">Admin Portal</Link>
                {website ? (
                  <a href={website.startsWith('http') ? website : `https://${website}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                    Visit Website
                  </a>
                ) : (
                  <Link href="#" className="text-gray-400 hover:text-white transition-colors">Terms of Use</Link>
                )}
                <Link href="#" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</Link>
              </nav>
            </div>

            {/* Column 3: Contact details */}
            <div className="space-y-4 text-xs text-gray-400">
              <h3 className="font-semibold text-white text-sm tracking-wider uppercase">Contact Info</h3>
              <div className="flex flex-col space-y-3 items-center lg:items-start">
                {address && (
                  <div className="flex items-start gap-2 max-w-[240px]">
                    <MapPin size={14} className="text-primary shrink-0 mt-0.5" style={{ color: brandColor }} />
                    <span className="text-left leading-relaxed">{address}</span>
                  </div>
                )}
                {phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-primary shrink-0" style={{ color: brandColor }} />
                    <a href={`tel:${phone}`} className="hover:text-white transition-colors">{phone}</a>
                  </div>
                )}
                {email && (
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-primary shrink-0" style={{ color: brandColor }} />
                    <a href={`mailto:${email}`} className="hover:text-white transition-colors">{email}</a>
                  </div>
                )}
              </div>
            </div>

            {/* Column 4: Socials */}
            <div className="space-y-4">
              <h3 className="font-semibold text-white text-sm tracking-wider uppercase">Follow Us</h3>
              {hasSocials ? (
                <div className="flex items-center justify-center lg:justify-start gap-4">
                  {socials.facebook && (
                    <a href={socials.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-gray-400 hover:text-white transition-all hover:scale-105 active:scale-95 duration-200">
                      <Facebook size={18} />
                    </a>
                  )}
                  {socials.twitter && (
                    <a href={socials.twitter} target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="text-gray-400 hover:text-white transition-all hover:scale-105 active:scale-95 duration-200">
                      <Twitter size={18} />
                    </a>
                  )}
                  {socials.linkedin && (
                    <a href={socials.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-gray-400 hover:text-white transition-all hover:scale-105 active:scale-95 duration-200">
                      <Linkedin size={18} />
                    </a>
                  )}
                  {socials.instagram && (
                    <a href={socials.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-gray-400 hover:text-white transition-all hover:scale-105 active:scale-95 duration-200">
                      <Instagram size={18} />
                    </a>
                  )}
                  {socials.youtube && (
                    <a href={socials.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="text-gray-400 hover:text-white transition-all hover:scale-105 active:scale-95 duration-200">
                      <Youtube size={18} />
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center lg:justify-start gap-4">
                  <span className="text-gray-500 text-xs">No social handles linked</span>
                </div>
              )}
              
              {!orgBranding && (
                <div className="pt-4 border-t border-gray-800/40">
                  <MinexLogo className="h-7 mx-auto lg:mx-0 opacity-60" />
                </div>
              )}
            </div>
          </div>

          <div className="mt-16 text-center border-t border-gray-800/40 pt-8">
            <p className="text-xs text-gray-500">
              Copyright © {currentYear} {orgName}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    );
  }

  // Style B: Minimalist (Sleek row layout)
  if (style === 'minimalist') {
    return (
      <footer className={cn("bg-background border-t border-border/40 py-8 text-muted-foreground", className)}>
        <div className="container px-6 sm:px-10 mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <div className="relative h-7 w-20 shrink-0">
                <Image
                  src={logoUrl}
                  alt={`${orgName} logo`}
                  fill
                  className="object-contain"
                  unoptimized={logoUrl.startsWith('http')}
                />
              </div>
            ) : (
              <SmartSappLogo className="h-5" />
            )}
            <p className="text-xs font-semibold">
              © {currentYear} {orgName}
            </p>
          </div>

          {hasSocials && (
            <div className="flex items-center gap-4">
              {socials.facebook && (
                <a href={socials.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-foreground active:scale-95 transition-all">
                  <Facebook size={16} />
                </a>
              )}
              {socials.twitter && (
                <a href={socials.twitter} target="_blank" rel="noopener noreferrer" className="hover:text-foreground active:scale-95 transition-all">
                  <Twitter size={16} />
                </a>
              )}
              {socials.linkedin && (
                <a href={socials.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-foreground active:scale-95 transition-all">
                  <Linkedin size={16} />
                </a>
              )}
              {socials.instagram && (
                <a href={socials.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-foreground active:scale-95 transition-all">
                  <Instagram size={16} />
                </a>
              )}
              {socials.youtube && (
                <a href={socials.youtube} target="_blank" rel="noopener noreferrer" className="hover:text-foreground active:scale-95 transition-all">
                  <Youtube size={16} />
                </a>
              )}
            </div>
          )}
        </div>
      </footer>
    );
  }

  // Style C: Centered (Creative centered elements)
  if (style === 'centered') {
    return (
      <footer className={cn("bg-muted/10 border-t border-border/30 py-12 text-center text-muted-foreground", className)}>
        <div className="container px-6 sm:px-10 mx-auto space-y-6">
          <div className="flex justify-center">
            {logoUrl ? (
              <div className="relative h-10 w-28">
                <Image
                  src={logoUrl}
                  alt={`${orgName} logo`}
                  fill
                  className="object-contain"
                  unoptimized={logoUrl.startsWith('http')}
                />
              </div>
            ) : (
              <SmartSappLogo className="h-6" />
            )}
          </div>

          {/* Inline contact tags */}
          <div className="flex flex-wrap justify-center items-center gap-y-2 gap-x-6 text-xs font-semibold">
            {address && (
              <span className="flex items-center gap-1.5"><MapPin size={13} style={{ color: brandColor }} /> {address}</span>
            )}
            {phone && (
              <span className="flex items-center gap-1.5"><Phone size={13} style={{ color: brandColor }} /> <a href={`tel:${phone}`} className="hover:text-foreground transition-colors">{phone}</a></span>
            )}
            {email && (
              <span className="flex items-center gap-1.5"><Mail size={13} style={{ color: brandColor }} /> <a href={`mailto:${email}`} className="hover:text-foreground transition-colors">{email}</a></span>
            )}
            {website && (
              <span className="flex items-center gap-1.5"><Globe size={13} style={{ color: brandColor }} /> <a href={website.startsWith('http') ? website : `https://${website}`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Website</a></span>
            )}
          </div>

          {hasSocials && (
            <div className="flex justify-center items-center gap-5 pt-2">
              {socials.facebook && (
                <a href={socials.facebook} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground active:scale-90 transition-all">
                  <Facebook size={16} />
                </a>
              )}
              {socials.twitter && (
                <a href={socials.twitter} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground active:scale-90 transition-all">
                  <Twitter size={16} />
                </a>
              )}
              {socials.linkedin && (
                <a href={socials.linkedin} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground active:scale-90 transition-all">
                  <Linkedin size={16} />
                </a>
              )}
              {socials.instagram && (
                <a href={socials.instagram} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground active:scale-90 transition-all">
                  <Instagram size={16} />
                </a>
              )}
              {socials.youtube && (
                <a href={socials.youtube} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground active:scale-90 transition-all">
                  <Youtube size={16} />
                </a>
              )}
            </div>
          )}

          <div className="border-t border-border/30 pt-6">
            <p className="text-[11px] font-medium text-muted-foreground/60">
              © {currentYear} {orgName}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    );
  }

  // Style D: Custom HTML (Dynamic variables substitute + sanitization)
  if (style === 'custom' && orgBranding) {
    const customHtml = orgBranding.landingPageFooterCustomHtml || '';
    const resolvedHtml = resolveCustomFooterHtml(customHtml, orgBranding);
    
    return (
      <div 
        className={cn("w-full custom-landing-footer", className)}
        dangerouslySetInnerHTML={{ __html: resolvedHtml }} 
      />
    );
  }

  return null;
}
