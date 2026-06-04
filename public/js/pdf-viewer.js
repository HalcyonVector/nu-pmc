// public/js/pdf-viewer.js — 2D PDF viewer using PDF.js (CDN)
// View only — no markup, no annotation, no offline sync
// Loads compressed preview by default, full res on demand

const PDF_VIEWER = (() => {
  let pdfDoc    = null;
  let pageNum   = 1;
  let pageCount = 0;
  let scale     = 1.5;
  let rendering = false;

  function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="pdf-toolbar" role="toolbar" aria-label="PDF controls">
        <button class="btn-sm" id="pdf-prev" onclick="PDF_VIEWER.prevPage()" aria-label="Previous page">◀ Prev</button>
        <span id="pdf-page-info" style="padding:0 8px;font-size:var(--text-sm)">Page 1 of 1</span>
        <button class="btn-sm" id="pdf-next" onclick="PDF_VIEWER.nextPage()" aria-label="Next page">Next ▶</button>
        <button class="btn-sm" onclick="PDF_VIEWER.zoomIn()" aria-label="Zoom in">＋ Zoom</button>
        <button class="btn-sm" onclick="PDF_VIEWER.zoomOut()" aria-label="Zoom out">－ Zoom</button>
        <button class="btn-sm" id="pdf-fullres" onclick="PDF_VIEWER.loadFullRes()" style="display:none" aria-label="Load full resolution">
          Full res
        </button>
      </div>
      <div id="pdf-canvas-container" style="overflow:auto;max-height:75vh;text-align:center;touch-action:pinch-zoom;">
        <canvas id="pdf-canvas"></canvas>
      </div>
      <div id="pdf-loading" style="display:none;text-align:center;padding:20px;">
        Loading drawing...
      </div>
    `;
  }

  async function loadURL(url, isCompressed) {
    const loading = document.getElementById('pdf-loading');
    const canvas  = document.getElementById('pdf-canvas');
    if (loading) loading.style.display = 'block';
    if (canvas)  canvas.style.display  = 'none';

    try {
      const pdfjsLib = window['pdfjs-dist/build/pdf'];
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      pdfDoc = await pdfjsLib.getDocument({ url, withCredentials: true }).promise;
      pageCount = pdfDoc.numPages;
      pageNum   = 1;

      if (loading) loading.style.display = 'none';
      if (canvas)  canvas.style.display  = 'block';

      if (isCompressed) {
        const btn = document.getElementById('pdf-fullres');
        if (btn) btn.style.display = 'inline';
      }

      renderPage(pageNum);
    } catch (e) {
      if (loading) loading.innerHTML = 'Failed to load drawing. ' + e.message;
    }
  }

  async function renderPage(num) {
    if (rendering || !pdfDoc) return;
    rendering = true;

    const page   = await pdfDoc.getPage(num);
    const canvas = document.getElementById('pdf-canvas');
    if (!canvas) { rendering = false; return; }

    const viewport = page.getViewport({ scale });
    canvas.height  = viewport.height;
    canvas.width   = viewport.width;

    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    rendering = false;

    const info = document.getElementById('pdf-page-info');
    if (info) info.textContent = `Page ${num} of ${pageCount}`;
  }

  return {
    init,
    loadURL,
    prevPage() {
      if (pageNum <= 1) return;
      pageNum--;
      renderPage(pageNum);
    },
    nextPage() {
      if (pageNum >= pageCount) return;
      pageNum++;
      renderPage(pageNum);
    },
    zoomIn()  { scale = Math.min(scale + 0.25, 4.0); renderPage(pageNum); },
    zoomOut() { scale = Math.max(scale - 0.25, 0.5); renderPage(pageNum); },
    loadFullRes() {
      const current = window._currentDrawingFullPath;
      if (current) loadURL(window.API?.fileUrl ? API.fileUrl(current, 'drawings') : current, false);
    },
  };
})();
