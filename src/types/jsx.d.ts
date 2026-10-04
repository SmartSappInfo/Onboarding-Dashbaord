import type * as React from 'react';

/**
 * @fileOverview Global JSX Intrinsic Elements declaration for untrusted reference data container (Rule 13 & 30)
 */

declare global {
  namespace JSX {
    interface IntrinsicElements {
      untrusted_reference_data: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { id?: string },
        HTMLElement
      >;
    }
  }
}
