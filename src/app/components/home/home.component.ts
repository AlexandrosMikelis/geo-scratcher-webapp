import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, NgZone, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { Country } from '../../interfaces/country';
import { COUNTRIES_DATA } from './countriesData';
import { CountryStatusModalComponent } from '../country-status-modal/country-status-modal.component';
import { AuthService, CountryStatus } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, CountryStatusModalComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  readonly countries: Country[] = COUNTRIES_DATA.map((country) => ({ ...country }));
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
  isLoadingStatuses = false;
  saveMessage = '';

  private pointerDown = false;
  private activePointerId: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private spinFrame?: number;
  private lastSpinTime = 0;
  private spinRunId = 0;

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private ngZone: NgZone,
    private changeDetector: ChangeDetectorRef,
    private authService: AuthService,
    private router: Router
  ) {}

  ngAfterViewInit(): void {
    if (!this.authService.token) {
      this.router.navigate(['/login']);
      return;
    }

    this.resetView();
    this.loadCountryStatuses();
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
    this.activePointerId = event.pointerId;
    this.isDragging = false;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.pointerDown || event.pointerId !== this.activePointerId) {
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
    if (event.pointerId !== this.activePointerId) {
      return;
    }
    this.pointerDown = false;
    this.activePointerId = null;
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

    const previousStatus = this.getCountryStatusValue(country);
    const nextStatus = previousStatus === status ? null : status;

    this.applyCountryStatus(country, nextStatus);
    this.showModal = false;
    this.saveMessage = 'Saving...';

    const request: Observable<unknown> = nextStatus
      ? this.authService.setCountryStatus(country.id, nextStatus)
      : this.authService.clearCountryStatus(country.id);

    request.subscribe({
      next: () => {
        this.saveMessage = 'Saved';
      },
      error: () => {
        this.applyCountryStatus(country, previousStatus);
        this.saveMessage = 'Could not save. Please sign in again.';
      }
    });
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

    const runId = ++this.spinRunId;
    this.ngZone.runOutsideAngular(() => {
      const spin = (time: number) => {
        if (runId !== this.spinRunId || !this.autoSpin) {
          return;
        }

        const elapsed = this.lastSpinTime ? time - this.lastSpinTime : 16.67;
        this.lastSpinTime = time;

        if (!this.isDragging && !this.showModal) {
          this.xOffset = this.wrapOffset(this.xOffset - elapsed * 0.018);
          this.changeDetector.detectChanges();
        }

        this.spinFrame = window.requestAnimationFrame(spin);
      };

      this.lastSpinTime = 0;
      this.spinFrame = window.requestAnimationFrame(spin);
    });
  }

  private stopAutoSpin(updateState = true): void {
    this.spinRunId++;
    if (this.spinFrame) {
      window.cancelAnimationFrame(this.spinFrame);
      this.spinFrame = undefined;
    }
    this.lastSpinTime = 0;
    if (updateState) {
      this.autoSpin = false;
    }
  }

  private loadCountryStatuses(): void {
    this.isLoadingStatuses = true;
    this.authService.getCountryStatuses().subscribe({
      next: (statuses) => {
        this.countries.forEach((country) => this.applyCountryStatus(country, null));
        statuses.forEach((countryStatus) => {
          const country = this.countries.find((item) => item.id === countryStatus.country_id);
          if (country) {
            this.applyCountryStatus(country, countryStatus.status);
          }
        });
        this.isLoadingStatuses = false;
        this.saveMessage = '';
      },
      error: () => {
        this.isLoadingStatuses = false;
        this.authService.logout();
        this.router.navigate(['/login']);
      }
    });
  }

  private getCountryStatusValue(country: Country): CountryStatus | null {
    if (country.visited) {
      return 'visited';
    }
    if (country.lived) {
      return 'lived';
    }
    if (country.future) {
      return 'future';
    }
    return null;
  }

  private applyCountryStatus(country: Country, status: CountryStatus | null): void {
    country.visited = status === 'visited';
    country.lived = status === 'lived';
    country.future = status === 'future';
  }

  private moveTooltip(event: MouseEvent | PointerEvent): void {
    const host = this.elementRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      x: event.clientX - host.left + 14,
      y: event.clientY - host.top + 14
    };
  }

  private wrapOffset(value: number): number {
    const range = this.mapWidth * 2;
    return ((((value + this.mapWidth) % range) + range) % range) - this.mapWidth;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private isCountryStatus(status: string): status is CountryStatus {
    return status === 'visited' || status === 'lived' || status === 'future';
  }
}
