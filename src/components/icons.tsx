
import type { SVGProps } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/SmartSapp%20Logo%20short.png?alt=media&token=046f95a8-b331-4129-a4ef-43ae7837eadd";

export const SmartSappLogo = ({ variant, className, ...props }: { variant?: 'primary' | 'white', className?: string } & React.HTMLAttributes<HTMLDivElement>) => {
  let imageClassName, textClassName;

  switch(variant) {
    case 'white':
      imageClassName = 'brightness-0 invert';
      textClassName = 'text-white';
      break;
    case 'primary':
      imageClassName = '';
      textClassName = 'text-primary';
      break;
    default: // No variant, so theme-dependent
      imageClassName = 'dark:brightness-0 dark:invert';
      textClassName = 'text-primary dark:text-white';
      break;
  }

  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      <div className="relative h-full aspect-square">
        <Image 
          src={logoUrl} 
          alt="SmartSapp Logo" 
          fill 
          sizes="(max-height: 32px) 32px, 10vw" 
          className={cn(imageClassName)}
        />
      </div>
      <span className={cn(
          "font-headline text-xl font-bold",
          textClassName
        )}>
        SmartSapp
      </span>
    </div>
  );
};

export const SmartSappIcon = ({ className, variant, ...props }: { className?: string, variant?: 'primary' | 'white' } & React.HTMLAttributes<HTMLDivElement>) => {
    let imageClassName;

    switch(variant) {
      case 'white':
        imageClassName = 'brightness-0 invert';
        break;
      case 'primary':
        imageClassName = '';
        break;
      default: // No variant, theme-dependent
        imageClassName = 'dark:brightness-0 dark:invert';
        break;
    }
    
    return (
        <div className={cn("relative h-full aspect-square", className)} {...props}>
            <Image src={logoUrl} alt="SmartSapp Icon" fill sizes="32px" className={cn(imageClassName)} />
        </div>
    )
};

const minexLogoUrl = "https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/minex-logo.svg?alt=media&token=c3683958-f57d-4bf0-b004-44823d5b75e8";

export const MinexLogo = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={cn("relative w-32 aspect-[3/1]", className)} {...props}>
        <Image 
            src={minexLogoUrl} 
            alt="Minex 360 Logo" 
            fill
            sizes="128px"
            className="object-contain"
        />
    </div>
  )
};

export const GoogleIcon = (props: SVGProps<SVGSVGElement>) => (
    <svg role="img" viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.05 1.05-2.86 2.25-5.08 2.25-4.49 0-8.16-3.6-8.16-8.1s3.67-8.1 8.16-8.1c2.51 0 4.22.98 5.17 1.89l2.62-2.61C18.44 1.56 15.98 0 12.48 0 5.88 0 0 5.88 0 12.48s5.88 12.48 12.48 12.48c7.34 0 12.07-4.89 12.07-12.07 0-.76-.08-1.51-.23-2.25h-11.83z"
      ></path>
    </svg>
);


export const GooglePlayIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 512 512" {...props}>
    <path fill="#4CAF50" d="M373.1,235.3l-133.5-77.1c-5.8-3.3-12.8,1.3-12.8,7.9v154.1c0,6.6,7,11.3,12.8,7.9l133.5-77.1C378.9,244.7,378.9,238.7,373.1,235.3z" />
    <path fill="#FFC107" d="M110.4,62.8L243.9,140l-37.1,37.1L110.4,62.8z" />
    <path fill="#F44336" d="M110.4,449.2l96.5-96.5l37.1,37.1L110.4,449.2z" />
    <path fill="#2196F3" d="M401.6,256L243.9,140l37.1,37.1l157.7,78.9L281,293.1l-37.1,37.1L401.6,256z" />
  </svg>
);

export const AppleAppStoreIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M19.1,7.2C18.2,6,16.9,5.2,15.5,5.2c-1.1,0-2.2,0.6-2.9,1.5c-0.7-0.9-1.8-1.5-2.9-1.5c-1.4,0-2.7,0.9-3.6,2.1C5,7.2,3.3,8.8,3.3,11.3c0,2.9,2.1,4.9,4.2,4.9c1,0,1.8-0.5,2.7-1.3c0.8,0.8,1.8,1.3,2.8,1.3c0.9,0,1.9-0.5,2.7-1.3c0.9,0.8,1.7,1.3,2.7,1.3c2.1,0,4.2-2,4.2-4.9C24.7,8.8,22.9,7.2,19.1,7.2z M12.5,4.2C13.2,3.4,14.3,3,15.5,3c0.5,0,1,0.2,1.5,0.5c-0.7,0.8-1.1,1.8-1.2,2.9c-0.8,0.1-1.6-0.2-2.1-0.8C13.2,5.2,12.8,4.7,12.5,4.2z M12,18.8c-1.6,0-3-0.8-4-2.1c-1.2,1.1-2.9,1.7-4.5,1.7c-0.1,0-0.2,0-0.3,0c0.3-1.4,0.7-2.7,1.5-3.8c1.3-1.8,3.2-2.8,5.2-2.8c0.8,0,1.6,0.2,2.3,0.6c0.5-0.8,1.4-1.3,2.3-1.3c0.1,0,0.2,0,0.3,0c-0.2,1.3-0.7,2.5-1.4,3.5C14.4,17.4,13.2,18.8,12,18.8z"/>
  </svg>
);

export const HuaweiAppGalleryIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...props}>
    <path fill="#CF0A2C" d="M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10s10-4.48,10-10S17.52,2,12,2z M8.96,16.14l-2.07-3.58l-2.07,3.58H2.5l4.14-7.17L2.5,1.8h2.32l2.07,3.58l2.07-3.58h2.32l-4.14,7.17l4.14,7.17H8.96z M19.18,10.65h-2.92v2.92h-1.75V10.65h-2.92V8.9h2.92V6.02h1.75V8.9h2.92V10.65z" />
  </svg>
);
