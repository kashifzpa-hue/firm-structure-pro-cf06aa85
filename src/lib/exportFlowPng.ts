import { toPng } from "html-to-image";

const EXCLUDED_SELECTORS = [
  ".react-flow__panel",
  ".react-flow__controls",
  ".react-flow__minimap",
  ".react-flow__attribution",
  "[data-radix-popper-content-wrapper]",
];

/**
 * Exports only the chart itself (nodes + edges) as a PNG, cropped to the node
 * bounds. UI chrome (dropdown overlay, minimap, controls, action buttons,
 * attribution) is excluded from the image.
 */
export async function exportFlowPng(
  container: HTMLElement | null,
  fileName: string,
  backgroundColor = "#F8FAFC",
) {
  if (!container) return;

  const viewportEl = container.querySelector(".react-flow__viewport") as HTMLElement | null;
  if (!viewportEl) return;

  const nodeEls = Array.from(viewportEl.querySelectorAll<HTMLElement>(
      ".react-flow__node, .react-flow__edgelabel-renderer *, .react-flow__edge-textwrapper",
    ));
  if (nodeEls.length === 0) return;

  // Nodes are positioned with CSS transforms, so measure on screen and convert
  // back into the untransformed viewport coordinate space using the current zoom.
  const zoom = new DOMMatrixReadOnly(getComputedStyle(viewportEl).transform).a || 1;
  const origin = viewportEl.getBoundingClientRect();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of nodeEls) {
    const r = el.getBoundingClientRect();
    const x = (r.left - origin.left) / zoom;
    const y = (r.top - origin.top) / zoom;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + r.width / zoom);
    maxY = Math.max(maxY, y + r.height / zoom);
  }

  const padding = 64;
  const width = Math.ceil(maxX - minX + padding * 2);
  const height = Math.ceil(maxY - minY + padding * 2);

  const dataUrl = await toPng(viewportEl, {
    backgroundColor,
    width,
    height,
    pixelRatio: width > 4000 || height > 4000 ? 1 : 2,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${padding - minX}px, ${padding - minY}px) scale(1)`,
    },
    filter: (node) => {
      if (!(node instanceof Element)) return true;
      return !EXCLUDED_SELECTORS.some((selector) => node.matches(selector));
    },
  });

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}
