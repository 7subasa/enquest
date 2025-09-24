export function getApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;

  if (!raw || raw.trim() === '') {
    return '/api';
  }

  const trimmed = raw.trim().replace(/\/$/, '');

  if (trimmed === '' || trimmed === '/') {
    return '/api';
  }

  if (trimmed.endsWith('/api')) {
    return trimmed;
  }

  return `${trimmed}/api`;
}

export function buildApiUrl(path: string): string {
  const base = getApiBase();
  if (path.startsWith('/')) {
    return `${base}${path}`;
  }
  return `${base}/${path}`;
}
