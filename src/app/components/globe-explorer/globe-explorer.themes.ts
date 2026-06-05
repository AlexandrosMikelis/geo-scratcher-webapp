import { GlobeAssets, ThemeDef, ThemeId } from './globe-explorer.types';
import { silverFoil, pickFrom } from './globe-explorer.util';

/** Default CDN assets. Override via the component's `assets` input to self-host. */
export const DEFAULT_ASSETS: GlobeAssets = {
  blueMarble: 'https://unpkg.com/three-globe@2/example/img/earth-blue-marble.jpg',
  night: 'https://unpkg.com/three-globe@2/example/img/earth-night.jpg',
  topology: 'https://unpkg.com/three-globe@2/example/img/earth-topology.png',
  sky: 'https://unpkg.com/three-globe@2/example/img/night-sky.png',
  countriesGeoJson:
    'https://cdn.jsdelivr.net/gh/vasturiano/globe.gl/example/datasets/ne_110m_admin_0_countries.geojson',
};

/** Each theme re-skins everything AROUND the satellite earth: backdrop,
 *  atmosphere, UI palette, fonts, and its own scratch-off coating. */
export const THEMES: Record<ThemeId, ThemeDef> = {
  realistic: {
    label: 'Realistic',
    backdrop: 'stars',
    atmosphere: 'rgb(56,225,232)', atmAlt: 0.17,
    accentRgb: '56,225,232', visitedRgb: '240,180,60',
    seam: 'rgba(58,68,92,0.6)', sideFoil: 'rgba(120,130,152,0.6)',
    hoverCap: 'rgba(190,236,240,1)', selCap: 'rgba(208,246,249,1)',
    foil: (f) => silverFoil(f),
    vars: {
      '--bg1': '#0e1733', '--bg2': '#05070f',
      '--panel': 'rgba(13,19,34,0.72)', '--panel-solid': '#0d1322',
      '--border': 'rgba(150,170,210,0.13)', '--border-bright': 'rgba(150,170,210,0.28)',
      '--text': '#e9eef8', '--muted': '#8794ab', '--faint': '#59647d',
      '--accent-rgb': '56,225,232', '--visited-rgb': '240,180,60',
      '--accent-ink': '#bff6f8', '--visited-ink': '#ffd687',
      '--track': 'rgba(150,170,210,0.12)', '--radius': '15px', '--border-w': '1px',
      '--font-ui': "'Space Grotesk',system-ui,sans-serif",
      '--font-display': "'Space Grotesk',system-ui,sans-serif",
      '--shadow': '0 18px 50px -12px rgba(0,0,0,0.7)',
    },
  },
  playful: {
    label: 'Playful',
    backdrop: null,
    atmosphere: 'rgb(255,150,90)', atmAlt: 0.2,
    accentRgb: '255,122,61', visitedRgb: '238,82,83',
    seam: 'rgba(255,255,255,0.6)', sideFoil: 'rgba(220,150,120,0.55)',
    hoverCap: 'rgba(255,212,175,1)', selCap: 'rgba(255,236,214,1)',
    foil: (f) => { const c = pickFrom([[247,196,180],[245,176,205],[230,200,245],[250,220,170],[246,200,196]], f); return `rgb(${c[0]},${c[1]},${c[2]})`; },
    vars: {
      '--bg1': '#fff4ea', '--bg2': '#ffd6c0',
      '--panel': 'rgba(255,255,255,0.8)', '--panel-solid': '#ffffff',
      '--border': 'rgba(214,120,80,0.22)', '--border-bright': 'rgba(214,120,80,0.42)',
      '--text': '#3a2218', '--muted': '#9a6f5c', '--faint': '#c29a86',
      '--accent-rgb': '255,122,61', '--visited-rgb': '238,82,83',
      '--accent-ink': '#c2451d', '--visited-ink': '#c0392b',
      '--track': 'rgba(214,120,80,0.16)', '--radius': '20px', '--border-w': '1.5px',
      '--font-ui': "'Fredoka',system-ui,sans-serif",
      '--font-display': "'Fredoka',system-ui,sans-serif",
      '--shadow': '0 18px 44px -14px rgba(214,120,80,0.55)',
    },
  },
  cartoon: {
    label: 'Cartoon',
    backdrop: null,
    atmosphere: 'rgb(180,220,255)', atmAlt: 0.22,
    accentRgb: '43,127,255', visitedRgb: '28,28,28',
    seam: 'rgba(28,28,28,0.85)', sideFoil: 'rgba(28,28,28,0.8)',
    hoverCap: 'rgba(120,200,255,1)', selCap: 'rgba(150,215,255,1)',
    foil: (f) => { const c = pickFrom([[244,162,97],[231,111,81],[42,157,143],[138,177,125],[233,196,106],[108,160,220],[201,138,200],[120,200,180],[240,150,170]], f); return `rgb(${c[0]},${c[1]},${c[2]})`; },
    vars: {
      '--bg1': '#d8f0ff', '--bg2': '#a6d6ff',
      '--panel': 'rgba(255,255,255,0.93)', '--panel-solid': '#ffffff',
      '--border': 'rgba(28,28,28,0.9)', '--border-bright': 'rgba(28,28,28,1)',
      '--text': '#1c2230', '--muted': '#5b6675', '--faint': '#8a96a6',
      '--accent-rgb': '43,127,255', '--visited-rgb': '28,28,28',
      '--accent-ink': '#1559c9', '--visited-ink': '#1c1c1c',
      '--track': 'rgba(28,28,28,0.12)', '--radius': '16px', '--border-w': '2.5px',
      '--font-ui': "'Baloo 2',system-ui,sans-serif",
      '--font-display': "'Lilita One',system-ui,sans-serif",
      '--shadow': '4px 5px 0 rgba(28,28,28,0.9)',
    },
  },
};
