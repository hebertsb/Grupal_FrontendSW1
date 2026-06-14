import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AutenticacionServicio } from '../../../compartido/servicios/autenticacion.servicio';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  readonly cargando = signal(false);
  readonly error    = signal('');

  formulario: FormGroup;

  constructor(
    private fb: FormBuilder,
    private auth: AutenticacionServicio,
    private router: Router,
  ) {
    this.formulario = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  enviar() {
    if (this.formulario.invalid) return;
    this.cargando.set(true);
    this.error.set('');

    this.auth.iniciarSesion(this.formulario.value).subscribe({
      next:  () => this.router.navigate([this.auth.esAdmin() ? '/dashboard' : '/guardia']),
      error: (e) => {
        this.error.set(e.error?.detail ?? 'Credenciales incorrectas');
        this.cargando.set(false);
      },
    });
  }
}
