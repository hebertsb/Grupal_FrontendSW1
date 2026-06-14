import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AutenticacionServicio } from '../../../compartido/servicios/autenticacion.servicio';

interface PlanInfo {
  nombre:          string;
  precio:          string;
  icono:           string;
  destacado:       boolean;
  funcionalidades: string[];
}

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
  readonly modo     = signal<'login' | 'registro'>('login');

  readonly planes: PlanInfo[] = [
    {
      nombre: 'Básico', precio: 'Gratis', icono: '🛡️', destacado: false,
      funcionalidades: ['Panel de cámaras', 'Gestión de eventos', 'Notificaciones', '1 condominio'],
    },
    {
      nombre: 'Pro', precio: '$29/mes', icono: '⚡', destacado: true,
      funcionalidades: ['Todo Básico', 'Detección parqueo', 'Detección mascotas', 'Análisis IA avanzado'],
    },
    {
      nombre: 'Premium', precio: '$79/mes', icono: '👑', destacado: false,
      funcionalidades: ['Todo Pro', 'Reportes PDF', 'API personalizada', 'Soporte 24/7'],
    },
  ];

  formularioLogin:    FormGroup;
  formularioRegistro: FormGroup;

  constructor(
    private fb:     FormBuilder,
    private auth:   AutenticacionServicio,
    private router: Router,
  ) {
    this.formularioLogin = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
    this.formularioRegistro = this.fb.group({
      nombre:   ['', Validators.required],
      email:    ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      rol:      ['guardia'],
    });
  }

  cambiarModo(modo: 'login' | 'registro') {
    this.error.set('');
    this.modo.set(modo);
  }

  enviarLogin() {
    if (this.formularioLogin.invalid) return;
    this.cargando.set(true);
    this.error.set('');
    this.auth.iniciarSesion(this.formularioLogin.value).subscribe({
      next:  () => this.router.navigate([this.auth.esAdmin() ? '/dashboard' : '/guardia']),
      error: (e) => {
        this.error.set(e.error?.detail ?? 'Credenciales incorrectas');
        this.cargando.set(false);
      },
    });
  }

  enviarRegistro() {
    if (this.formularioRegistro.invalid) return;
    this.cargando.set(true);
    this.error.set('');
    this.auth.registrar(this.formularioRegistro.value).subscribe({
      next:  () => this.router.navigate([this.auth.esAdmin() ? '/dashboard' : '/guardia']),
      error: (e) => {
        this.error.set(e.error?.error ?? e.error?.detail ?? 'Error al registrar');
        this.cargando.set(false);
      },
    });
  }
}
