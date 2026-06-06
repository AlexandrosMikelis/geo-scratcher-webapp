
import {
  AfterViewInit, Component, ElementRef, EventEmitter, Inject, Input,
  NgZone, OnChanges, OnDestroy, Output, PLATFORM_ID, SimpleChanges, ViewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { CountryInfo } from '../globe-explorer/globe-explorer.types';

const GEO_URL = 'https://cdn.jsdelivr.net/gh/vasturiano/globe.gl/example/datasets/ne_110m_admin_0_countries.geojson';
const ZONE = 340;
const REVEAL_AT = 0.6;

type ThemeId = 'realistic' | 'playful' | 'cartoon';

interface CoatTheme {
  grad: [string, string];
  stroke: string;
  strokeW: number;
  coat(ctx: CanvasRenderingContext2D, s: number): void;
}

const THEMES: Record<ThemeId, CoatTheme> = {
  realistic: {
    grad: ['#62e9ef', '#2196c4'], stroke: 'rgba(191,246,248,0.9)', strokeW: 1.5,
    coat(ctx, s) {
      const g = ctx.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, '#e4e8f0'); g.addColorStop(0.45, '#aeb5c6');
      g.addColorStop(0.55, '#cbd0dd'); g.addColorStop(1, '#969db0');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
      ctx.globalAlpha = 0.12; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      for (let i = -s; i < s; i += 4) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + s, s); ctx.stroke(); }
      ctx.globalAlpha = 1;
    },
  },
  playful: {
    grad: ['#ffa86b', '#ee5d5e'], stroke: 'rgba(255,217,194,0.95)', strokeW: 1.5,
    coat(ctx, s) {
      const g = ctx.createLinearGradient(0, 0, s, s);
      ['#f8cad6', '#f9dcb4', '#ead0f6', '#caf1e3', '#f5e2aa', '#f8cad6']
        .forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
      const sh = ctx.createLinearGradient(0, s, s, 0);
      sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.4)');
      sh.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sh; ctx.fillRect(0, 0, s, s);
    },
  },
  cartoon: {
    grad: ['#3f8dff', '#1559c9'], stroke: '#1c1c1c', strokeW: 3,
    coat(ctx, s) {
      ctx.fillStyle = '#e9a24c'; ctx.fillRect(0, 0, s, s);
      ctx.globalAlpha = 0.18; ctx.strokeStyle = '#7a4a14'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 280; i++) {
        const x = Math.random() * s, y = Math.random() * s;
        const a = Math.random() * Math.PI, l = 8 + Math.random() * 16;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
  },
};

// GeoJSON feature cache (shared across instances)
let featureCache: any[] | null = null;
let featureByAdmin = new Map<string, any>();

function buildPath(feature: any, size: number, pad: number): string {
  const rings: number[][][] = [];
  const g = feature?.geometry;
  if (!g) return '';
  if (g.type === 'Polygon') g.coordinates.forEach((r: any) => rings.push(r));
  else if (g.type === 'MultiPolygon') g.coordinates.forEach((poly: any) => poly.forEach((r: any) => rings.push(r)));
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  rings.forEach(r => r.forEach(([lng, lat]) => {
    if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
  }));
  const meanLat = (minLat + maxLat) / 2;
  const k = Math.cos((meanLat * Math.PI) / 180) || 1;
  const geoW = (maxLng - minLng) * k, geoH = maxLat - minLat;
  const avail = size - 2 * pad;
  const scale = Math.min(avail / geoW, avail / geoH);
  const drawW = geoW * scale, drawH = geoH * scale;
  const offX = (size - drawW) / 2, offY = (size - drawH) / 2;
  const px = (lng: number) => offX + (lng - minLng) * k * scale;
  const py = (lat: number) => offY + (maxLat - lat) * scale;
  let d = '';
  rings.forEach(r => {
    r.forEach(([lng, lat], i) => { d += (i === 0 ? 'M' : 'L') + px(lng).toFixed(1) + ' ' + py(lat).toFixed(1) + ' '; });
    d += 'Z ';
  });
  return d.trim();
}

function countAlpha(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): number {
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let count = 0;
  for (let i = 3; i < img.length; i += 16) if (img[i] > 20) count++;
  return count;
}

