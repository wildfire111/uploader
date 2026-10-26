import type { PdfPage } from "./melee";

// Reads a PDF in the browser into text runs with positions. pdf.js is big, so it is loaded only
// when someone picks a file, and the file never leaves the browser.
export async function extractPdfPages(file: File): Promise<PdfPage[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data }).promise;
  const pages: PdfPage[] = [];
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);
    const [left, , right] = page.view;
    const content = await page.getTextContent();
    pages.push({
      width: right - left,
      items: content.items.flatMap((item) =>
        "str" in item
          ? [{ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width }]
          : []
      ),
    });
  }
  return pages;
}
