export type PdfExtractMeta = {
  pageCount: number;
  pagesWithText: number;
  totalChars: number;
  ratioPagesWithText: number;
};

/**
 * Fast path PDF text extraction using PDF.js (client-side).
 * - Intended for text-native PDFs (most EU tenders)
 * - Returns [PAGE N] blocks to preserve the existing evidence/page contract
 *
 * IMPORTANT:
 * - This must only run in the browser (do NOT import from server components).
 */
export async function extractPdfTextFast(file: File): Promise<{ text: string; meta: PdfExtractMeta }> {
  // Dynamic import keeps this out of the server bundle
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Worker for modern bundlers (Next + ESM)
  try {
	  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
	  "pdfjs-dist/legacy/build/pdf.worker.mjs",
	  import.meta.url
	).toString();
  } catch {
    // If this fails in some build configs, PDF.js will try fallback mechanisms.
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pageCount = Number(pdf.numPages || 0) || 0;

  const blocks: string[] = [];
  let pagesWithText = 0;
  let totalChars = 0;

  for (let pageNo = 1; pageNo <= pageCount; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();

    // Build line-ish text using hasEOL when available
    const parts: string[] = [];
    for (const it of content.items ?? []) {
      const str = String((it as any).str ?? "");
      if (!str) continue;

      parts.push(str);

      // Some PDF.js builds set hasEOL to hint newlines
      if ((it as any).hasEOL) parts.push("\n");
      else parts.push(" ");
    }

    const pageText = parts.join("").replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").trim();

    if (pageText.length >= 200) pagesWithText += 1;
    totalChars += pageText.length;

    blocks.push(`[PAGE ${pageNo}]\n${pageText}`);
  }

  const ratioPagesWithText = pageCount > 0 ? pagesWithText / pageCount : 0;

  return {
    text: blocks.join("\n\n").trim(),
    meta: { pageCount, pagesWithText, totalChars, ratioPagesWithText },
  };
}

/**
 * Deterministic quality gate:
 * - If it passes, we can start reasoning immediately.
 * - If it fails, let the backend OCR fallback run.
 */
export function fastExtractPasses(meta: PdfExtractMeta) {
  // Text-native tenders usually pass this easily.
  if (meta.pageCount <= 0) return false;

  // Strong signal: most pages contain real text and overall char budget is healthy.
  if (meta.ratioPagesWithText >= 0.6 && meta.totalChars >= 15_000) return true;

  // Classic scanned signal: almost no pages have text.
  if (meta.ratioPagesWithText <= 0.25 || meta.totalChars <= 5_000) return false;

  // Borderline: be conservative (fallback) to protect evidence quality.
  return false;
}
