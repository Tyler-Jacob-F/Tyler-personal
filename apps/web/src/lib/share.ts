/**
 * Getting a document off the site and into someone's hands: the share sheet when the
 * browser has one (with a PDF attached, or as text), the clipboard, a mail link, and a
 * download for a browser with no sheet. Nothing here knows what a recipe is; the route
 * renders the text and the PDF, this moves them.
 */

export interface Shareable {
  title: string;
  text: string;
}

/** True when the browser can open the system share sheet (phones, Safari and Chrome on a Mac, Chromium on Windows). */
export function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** A file the share sheet can carry, from bytes and a name. */
export function pdfFile(bytes: Uint8Array, filename: string): File {
  return new File([bytes as BlobPart], filename, { type: 'application/pdf' });
}

/** True when the sheet takes a file attachment, which is what puts a PDF into Messages or Messenger. */
export function canShareFiles(): boolean {
  if (!canShare() || typeof navigator.canShare !== 'function' || typeof File === 'undefined') {
    return false;
  }
  try {
    return navigator.canShare({ files: [pdfFile(new Uint8Array([0x25, 0x50]), 'probe.pdf')] });
  } catch {
    return false;
  }
}

/** Open the share sheet with a file attached. False when the person dismissed the sheet. */
export async function shareFile(file: File, title: string): Promise<boolean> {
  try {
    await navigator.share({ title, files: [file] });
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return false;
    throw error;
  }
}

/** Save a file through the browser's download path, for a browser with no share sheet. */
export function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Open the share sheet with the text. Resolves false when the browser has no sheet or the
 * person dismissed it, which is not an error worth showing.
 */
export async function shareText(payload: Shareable): Promise<boolean> {
  if (!canShare()) return false;
  try {
    await navigator.share({ title: payload.title, text: payload.text });
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return false;
    throw error;
  }
}

/** Put the text on the clipboard; false when the browser refuses (no permission, insecure origin). */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * A `mailto:` link with the text as the body, no recipient: the mail app opens with the
 * recipe written and the To field waiting. RFC 6068 wants CRLF line breaks in the body.
 */
export function mailto(subject: string, body: string): string {
  const crlf = body.replace(/\r?\n/g, '\r\n');
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(crlf)}`;
}

/**
 * Markdown as readable plain text for a message body: headings keep their words and lose
 * their hashes, emphasis loses its marks, links keep their text, lists stay lists.
 */
export function plainText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}[ \t]+(.*?)[ \t]*#*[ \t]*$/gm, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(?=\S)([\s\S]+?)(?<=\S)\1/g, '$2')
    .replace(/(?<![\w*])(\*|_)(?=\S)([^*_\n]+?)(?<=\S)\1(?![\w*])/g, '$2')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^>[ \t]?/gm, '')
    .replace(/^(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
