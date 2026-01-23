import type { SVGProps } from 'react';

const Logo = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 40" width="144" height="32" {...props}>
    <defs>
      <style>{`
        .logo-text {
          font-family: 'Poppins', sans-serif;
          font-weight: 700;
          font-size: 28px;
          fill: hsl(var(--primary));
        }
      `}</style>
    </defs>
    <g>
      <path
        fillRule="evenodd"
        d="M20 2a18 18 0 1 0 0 36a18 18 0 1 0 0-36zm-7.5 11.5L23 13.5l-2 6-10.5.5zM17 20.5l10.5.5-2 6-10.5-.5zM27 16a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3zM13 24a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z"
        clipRule="evenodd"
        fill="hsl(var(--primary))"
      />
    </g>
    <text x="45" y="29" className="logo-text">SmartSapp</text>
  </svg>
);

export default Logo;
