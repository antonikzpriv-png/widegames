/** Validate setup without echoing a possibly credential-bearing input. */
export function validatePublicOrigin(value) {
  const invalid = reason => {
    throw new Error(`PUBLIC_ORIGIN ${reason}. Use an origin such as http://localhost:3000 or https://game.example.`);
  };
  if (typeof value !== 'string' || !value || /[\u0000-\u0020\u007f\\]/u.test(value)) {
    invalid('must be an absolute HTTP(S) origin without whitespace or backslashes');
  }
  if (!/^https?:\/\//i.test(value)) invalid('must use http:// or https://');
  const parts = /^https?:\/\/([^/?#]*)([^?#]*)/i.exec(value);
  if (parts[1].includes('@')) invalid('must not include credentials or userinfo');
  if (value.includes('?')) invalid('must not include a query');
  if (value.includes('#')) invalid('must not include a fragment');
  // Check the supplied path before URL can normalize away dot segments.
  if (parts[2] !== '' && parts[2] !== '/') invalid('must not include a path beyond /');
  let parsed;
  try { parsed = new URL(value); } catch { invalid('must contain a valid HTTP(S) host and port'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.origin === 'null') {
    invalid('must contain a valid HTTP(S) host and port');
  }
  return parsed.origin;
}
