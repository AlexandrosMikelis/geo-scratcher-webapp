import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

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
  private readonly apiUrl = 'http://127.0.0.1:8000';
  private readonly tokenKey = 'geo_scratcher_token';

  constructor(private http: HttpClient) {}

  register(email: string, username: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/auth/register`, { email, username, password })
      .pipe(tap((response) => this.storeSession(response)));
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/auth/login`, { email, password })
      .pipe(tap((response) => this.storeSession(response)));
  }

  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/reset-password`, { token, password });
  }

  me(): Observable<AuthUser> {
    return this.http.get<AuthUser>(`${this.apiUrl}/auth/me`, {
      headers: this.authHeaders(),
    });
  }

  getCountryStatuses(): Observable<CountryStatusRecord[]> {
    return this.http.get<CountryStatusRecord[]>(`${this.apiUrl}/users/me/countries/statuses`, {
      headers: this.authHeaders(),
    });
  }

  setCountryStatus(countryId: string, status: CountryStatus): Observable<CountryStatusRecord> {
    return this.http.put<CountryStatusRecord>(
      `${this.apiUrl}/users/me/countries/${encodeURIComponent(countryId)}/status`,
      { status },
      { headers: this.authHeaders() }
    );
  }

  clearCountryStatus(countryId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/users/me/countries/${encodeURIComponent(countryId)}/status`,
      { headers: this.authHeaders() }
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

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.token ?? ''}` });
  }
}
