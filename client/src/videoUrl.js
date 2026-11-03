// Demo links are shown as clickable links to clients, so only plain
// http/https web links are ever treated as links. A bare "youtu.be/abc" or
// "www.youtube.com/..." gets https:// added for convenience; anything else
// (javascript:, free text with spaces, etc.) is rejected.
export function normalizeVideoUrl(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return candidate;
  } catch {
    return null;
  }
}
