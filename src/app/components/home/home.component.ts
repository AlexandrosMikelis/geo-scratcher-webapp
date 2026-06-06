
import { Component, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { GlobeExplorerComponent } from '../globe-explorer/globe-explorer.component';
import { CountryInfo, ThemeId } from '../globe-explorer/globe-explorer.types';
import { CountryStatusModalComponent } from '../country-status-modal/country-status-modal.component';
import { ScratchRevealComponent } from '../scratch-reveal/scratch-reveal.component';
import { AuthService, CountryStatus } from '../../services/auth.service';
import { Country } from '../../interfaces/country';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, GlobeExplorerComponent, CountryStatusModalComponent, ScratchRevealComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements AfterViewInit {
  visitedIds: string[] = [];
  currentTheme: ThemeId = 'realistic';

  // scratch reveal
  showScratch = false;
  scratchInfo: CountryInfo | null = null;

  // status modal (for editing existing status)
  selectedCountry: Country | null = null;
  showModal = false;

  saveMessage = '';

  private statusMap = new Map<string, CountryStatus>();

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  ngAfterViewInit(): void {
    if (!this.authService.token) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadCountryStatuses();
  }

  onCountrySelected(info: CountryInfo | null): void {
    if (!info) return;
    const hasStatus = this.statusMap.has(info.id);
    if (!hasStatus) {
      // New country — show scratch reveal
      this.scratchInfo = info;
      this.showScratch = true;
    } else {
      // Already tracked — open status modal to edit
      const currentStatus = this.statusMap.get(info.id) ?? null;
      this.selectedCountry = {
        id: info.id, d: '', title: info.name,
        visited: currentStatus === 'visited',
        lived: currentStatus === 'lived',
        future: currentStatus === 'future',
      };
      this.showModal = true;
    }
  }

  onScratchRevealed(): void {
    if (!this.scratchInfo) return;
    const info = this.scratchInfo;
    this.showScratch = false;
    this.scratchInfo = null;
    // Auto-save as visited
    this.applyStatus(info.id, 'visited');
    this.rebuildVisitedIds();
    this.saveMessage = 'Saving…';
    this.authService.setCountryStatus(info.id, 'visited').subscribe({
      next: () => { this.saveMessage = 'Saved'; setTimeout(() => (this.saveMessage = ''), 2000); },
      error: () => {
        this.applyStatus(info.id, null);
        this.rebuildVisitedIds();
        this.saveMessage = 'Could not save. Please sign in again.';
        setTimeout(() => (this.saveMessage = ''), 3000);
      },
    });
  }

  onScratchClosed(): void {
    this.showScratch = false;
    this.scratchInfo = null;
    // Re-sync globe to remove optimistic scratch
    this.visitedIds = [...this.visitedIds];
  }

  setCountryStatus(country: Country, status: string): void {
    if (!this.isCountryStatus(status)) return;
    const prev = this.statusMap.get(country.id) ?? null;
    const next: CountryStatus | null = prev === status ? null : status;
    this.applyStatus(country.id, next);
    this.rebuildVisitedIds();
    this.showModal = false;
    this.saveMessage = 'Saving…';
    const req: Observable<unknown> = next
      ? this.authService.setCountryStatus(country.id, next)
      : this.authService.clearCountryStatus(country.id);
    req.subscribe({
      next: () => { this.saveMessage = 'Saved'; setTimeout(() => (this.saveMessage = ''), 2000); },
      error: () => {
        this.applyStatus(country.id, prev);
        this.rebuildVisitedIds();
        this.saveMessage = 'Could not save. Please sign in again.';
        setTimeout(() => (this.saveMessage = ''), 3000);
      },
    });
  }

  closeModal(): void {
    this.showModal = false;
    this.visitedIds = [...this.visitedIds];
  }

  private loadCountryStatuses(): void {
    this.authService.getCountryStatuses().subscribe({
      next: (statuses) => {
        this.statusMap.clear();
        statuses.forEach((s) => this.statusMap.set(s.country_id, s.status));
        this.rebuildVisitedIds();
      },
      error: (err) => {
        if (err?.status === 401) {
          this.authService.logout();
          this.router.navigate(['/login']);
        }
      },
    });
  }

  private applyStatus(id: string, status: CountryStatus | null): void {
    if (status) this.statusMap.set(id, status);
    else this.statusMap.delete(id);
  }

  private rebuildVisitedIds(): void {
    this.visitedIds = [...this.statusMap.entries()]
      .filter(([, s]) => s === 'visited' || s === 'lived')
      .map(([id]) => id);
  }

  private isCountryStatus(s: string): s is CountryStatus {
    return s === 'visited' || s === 'lived' || s === 'future';
  }
}