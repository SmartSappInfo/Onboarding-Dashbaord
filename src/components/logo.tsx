import type { SVGProps } from 'react';

const Logo = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 40" width="144" height="32" {...props}>
    <defs>
      <style>{`
        .logo-text {
          font-family: 'PT Sans', sans-serif;
          font-weight: 700;
          font-size: 28px;
          fill: hsl(var(--primary));
        }
      `}</style>
    </defs>
    <circle cx="20" cy="20" r="18" fill="hsl(var(--primary))" />
    <path d="M26 13C20.5 13 18 17.5 18 20s2.5 7 8 7m-12 0C16.5 27 14 22.5 14 20S16.5 13 22 13" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <text x="45" y="29" className="logo-text">SmartSapp</text>
  </svg>
);

export default Logo;
