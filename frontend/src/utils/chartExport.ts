import axios from 'axios';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Renders one on-screen SVG chart to a PNG data URL.
 * The chart is cloned (so the page is untouched), given a white background and an explicit
 * font, serialised, drawn on a canvas at 2x resolution and exported as PNG.
 */
export const svgToPngDataUrl = async (svg: SVGSVGElement, scale = 2): Promise<string> => {
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', SVG_NS);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
  clone.setAttribute('font-family', 'Inter, Arial, Helvetica, sans-serif');

  const background = document.createElementNS(SVG_NS, 'rect');
  background.setAttribute('x', '0');
  background.setAttribute('y', '0');
  background.setAttribute('width', String(width));
  background.setAttribute('height', String(height));
  background.setAttribute('fill', '#ffffff');
  clone.insertBefore(background, clone.firstChild);

  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not render chart image.'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not supported in this browser.');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
};

/**
 * Captures every chart inside `root` that is marked with `data-report-chart`
 * (title taken from `data-title`). Charts that fail to render are skipped.
 */
export const captureCharts = async (root: HTMLElement | null): Promise<{ title: string; image: string }[]> => {
  if (!root) return [];
  // let any pending render settle
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

  const out: { title: string; image: string }[] = [];
  const holders = Array.from(root.querySelectorAll<HTMLElement>('[data-report-chart]'));
  for (const holder of holders) {
    const svg = holder.querySelector<SVGSVGElement>('svg.recharts-surface');
    if (!svg) continue;
    try {
      out.push({ title: holder.dataset.title || '', image: await svgToPngDataUrl(svg) });
    } catch {
      /* skip this chart, keep exporting the rest */
    }
  }
  return out;
};

/** Reads a human-readable error out of an axios error, including blob responses. */
export const readExportError = async (err: unknown): Promise<string> => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (data instanceof Blob) {
      try {
        const parsed = JSON.parse(await data.text());
        if (parsed?.message) return String(parsed.message);
      } catch { /* fall through */ }
    } else if (data && typeof data === 'object' && 'message' in data) {
      return String((data as { message: unknown }).message);
    }
    if (err.response?.status === 413) return 'The export was too large to send.';
  }
  return 'Export failed. Please try again.';
};

export const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
