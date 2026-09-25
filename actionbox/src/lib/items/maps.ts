export function mapSearchQuery(location?: string | null, address?: string | null): string | null {
  const q = [address, location].filter(Boolean).join(" ").trim();
  return q || null;
}

export function naverMapUrl(query: string): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
}

export function googleMapUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
