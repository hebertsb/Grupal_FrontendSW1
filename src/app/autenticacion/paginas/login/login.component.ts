import { Component, OnInit, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AutenticacionServicio } from '../../../compartido/servicios/autenticacion.servicio';
import { entorno } from '../../../../environments/environment';

interface PlanApi {
  plan_id:         number;
  nombre:          string;
  precio_mensual:  string;
  funcionalidades: { funcionalidad: string }[];
}

interface PlanInfo {
  plan_id:         number;
  nombre:          string;
  precio:          string;
  icono:           string;
  destacado:       boolean;
  funcionalidades: string[];
}

const ETIQUETAS: Record<string, string> = {
  deteccion_ia:        'Detección IA en tiempo real',
  panel_camaras:       'Panel de cámaras',
  alertas_basicas:     'Alertas básicas',
  reglas_roi:          'Reglas y ROI por cámara',
  gestion_usuarios:    'Gestión de usuarios',
  auditoria:           'Logs de auditoría',
  reportes_ia:         'Reportes IA exportables',
  plano_condominio:    'Plano del condominio',
  notificaciones_push: 'Notificaciones push',
  detectar_parqueo:    'Detección de parqueo',
  detectar_mascotas:   'Detección de mascotas',
  generar_reportes:    'Generación de reportes',
};

const ICONOS: Record<string, string> = {
  'Básico':    'shield',
  'Estándar':  'bolt',
  'Premium':   'workspace_premium',
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private http   = inject(HttpClient);
  private fb     = inject(FormBuilder);
  private auth   = inject(AutenticacionServicio);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  readonly cargando         = signal(false);
  readonly error            = signal('');
  readonly exito            = signal('');
  readonly modo             = signal<'login' | 'registro'>('login');
  readonly planesSignal     = signal<PlanInfo[]>([]);
  readonly planSeleccionado = signal<PlanInfo | null>(null);

  get planes() { return this.planesSignal(); }

  formularioLogin:    FormGroup;
  formularioRegistro: FormGroup;

  constructor() {
    this.formularioLogin = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
    this.formularioRegistro = this.fb.group({
      nombre:            ['', Validators.required],
      email:             ['', [Validators.required, Validators.email]],
      password:          ['', [Validators.required, Validators.minLength(8)]],
      nombre_condominio: ['', Validators.required],
      ubicacion:         [''],
    });
  }

  ngOnInit() {
    this.http.get<PlanApi[]>(`${entorno.apiUrl}/condominios/planes/`).subscribe({
      next: planes => {
        const ordenados = [...planes].sort((a, b) => +a.precio_mensual - +b.precio_mensual);
        const infos = ordenados.map((p, i) => ({
          plan_id:   p.plan_id,
          nombre:    p.nombre,
          precio:    `$${(+p.precio_mensual).toFixed(0)}/mes`,
          icono:     ICONOS[p.nombre] ?? 'star',
          destacado: i === 1,
          funcionalidades: p.funcionalidades
            .slice(0, 4)
            .map(f => ETIQUETAS[f.funcionalidad] ?? f.funcionalidad),
        }));
        this.planesSignal.set(infos);
        this.planSeleccionado.set(infos[1] ?? infos[0] ?? null);
      },
    });

    // Si Stripe redirigió con ?pago=ok&session_id=xxx, confirmar la suscripción
    this.route.queryParams.subscribe(params => {
      if (params['pago'] === 'ok') {
        // Cerrar cualquier sesión temporal guardada durante el registro
        this.auth.cerrarSesionSilenciosa();
        // Limpiar query params de la URL
        this.router.navigate(['/login'], { replaceUrl: true });

        if (params['session_id']) {
          this.http.post(
            `${entorno.apiUrl}/pagos/confirmar-sesion/`,
            { session_id: params['session_id'] },
          ).subscribe();
        }

        this.exito.set('¡Pago completado! Ya puedes iniciar sesión con tu cuenta.');
        this.modo.set('login');
      }
    });
  }

  seleccionarPlan(plan: PlanInfo) {
    this.planSeleccionado.set(plan);
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
      next:  () => this.router.navigate(['/']),
      error: (e) => {
        this.error.set(e.error?.detail ?? 'Credenciales incorrectas');
        this.cargando.set(false);
      },
    });
  }

  enviarRegistro() {
    if (this.formularioRegistro.invalid) return;
    if (!this.planSeleccionado()) { this.error.set('Seleccioná un plan.'); return; }
    this.cargando.set(true);
    this.error.set('');

    const origen = window.location.origin;
    const body = {
      ...this.formularioRegistro.value,
      plan_id:         this.planSeleccionado()!.plan_id,
      url_exito:       `${origen}/login?pago=ok&session_id={CHECKOUT_SESSION_ID}`,
      url_cancelacion: `${origen}/login?pago=cancelado`,
    };

    this.http.post<{ access: string; checkout_url: string }>(`${entorno.apiUrl}/auth/registro-completo/`, body).subscribe({
      next: res => {
        // No guardar sesión aquí — el usuario debe loguearse manualmente tras el pago
        window.location.href = res.checkout_url;
      },
      error: (e) => {
        this.error.set(e.error?.error ?? 'Error al registrar');
        this.cargando.set(false);
      },
    });
  }
}
