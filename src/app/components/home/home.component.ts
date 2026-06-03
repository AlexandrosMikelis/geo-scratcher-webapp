import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, NgZone, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Country } from '../../interfaces/country';
import { COUNTRIES_DATA } from './countriesData';
import { CountryStatusModalComponent } from '../country-status-modal/country-status-modal.component';

type CountryStatus = 'visited' | 'lived' | 'future';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, CountryStatusModalComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  readonly countries: Country[] = COUNTRIES_DATA;
  readonly mapWidth = 1211.60724;
  readonly mapHeight = 799.155612;
  readonly copies = [-1, 0, 1];

  scale = 1.12;
  xOffset = 0;
  yOffset = 0;
  isDragging = false;
  autoSpin = true;

  selectedCountry: Country | null = null;
  hoveredCountry: Country | null = null;
  showModal = false;
  tooltip = { x: 0, y: 0 };

  private pointerDown = false;
  private lastX = 0;
  private lastY = 0;
  private spinTimer?: number;

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private ngZone: NgZone,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    this.resetView();
    this.startAutoSpin();
  }

  ngOnDestroy(): void {
    this.stopAutoSpin();
  }

  get mapTransform(): string {
    return `translate(${this.xOffset} ${this.yOffset}) scale(${this.scale})`;
  }

  get visitedCount(): number {
    return this.countries.filter((country) => country.visited).length;
  }

  get livedCount(): number {
    return this.countries.filter((country) => country.lived).length;
  }

  get futureCount(): number {
    return this.countries.filter((country) => country.future).length;
  }

  get exploredCount(): number {
    return this.visitedCount + this.livedCount;
  }

  get progressPercent(): number {
    return Math.round((this.exploredCount / this.countries.length) * 100);
  }

  onWheelScroll(event: WheelEvent): void {
    event.preventDefault();
    this.stopAutoSpin();

    const nextScale = this.scale + (-event.deltaY * 0.0012);
    this.scale = Math.max(0.9, Math.min(2.8, nextScale));
    this.yOffset = this.clamp(this.yOffset, -180, 150);
  }

  onPointerDown(event: PointerEvent): void {
    this.stopAutoSpin();
    this.pointerDown = true;
    this.isDragging = false;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.pointerDown) {
      return;
    }

    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    if (!this.isDragging && Math.hypot(dx, dy) < 4) {
      return;
    }

    this.isDragging = true;
    this.xOffset = this.wrapOffset(this.xOffset + dx / this.scale);
    this.yOffset = this.clamp(this.yOffset + dy / this.scale, -180, 150);
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.moveTooltip(event);
  }

  onPointerUp(event: PointerEvent): void {
    this.pointerDown = false;
    this.isDragging = false;
  }

  onCountryEnter(country: Country, event: MouseEvent): void {
    this.hoveredCountry = country;
    this.moveTooltip(event);
  }

  onCountryMove(event: MouseEvent): void {
    this.moveTooltip(event);
  }

  onCountryLeave(): void {
    this.hoveredCountry = null;
  }

  openCountryStatus(country: Country): void {
    if (this.isDragging) {
      return;
    }

    this.selectedCountry = country;
    this.showModal = true;
  }

  setCountryStatus(country: Country, status: string): void {
    if (!this.isCountryStatus(status)) {
      return;
    }

    country.visited = status === 'visited' ? !country.visited : false;
    country.lived = status === 'lived' ? !country.lived : false;
    country.future = status === 'future' ? !country.future : false;
    this.showModal = false;
  }

  closeModal(): void {
    this.showModal = false;
  }

  zoomIn(): void {
    this.stopAutoSpin();
    this.scale = Math.min(2.8, this.scale + 0.18);
  }

  zoomOut(): void {
    this.stopAutoSpin();
    this.scale = Math.max(0.9, this.scale - 0.18);
  }

  resetView(): void {
    this.scale = 1.12;
    this.xOffset = 0;
    this.yOffset = 0;
  }

  toggleAutoSpin(): void {
    if (this.autoSpin) {
      this.stopAutoSpin();
    } else {
      this.autoSpin = true;
      this.startAutoSpin();
    }
  }

  countryStatus(country: Country): string {
    if (country.lived) {
      return 'Lived in';
    }
    if (country.visited) {
      return 'Visited';
    }
    if (country.future) {
      return 'Future travel';
    }
    return 'Unmarked';
  }

  private startAutoSpin(): void {
    this.stopAutoSpin(false);
    if (!this.autoSpin) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      this.spinTimer = window.setInterval(() => {
        if (!this.isDragging && !this.showModal) {
          this.xOffset = this.wrapOffset(this.xOffset - 0.75);
          this.changeDetector.detectChanges();
        }
      }, 32);
    });
  }

  private stopAutoSpin(updateState = true): void {
    if (this.spinTimer) {
      window.clearInterval(this.spinTimer);
      this.spinTimer = undefined;
    }
    if (updateState) {
      this.autoSpin = false;
    }
  }

  private moveTooltip(event: MouseEvent | PointerEvent): void {
    const host = this.elementRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      x: event.clientX - host.left + 14,
      y: event.clientY - host.top + 14
    };
  }

  private wrapOffset(value: number): number {
    if (value > this.mapWidth) {
      return value - this.mapWidth;
    }
    if (value < -this.mapWidth) {
      return value + this.mapWidth;
    }
    return value;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private isCountryStatus(status: string): status is CountryStatus {
    return status === 'visited' || status === 'lived' || status === 'future';
  }
}
