export interface IframeResizePayload {
  type: 'iframe_resize';
  slug: string;
  height: number;
}

export type IframeMessagePayload = IframeResizePayload;

export function isIframeMessagePayload(data: unknown): data is IframeMessagePayload {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    obj.type === 'iframe_resize' &&
    typeof obj.slug === 'string' &&
    typeof obj.height === 'number'
  );
}
