/** Framework-agnostic geo + color helpers. */

export function countryId(f: any): string {
  const p = f.properties || {};
  return p.ISO_A3 && p.ISO_A3 !== '-99' ? p.ISO_A3 : p.ADMIN || p.NAME || p.name;
}

export function countryName(f: any): string {
  const p = f.properties || {};
  return p.ADMIN || p.NAME || p.name || 'Unknown';
}

export function countryContinent(f: any): string {
  const p = f.properties || {};
  return p.CONTINENT || p.continent || 'Region';
}

export function countryPopulation(f: any): number | null {
  const p = f.properties || {};
  const v = p.POP_EST ?? p.pop_est;
  return typeof v === 'number' ? v : null;
}

/** Rough centroid (largest ring average) — good enough to fly to. */
export function centroidOf(f: any): { lat: number; lng: number } {
  const g = f.geometry;
  if (!g) return { lat: 0, lng: 0 };
  let rings: number[][][] = [];
  if (g.type === 'Polygon') {
    rings = g.coordinates;
  } else if (g.type === 'MultiPolygon') {
    let best: number[][][] | null = null;
    let bestN = -1;
    for (const poly of g.coordinates) {
      const n = poly[0].length;
      if (n > bestN) { bestN = n; best = poly; }
    }
    rings = best || [];
  }
  const ring = rings[0] || [];
  let x = 0, y = 0, n = 0;
  for (const [lng, lat] of ring) { x += lng; y += lat; n++; }
  if (!n) return { lat: 0, lng: 0 };
  return { lng: x / n, lat: y / n };
}

/** Deterministic per-string hash for stable per-country coating colors. */
export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function pickFrom<T>(palette: T[], f: any): T {
  return palette[hashStr(countryId(f)) % palette.length];
}

const CONTINENT_RGB: Record<string, [number, number, number]> = {
  Africa: [198, 150, 92], Asia: [200, 120, 108], Europe: [120, 150, 205],
  'North America': [108, 182, 150], 'South America': [192, 130, 182],
  Oceania: [108, 182, 192], Antarctica: [190, 200, 212],
  'Seven seas (open ocean)': [120, 150, 200],
};

/** Continent fill (used by the Vector map style when a country is revealed). */
export function continentColor(feat: any, a: number): string {
  const c = feat?.properties?.CONTINENT || feat?.properties?.continent || '';
  const [r, g, b] = CONTINENT_RGB[c] || [140, 150, 178];
  return `rgba(${r},${g},${b},${a})`;
}

/** Brushed-silver coating (Realistic theme). */
export function silverFoil(f: any): string {
  const v = 198 + (hashStr(countryId(f)) % 26); // 198..223
  return `rgb(${v - 7},${v - 2},${v + 5})`;
}

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((d.getTime() - start) / 86400000);
}

/** Approximate sub-solar point (lat/lng where the sun is overhead now). */
export function subsolarPoint(date: Date): { lat: number; lng: number } {
  const rad = Math.PI / 180;
  const n = dayOfYear(date);
  const decl = -23.44 * Math.cos(rad * (360 / 365) * (n + 10));
  const utcH = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const lng = -15 * (utcH - 12);
  return { lat: decl, lng: ((lng + 540) % 360) - 180 };
}
