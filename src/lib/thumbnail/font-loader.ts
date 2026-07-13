export class FontLoader {
  private static loadedFonts = new Set<string>();

  public static async loadFont(family: string): Promise<boolean> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false;
    }

    if (this.loadedFonts.has(family)) {
      return true;
    }

    try {
      const linkId = `gfont-${family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      
      // Inject stylesheet if not already added to document head
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@400;700;900&display=swap`;
        document.head.appendChild(link);
      }

      // Check if fonts load matches browser support
      if (document.fonts && typeof document.fonts.load === 'function') {
        await document.fonts.load(`1em "${family}"`);
      }

      this.loadedFonts.add(family);
      return true;
    } catch (e) {
      console.warn(`[FontLoader] Failed to pre-load Google Font: "${family}"`, e);
      return false;
    }
  }

  public static isFontLoaded(family: string): boolean {
    return this.loadedFonts.has(family);
  }

  public static clearCache(): void {
    this.loadedFonts.clear();
  }
}
