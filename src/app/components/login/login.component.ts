import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private formBuilder = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  isForgotPassword = false;
  isResetPassword = false;
  isSubmitting = false;
  message = '';
  error = '';
  resetToken = '';

  loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  forgotForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  resetForm = this.formBuilder.nonNullable.group({
    token: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  login(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.error = '';
    const { email, password } = this.loginForm.getRawValue();

    this.authService.login(email, password).subscribe({
      next: () => this.router.navigate(['/home']),
      error: (response) => {
        this.error = response.error?.detail ?? 'Login failed';
        this.isSubmitting = false;
      },
      complete: () => {
        this.isSubmitting = false;
      }
    });
  }

  forgotPassword(): void {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.error = '';
    this.message = '';
    this.resetToken = '';

    this.authService.forgotPassword(this.forgotForm.getRawValue().email).subscribe({
      next: (response) => {
        this.message = response.message;
        this.resetToken = response.reset_token ?? '';
        if (this.resetToken) {
          this.resetForm.patchValue({ token: this.resetToken });
          this.isResetPassword = true;
        }
      },
      error: (response) => {
        this.error = response.error?.detail ?? 'Password reset request failed';
        this.isSubmitting = false;
      },
      complete: () => {
        this.isSubmitting = false;
      }
    });
  }

  resetPassword(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.error = '';
    this.message = '';
    const { token, password } = this.resetForm.getRawValue();

    this.authService.resetPassword(token, password).subscribe({
      next: (response) => {
        this.message = response.message;
        this.isForgotPassword = false;
        this.isResetPassword = false;
        this.loginForm.patchValue({ email: this.forgotForm.getRawValue().email, password: '' });
      },
      error: (response) => {
        this.error = response.error?.detail ?? 'Password reset failed';
        this.isSubmitting = false;
      },
      complete: () => {
        this.isSubmitting = false;
      }
    });
  }

  showForgotPassword(): void {
    this.error = '';
    this.message = '';
    this.isForgotPassword = true;
  }

  showLogin(): void {
    this.error = '';
    this.message = '';
    this.isForgotPassword = false;
    this.isResetPassword = false;
  }

}
