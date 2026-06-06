import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthUser {
  id: number;
  email: string;
  username: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface ForgotPasswordResponse {
  message: string;
  reset_token: string | null;
}

export type CountryStatus = 'visited' | 'lived' | 'future';

export interface CountryStatusRecord {
  country_id: string;
  status: CountryStatus;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private readonly tokenKey = 'geo_scratcher_token';

  constructor(private http: HttpClient) {}

  register(email: string, username: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/auth/register`, { email, username, password })
      .pipe(tap((r) => this.storeSession(r)));
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/auth/login`, { email, password })
      .pipe(tap((r) => this.storeSession(r)));
  }

  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/reset-password`, { token, password });
  }

  me(): Observable<AuthUser> {
    return this.http.get<AuthUser>(`${this.apiUrl}/auth/me`);
  }

  getCountryStatuses(): Observable<CountryStatusRecord[]> {
    return this.http.get<CountryStatusRecord[]>(`${this.apiUrl}/users/me/countries/statuses`);
  }

  setCountryStatus(countryId: string, status: CountryStatus): Observable<CountryStatusRecord> {
    return this.http.put<CountryStatusRecord>(
      `${this.apiUrl}/users/me/countries/${encodeURIComponent(countryId)}/status`,
      { status }
    );
  }

  clearCountryStatus(countryId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/users/me/countries/${encodeURIComponent(countryId)}/status`
    );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
  }

  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private storeSession(response: AuthResponse): void {
    localStorage.setItem(this.tokenKey, response.access_token);
  }
}
