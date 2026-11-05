export function verifyCitation(c: {url: string; date?: string}): boolean {
  return c.url.startsWith('https://') && Boolean(c.date);
}
