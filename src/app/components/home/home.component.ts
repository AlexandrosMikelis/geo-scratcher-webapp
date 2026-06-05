import { Component, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { GlobeExplorerComponent } from '../globe-explorer/globe-explorer.component';
import { CountryInfo } from '../globe-explorer/globe-explorer.types';
import { CountryStatusModalComponent } from '../country-status-modal/country-status-modal.component';
import { AuthService, CountryStatus } from '../../services/auth.service';
import { Country } from '../../interfaces/country';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, GlobeExplorerComponent, CountryStatusModalComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements AfterViewInit {
  visitedIds: string[] = [];

  selectedCountry: Country | null = null;
  showModal = false;
  saveMessage = '';
  isLoadingStatuses = false;

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
    const currentStatus = this.statusMap.get(info.id) ?? null;
    this.selectedCountry = {
      id: info.id,
      d: '',
      title: info.name,
      visited: currentStatus === 'visited',
      lived: currentStatus === 'lived',
      future: currentStatus === 'future',
    };
    this.showModal = true;
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
      },
    });
  }

  closeModal(): void {
    this.showModal = false;
    // Re-sync globe to API state in case the globe internally scratched the country
    this.visitedIds = [...this.visitedIds];
  }

  private loadCountryStatuses(): void {
    this.isLoadingStatuses = true;
    this.authService.getCountryStatuses().subscribe({
      next: (statuses) => {
        this.statusMap.clear();
        statuses.forEach((s) => this.statusMap.set(s.country_id, s.status));
        this.rebuildVisitedIds();
        this.isLoadingStatuses = false;
      },
      error: (err) => {
        this.isLoadingStatuses = false;
        if (err?.status === 401) {
          this.authService.logout();
          this.router.navigate(['/login']);
        }
        // For other errors (API down, network issue) just show empty globe
      },
    });
  }

  private applyStatus(id: string, status: CountryStatus | null): void {
    if (status) {
      this.statusMap.set(id, status);
    } else {
      this.statusMap.delete(id);
    }
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