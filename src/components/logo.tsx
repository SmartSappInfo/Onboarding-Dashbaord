import type { SVGProps } from 'react';

const Logo = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50" width="150" height="37.5" {...props}>
    <style>
      {`.smart-text { font-family: Playfair, serif; font-weight: 700; font-size: 38px; fill: hsl(var(--primary)); }
      .sapp-text { font-family: 'PT Sans', sans-serif; font-weight: 700; font-size: 38px; fill: hsl(var(--accent)); }`}
    </style>
    <text x="0" y="38" className="smart-text">
      Smarts
    </text>
    <text x="110" y="38" className="sapp-text">
      App
    </text>
  </svg>
);

export default Logo;
