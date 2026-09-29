/**
 * Reads RESEND_API_KEY defensively.
 *
 * A key pasted from a UTF-8-with-BOM file, a spreadsheet cell or a rich-text editor can
 * carry a leading U+FEFF (byte-order mark) or a zero-width space. Those characters are
 * illegal in an HTTP header value, so `fetch` throws "Cannot convert argument to a
 * ByteString because the character at index 7 has a value of 65279 which is greater
 * than 255" - index 7 being the first character after "Bearer " - and the request never
 * leaves the process. Every send then fails with no sign that the key is at fault.
 *
 * Stripping the invisible characters recovers the real key; anything still outside
 * printable ASCII means the value is genuinely corrupt and has to be re-pasted, so we
 * throw a message that says so instead of letting `fetch` raise an opaque TypeError.
 */
export function resendApiKey(
  env: Record<string, string | undefined> = process.env
): string {
  const raw = env.RESEND_API_KEY;
  if (!raw) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  // String.trim() removes U+FEFF at the ends but not in the middle, and zero-width
  // spaces are not whitespace at all - strip both wherever they appear.
  const key = raw.replace(/[\uFEFF\u200B-\u200D]/g, "").trim();

  if (!key) {
    throw new Error("RESEND_API_KEY is empty once invisible characters are stripped");
  }

  const offender = [...key].find((ch) => {
    const code = ch.charCodeAt(0);
    return code < 0x21 || code > 0x7e;
  });
  if (offender) {
    const hex = offender.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0");
    throw new Error(
      `RESEND_API_KEY contains a character that is illegal in an HTTP header (U+${hex}); re-paste the key as plain text in the Vercel environment settings`
    );
  }

  return key;
}
