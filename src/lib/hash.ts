/** SHA-256 of a file's bytes, used to dedupe re-imports regardless of filename. */
export async function hashFile(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
