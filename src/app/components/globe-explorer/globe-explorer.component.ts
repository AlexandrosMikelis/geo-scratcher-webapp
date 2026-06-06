import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit, Component, ElementRef, EventEmitter, Inject, Input,
  NgZone, OnChanges, OnDestroy, Output, PLATFORM_ID, SimpleChanges, ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CountryInfo, GlobeAssets, MapStyleId, ThemeDef, ThemeId } from './globe-explorer.types';
import { DEFAULT_ASSETS, THEMES } from './globe-explorer.themes';
import { WORLD_CITIES } from './globe-explorer.cities';
import {
  centroidOf, continentColor, countryContinent, countryId, countryName,
  countryPopulation, subsolarPoint,
} from './globe-explorer.util';

const CITY_ALT = 0.5;
const HOME_VIEW = { lat: 22, lng: 8, altitude: 2.5 };
const MIN_ALT = 0.04;
const MAX_ALT = 3.6;

interface SearchResult {
  type: 'country' | 'city';
  id?: string;
  name: string;
  sub: string;
  lat?: number;
  lng?: number;
  feat?: any;
}

@Component({
  selector: 'app-globe-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './globe-explorer.component.html',
  styleUrls: ['./globe-explorer.component.scss'],
})
export class GlobeExplorerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('globeHost', { static: true }) globeHost!: ElementRef<HTMLDivElement>;

  /** Visual theme: 'realistic' | 'playful' | 'cartoon'. */
  @Input() theme: ThemeId = 'realistic';
  /** Globe map source: 'satellite' | 'night' | 'vector'. */
  @Input() mapStyle: MapStyleId = 'satellite';
  /** Initial / controlled list of scratched country ids (ISO_A3 or admin name). */
  @Input() visited: string[] = [];
  /** Auto-spin when idle. */
  @Input() autoSpin = true;
  /** Day/night terminator shading (Satellite map only). */
  @Input() dayNight = true;
  /** Show the built-in UI chrome (search / panels / controls). */
  @Input() showUi = true;
  /** Override any asset URL to self-host textures + border data. */
  @Input() assets: Partial<GlobeAssets> = {};

  @Output() themeChange = new EventEmitter<ThemeId>();
  @Output() mapStyleChange = new EventEmitter<MapStyleId>();
  @Output() autoSpinChange = new EventEmitter<boolean>();
  @Output() dayNightChange = new EventEmitter<boolean>();
  /** Fired when a country is scratched (revealed). */
  @Output() scratched = new EventEmitter<CountryInfo>();
  /** Fired when a country is covered again. */
  @Output() unscratched = new EventEmitter<CountryInfo>();
  /** Fired with the full scratched-id list after any change — bind with [(visited)] or persist this. */
  @Output() visitedChange = new EventEmitter<string[]>();
  /** Fired when a country is selected (info panel target), or null on close. */
  @Output() countrySelected = new EventEmitter<CountryInfo | null>();
  /** Fired once the globe + borders have loaded. */
  @Output() ready = new EventEmitter<void>();

  // ---- view state (template-bound) ----
  booted = false;
  query = '';
  searchFocused = false;
  zoomedIn = false;
  selectedId: string | null = null;
  selectedInfo: CountryInfo | null = null;
  features: any[] = [];
  themes: Record<string, ThemeDef> = THEMES;

  // ---- internals ----
  private world: any;
  private assetUrls!: GlobeAssets;
  private themeDef: ThemeDef = THEMES.realistic;
  private visitedSet = new Set<string>();
  private featById = new Map<string, any>();
  private hoverId: string | null = null;
  private ro?: ResizeObserver;
  private sunTimer?: any;
  private idleTimer?: any;
  private bootFallback?: any;
  private isBrowser: boolean;

  constructor(
    private el: ElementRef<HTMLElement>,
    private zone: NgZone,
    @Inject(PLATFORM_ID) platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // =================================================================
  ngAfterViewInit(): void {
    if (!this.isBrowser) return; // globe.gl is browser-only (SSR-safe guard)
    this.assetUrls = { ...DEFAULT_ASSETS, ...(this.assets || {}) };
    this.themeDef = THEMES[this.theme] || THEMES.realistic;
    this.visitedSet = new Set(this.visited || []);
    this.zone.runOutsideAngular(() => this.initGlobe());
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (!this.world) return;
    if (ch['theme']) { this.themeDef = THEMES[this.theme] || THEMES.realistic; this.applyTheme(); }
    if (ch['mapStyle']) this.applyStyle();
    if (ch['dayNight']) this.applyLighting();
    if (ch['autoSpin']) { const c = this.world.controls(); if (c) c.autoRotate = this.autoSpin; }
    if (ch['visited']) { this.visitedSet = new Set(this.visited || []); this.refreshPolys(); }
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    clearInterval(this.sunTimer);
    clearTimeout(this.idleTimer);
    clearTimeout(this.bootFallback);
    try { this.world?._destructor?.(); } catch { /* noop */ }
  }

  // ============================ globe ==============================
  private async initGlobe(): Promise<void> {
    const { default: Globe } = await import('globe.gl');
    const host = this.globeHost.nativeElement;
    const world = (Globe as any)()(host)
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor(this.themeDef.atmosphere)
      .atmosphereAltitude(this.themeDef.atmAlt)
      .globeImageUrl(this.assetUrls.blueMarble)
      .bumpImageUrl(this.assetUrls.topology)
      .pointsData(WORLD_CITIES)
      .pointLat('lat').pointLng('lng').pointAltitude(0.004)
      .pointRadius(0.16).pointColor(() => `rgba(${this.themeDef.accentRgb},0.85)`)
      .pointLabel(() => '')
      .labelsData([])
      .labelLat('lat').labelLng('lng').labelText('name')
      .labelSize(0.42).labelDotRadius(0.16)
      .labelColor(() => 'rgba(233,238,248,0.95)')
      .labelResolution(1)
      .labelLabel(() => '')
      .polygonsTransitionDuration(280)
      .polygonLabel(() => '')
      .polygonCapColor(this.capColor)
      .polygonSideColor(this.sideColor)
      .polygonStrokeColor(this.strokeColor)
      .polygonAltitude(this.polyAlt)
      .onPolygonHover((poly: any) => {
        this.hoverId = poly ? countryId(poly) : null;
        host.style.cursor = poly ? 'pointer' : 'grab';
        this.refreshPolys();
      })
      .onPolygonClick((poly: any) => this.onCountryClick(poly));
    this.world = world;

    const resize = () => world.width(host.clientWidth).height(host.clientHeight);
    resize();
    this.ro = new ResizeObserver(resize);
    this.ro.observe(host);

    const controls = world.controls();
    controls.autoRotate = this.autoSpin;
    controls.autoRotateSpeed = 0.32;
    controls.minDistance = 101;
    controls.maxDistance = 100 * (1 + MAX_ALT);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.addEventListener('start', () => {
      controls.autoRotate = false;
      clearTimeout(this.idleTimer);
    });
    controls.addEventListener('end', () => {
      clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => { if (this.autoSpin) controls.autoRotate = true; }, 3500);
    });

    let labelsOn = false;
    world.onZoom((pov: any) => {
      const on = pov.altitude < CITY_ALT;
      if (on !== labelsOn) {
        labelsOn = on;
        world.labelsData(on ? WORLD_CITIES : []);
        this.zone.run(() => (this.zoomedIn = on));
      }
    });

    world.pointOfView(HOME_VIEW, 0);
    this.applyTheme();

    fetch(this.assetUrls.countriesGeoJson)
      .then((r) => r.json())
      .then((geo) => {
        const feats = (geo.features || []).filter((f: any) => countryName(f) !== 'Antarctica');
        feats.forEach((f: any) => this.featById.set(countryId(f), f));
        world.polygonsData(feats);
        this.applyStyle();
        this.zone.run(() => { this.features = feats; });
        this.bootDone();
      })
      .catch(() => { this.applyStyle(); this.bootDone(); });

    this.sunTimer = setInterval(() => this.applyLighting(), 60000);
    this.bootFallback = setTimeout(() => this.bootDone(), 9000);
  }

  private bootDone(): void {
    if (this.booted) return;
    this.zone.run(() => { this.booted = true; this.ready.emit(); });
  }

  // ====================== polygon accessors ========================
  // Unscratched land = opaque theme coating; scratched = revealed earth.
  private capColor = (d: any): string => {
    const id = countryId(d);
    const vec = this.mapStyle === 'vector';
    if (this.visitedSet.has(id)) return vec ? continentColor(d, 0.88) : 'rgba(0,0,0,0)';
    if (this.selectedId === id) return this.themeDef.selCap;
    if (this.hoverId === id) return this.themeDef.hoverCap;
    return this.themeDef.foil(d);
  };
  private sideColor = (d: any): string => {
    if (this.visitedSet.has(countryId(d))) return `rgba(${this.themeDef.visitedRgb},0.3)`;
    return this.themeDef.sideFoil;
  };
  private strokeColor = (d: any): string => {
    const id = countryId(d);
    if (this.selectedId === id || this.hoverId === id) return `rgba(${this.themeDef.accentRgb},0.95)`;
    if (this.visitedSet.has(id)) return `rgba(${this.themeDef.visitedRgb},0.9)`;
    return this.themeDef.seam;
  };
  private polyAlt = (d: any): number => {
    const id = countryId(d);
    if (this.hoverId === id) return 0.024;
    if (this.selectedId === id) return 0.02;
    if (this.visitedSet.has(id)) return 0.004;
    return 0.013;
  };

  private refreshPolys(): void {
    if (!this.world) return;
    this.world
      .polygonCapColor(this.capColor)
      .polygonSideColor(this.sideColor)
      .polygonStrokeColor(this.strokeColor)
      .polygonAltitude(this.polyAlt);
  }

  // ========================= appearance ============================
  private applyStyle(): void {
    const w = this.world; if (!w) return;
    if (this.mapStyle === 'vector') {
      w.globeImageUrl(null).bumpImageUrl(null);
      const m = w.globeMaterial(); if (m?.color) { m.color.set('#0b1124'); m.bumpScale = 0; }
    } else {
      w.globeImageUrl(this.mapStyle === 'night' ? this.assetUrls.night : this.assetUrls.blueMarble)
        .bumpImageUrl(this.assetUrls.topology);
      const m = w.globeMaterial(); if (m?.color) { m.color.set('#ffffff'); m.bumpScale = 6; }
    }
    this.refreshPolys();
    this.applyLighting();
  }

  private applyTheme(): void {
    const t = this.themeDef;
    const hostStyle = (this.el.nativeElement as HTMLElement).style;
    Object.entries(t.vars).forEach(([k, v]) => hostStyle.setProperty(k, v));
    const w = this.world; if (!w) return;
    w.backgroundImageUrl(t.backdrop === 'stars' ? this.assetUrls.sky : null);
    w.backgroundColor('rgba(0,0,0,0)');
    w.atmosphereColor(t.atmosphere).atmosphereAltitude(t.atmAlt);
    this.applyStyle();
  }

  private applyLighting(): void {
    const w = this.world; if (!w?.lights) return;
    const lights = w.lights() || [];
    const dir = lights.find((l: any) => l.isDirectionalLight);
    const amb = lights.find((l: any) => l.isAmbientLight);
    const sp = subsolarPoint(new Date());
    if (dir && w.getCoords) {
      const c = w.getCoords(sp.lat, sp.lng, 2);
      dir.position.set(c.x, c.y, c.z);
      dir.intensity = 3.1;
    }
    if (amb) {
      const even = !this.dayNight || this.mapStyle !== 'satellite';
      amb.intensity = even ? 2.6 : 0.95;
    }
  }

  // ========================= interaction ===========================
  private onCountryClick(poly: any): void {
    const id = countryId(poly);
    const info = this.toInfo(poly);
    this.zone.run(() => {
      this.selectedId = id;
      this.selectedInfo = info;
      this.countrySelected.emit(info);
    });
    this.flyTo(info.lat, info.lng, 0.55, 1100);
    this.refreshPolys();
  }

  private toInfo(f: any): CountryInfo {
    const c = centroidOf(f);
    return {
      id: countryId(f), name: countryName(f), continent: countryContinent(f),
      population: countryPopulation(f), lat: c.lat, lng: c.lng,
    };
  }

  private flyTo(lat: number, lng: number, altitude = 0.7, ms = 1200): void {
    this.world?.pointOfView({ lat, lng, altitude }, ms);
  }

  // ====================== template handlers ========================
  get isSelectedVisited(): boolean {
    return !!this.selectedId && this.visitedSet.has(this.selectedId);
  }

  get total(): number { return this.features.length; }
  get visitedCount(): number { return this.visitedSet.size; }
  get visitedPct(): number { return this.total ? (this.visitedSet.size / this.total) * 100 : 0; }

  get visitedList(): { id: string; name: string }[] {
    return [...this.visitedSet]
      .map((id) => ({ id, name: this.featById.get(id) ? countryName(this.featById.get(id)) : id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get results(): SearchResult[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return [];
    const out: SearchResult[] = [];
    for (const f of this.features) {
      if (countryName(f).toLowerCase().includes(q))
        out.push({ type: 'country', id: countryId(f), name: countryName(f), sub: 'Country', feat: f });
      if (out.length > 24) break;
    }
    for (const c of WORLD_CITIES) {
      if (c.name.toLowerCase().includes(q))
        out.push({ type: 'city', name: c.name, sub: c.country, lat: c.lat, lng: c.lng });
      if (out.length > 30) break;
    }
    return out.slice(0, 8);
  }

  /** Delay blur so a result click registers first. */
  onSearchBlur(): void {
    setTimeout(() => (this.searchFocused = false), 140);
  }

  pickResult(r: SearchResult): void {
    this.query = '';
    this.searchFocused = false;
    if (r.type === 'country' && r.feat) {
      const info = this.toInfo(r.feat);
      this.selectedId = info.id; this.selectedInfo = info;
      this.countrySelected.emit(info);
      this.flyTo(info.lat, info.lng, 0.55, 1300);
      this.refreshPolys();
    } else if (r.lat != null && r.lng != null) {
      this.flyTo(r.lat, r.lng, 0.22, 1300);
    }
  }

  flyToCountry(id: string): void {
    const f = this.featById.get(id); if (!f) return;
    const info = this.toInfo(f);
    this.selectedId = id; this.selectedInfo = info;
    this.countrySelected.emit(info);
    this.flyTo(info.lat, info.lng, 0.55, 1200);
    this.refreshPolys();
  }

  /** Info-card button: reveal or cover the selected country. */
  toggleSelectedVisited(): void {
    if (!this.selectedId || !this.selectedInfo) return;
    const id = this.selectedId;
    if (this.visitedSet.has(id)) {
      this.visitedSet.delete(id);
      this.unscratched.emit(this.selectedInfo);
    } else {
      this.visitedSet.add(id);
      this.scratched.emit(this.selectedInfo);
    }
    this.visitedChange.emit([...this.visitedSet]);
    this.refreshPolys();
  }

  closeInfo(): void {
    this.selectedId = null; this.selectedInfo = null;
    this.countrySelected.emit(null);
    this.refreshPolys();
  }

  resetVisited(): void {
    this.visitedSet.clear();
    this.visitedChange.emit([]);
    this.refreshPolys();
  }

  setTheme(id: ThemeId): void {
    this.theme = id; this.themeDef = THEMES[id]; this.applyTheme();
    this.themeChange.emit(id);
  }
  setMapStyle(id: MapStyleId): void {
    this.mapStyle = id; this.applyStyle(); this.mapStyleChange.emit(id);
  }
  toggleSpin(): void {
    this.autoSpin = !this.autoSpin;
    const c = this.world?.controls(); if (c) c.autoRotate = this.autoSpin;
    this.autoSpinChange.emit(this.autoSpin);
  }
  toggleDayNight(): void {
    this.dayNight = !this.dayNight; this.applyLighting();
    this.dayNightChange.emit(this.dayNight);
  }
  zoomIn(): void { this.zoomBy(0.55); }
  zoomOut(): void { this.zoomBy(1.7); }
  private zoomBy(factor: number): void {
    const w = this.world; if (!w) return;
    const pov = w.pointOfView();
    const alt = Math.min(MAX_ALT, Math.max(MIN_ALT, pov.altitude * factor));
    w.pointOfView({ altitude: alt }, 500);
  }
  goHome(): void {
    this.closeInfo();
    this.world?.pointOfView(HOME_VIEW, 1400);
  }

  formatPop(n: number | null): string {
    if (n == null) return '—';
    return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  }
}