@Component({
  selector: 'app-scratch-reveal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scratch-reveal.component.html',
  styleUrls: ['./scratch-reveal.component.scss'],
})
export class ScratchRevealComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('scratchCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() countryInfo: CountryInfo | null = null;
  @Input() theme: ThemeId = 'realistic';

  @Output() revealed = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  pathD = '';
  isRevealed = false;
  isLoading = true;
  continent = '';
  countryName = '';

  private isBrowser: boolean;
  private drawing = false;
  private lastPt: { x: number; y: number } | null = null;
  private initialAlpha = 0;
  private rafId = 0;
  private boundUp = () => this.onUp();

  constructor(private zone: NgZone, @Inject(PLATFORM_ID) pid: Object) {
    this.isBrowser = isPlatformBrowser(pid);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.loadAndRender();
    window.addEventListener('pointerup', this.boundUp);
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (!this.isBrowser) return;
    if (ch['countryInfo'] || ch['theme']) {
      this.isRevealed = false;
      this.loadAndRender();
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('pointerup', this.boundUp);
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  get gradId(): string { return `sr-grad-${this.theme}`; }
  get themeDef(): CoatTheme { return THEMES[this.theme] || THEMES.realistic; }

  private async loadAndRender(): Promise<void> {
    if (!this.countryInfo) return;
    this.isLoading = true;
    this.pathD = '';
    this.countryName = this.countryInfo.name;
    this.continent = this.countryInfo.continent;

    if (!featureCache) {
      try {
        const res = await fetch(GEO_URL);
        const geo = await res.json();
        featureCache = geo.features || [];
        featureCache!.forEach((f: any) => {
          const p = f.properties || {};
          const admin = p.ADMIN || p.NAME || p.name || '';
          const iso = p.ISO_A3 && p.ISO_A3 !== '-99' ? p.ISO_A3 : null;
          if (admin) featureByAdmin.set(admin, f);
          if (iso) featureByAdmin.set(iso, f);
        });
      } catch { featureCache = []; }
    }

    const feature = featureByAdmin.get(this.countryInfo.name) || featureByAdmin.get(this.countryInfo.id);
    if (feature) {
      this.pathD = buildPath(feature, ZONE, 22);
    }

    this.isLoading = false;
    // paint coating after view updates
    setTimeout(() => this.paintCoat(), 0);
  }

  private paintCoat(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.pathD) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = ZONE * dpr;
    canvas.height = ZONE * dpr;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, ZONE, ZONE);
    ctx.save();
    ctx.clip(new Path2D(this.pathD));
    THEMES[this.theme].coat(ctx, ZONE);
    ctx.restore();
    this.initialAlpha = countAlpha(ctx, canvas);
  }

  onPointerDown(e: PointerEvent): void {
    if (this.isRevealed) return;
    this.drawing = true;
    this.lastPt = this.toCanvasPoint(e);
    this.erase(this.lastPt.x, this.lastPt.y);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.drawing || !this.lastPt || this.isRevealed) return;
    const p = this.toCanvasPoint(e);
    this.strokeLine(this.lastPt, p);
    this.lastPt = p;
    this.scheduleMeasure();
  }

  private onUp(): void {
    if (!this.drawing) return;
    this.drawing = false;
    this.lastPt = null;
    this.measure();
  }

  private toCanvasPoint(e: PointerEvent): { x: number; y: number } {
    const canvas = this.canvasRef.nativeElement;
    const r = canvas.getBoundingClientRect();
    const s = ZONE / r.width;
    return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s };
  }

  private erase(x: number, y: number): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const R = 24;
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.7, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  private strokeLine(a: { x: number; y: number }, b: { x: number; y: number }): void {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.floor(dist / 8));
    for (let i = 0; i <= steps; i++) {
      this.erase(a.x + (b.x - a.x) * (i / steps), a.y + (b.y - a.y) * (i / steps));
    }
  }

  private scheduleMeasure(): void {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => { this.rafId = 0; this.measure(); });
  }

  private measure(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.initialAlpha) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const remaining = countAlpha(ctx, canvas);
    const frac = 1 - remaining / this.initialAlpha;
    if (frac >= REVEAL_AT) {
      this.zone.run(() => {
        this.isRevealed = true;
        this.revealed.emit();
      });
    }
  }

  close(): void {
    this.closed.emit();
  }
}