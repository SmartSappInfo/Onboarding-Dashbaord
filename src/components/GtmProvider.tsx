'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const GTM_ID = 'GTM-TK8KJZPG';
const BOOTSTRAP_SCRIPT_ID = 'gtm-bootstrap-inline';
const NOSCRIPT_CONTAINER_ID = 'gtm-noscript-root';

/**
 * Injects Google Tag Manager without rendering <script> in the React tree.
 * React 19 warns when `<script>` / `next/script` children are reconciled in certain client
 * trees; DOM injection after mount avoids that and preserves GTM behavior.
 */
export function GtmProvider() {
  const pathname = usePathname();
  const injectedPathRef = useRef<string | null>(null);

  useEffect(() => {
    const skip =
      pathname.startsWith('/admin') ||
      pathname.startsWith('/forms') ||
      pathname.startsWith('/surveys');

    const removeGtm = () => {
      document.getElementById(BOOTSTRAP_SCRIPT_ID)?.remove();
      document.getElementById(NOSCRIPT_CONTAINER_ID)?.remove();
      injectedPathRef.current = null;
    };

    if (skip) {
      removeGtm();
      return;
    }

    if (injectedPathRef.current === pathname && document.getElementById(BOOTSTRAP_SCRIPT_ID)) {
      return;
    }

    removeGtm();

    const inline = document.createElement('script');
    inline.id = BOOTSTRAP_SCRIPT_ID;
    inline.text = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0], j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src= 'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f); })(window,document,'script','dataLayer','${GTM_ID}');`;
    document.head.appendChild(inline);

    const noscript = document.createElement('noscript');
    noscript.id = NOSCRIPT_CONTAINER_ID;
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.googletagmanager.com/ns.html?id=${GTM_ID}`;
    iframe.height = '0';
    iframe.width = '0';
    iframe.title = 'Google Tag Manager';
    iframe.style.display = 'none';
    iframe.style.visibility = 'hidden';
    noscript.appendChild(iframe);
    document.body.insertBefore(noscript, document.body.firstChild);

    injectedPathRef.current = pathname;

    return () => {
      removeGtm();
    };
  }, [pathname]);

  return null;
}
