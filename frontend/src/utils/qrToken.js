export function extractQrToken(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';

  try {
    const url = new URL(value);
    const token = url.searchParams.get('token');
    if (token) return token.trim();
  } catch {
    // not a URL — treat as raw token
  }

  return value;
}

export function buildCheckInUrl(qrToken) {
  const token = String(qrToken || '').trim();
  if (!token || typeof window === 'undefined') return token;
  return `${window.location.origin}/check-in?token=${encodeURIComponent(token)}`;
}
