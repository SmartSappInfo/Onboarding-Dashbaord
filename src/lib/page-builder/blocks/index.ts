/**
 * Importing this module registers every block definition (each block file calls
 * `registerBlock` at module scope). Import it once, high in the tree, before
 * rendering through the registry. Add new blocks here to make them available to
 * both the editor and the published page.
 */
import './hero';
import './text';
import './cta';
import './image';

/** No-op marker to make the side-effect import explicit at call sites. */
export function registerAllBlocks(): void {
  // Registration happens via the imports above; this exists so callers can
  // reference a value and guarantee the module is included in the bundle.
}
