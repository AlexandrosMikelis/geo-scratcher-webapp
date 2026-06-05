/** Public types for the GlobeExplorer component. */

export type ThemeId = 'realistic' | 'playful' | 'cartoon';
export type MapStyleId = 'satellite' | 'night' | 'vector';

/** URLs for the earth textures + country-border data.
 *  Override any of these via the component's `assets` input to self-host. */
export interface GlobeAssets {
  blueMarble: string;        // daytime satellite texture
  night: string;             // night-lights texture
  topology: string;          // bump/relief map
  sky: string;               // starfield background (used by the Realistic theme)
  countriesGeoJson: string;  // Natural Earth admin-0 countries GeoJSON
}

export interface City {
  name: string;
  country: string;
  lat: number;
  lng: number;
}

/** Emitted when a country is selected / scratched. */
export interface CountryInfo {
  id: string;             // ISO_A3 where available, else the admin name
  name: string;
  continent: string;
  population: number | null;
  lat: number;
  lng: number;
}

/** Internal — one theme's full definition. */
export interface ThemeDef {
  label: string;
  backdrop: 'stars' | null;
  atmosphere: string;
  atmAlt: number;
  accentRgb: string;       // "r,g,b"
  visitedRgb: string;      // "r,g,b"
  seam: string;            // unscratched country outline
  sideFoil: string;        // coating edge color
  hoverCap: string;
  selCap: string;
  foil: (feature: any) => string;   // per-country scratch coating color
  vars: Record<string, string>;     // CSS custom properties applied to :host
}
