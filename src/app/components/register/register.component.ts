import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private formBuilder = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  isSubmitting = false;
  error = '';

  registerForm = this.formBuilder.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[A-Za-z0-9_.-]+$/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  register(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.error = '';
    const { email, username, password } = this.registerForm.getRawValue();

    this.authService.register(email, username, password).subscribe({
      next: () => this.router.navigate(['/home']),
      error: (response) => {
        this.error = response.status === 0
          ? 'API server is unavailable. Start it with npm run start:api.'
          : response.error?.detail ?? 'Registration failed';
        this.isSubmitting = false;
      },
      complete: () => {
        this.isSubmitting = false;
      }
    });
  }

}
