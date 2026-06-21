import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { entorno } from '../../../environments/environment';
import { CredencialesLogin, DatosRegistro, SesionUsuario, Usuario } from '../modelos/usuario.modelo';
import { NotificacionesServicio } from './notificaciones.servicio';

const CLAVE_TOKEN   = 'sivic_token';
const CLAVE_USUARIO = 'sivic_usuario';
const CLAVE_FUNCS   = 'sivic_funcionalidades';

@Injectable({ providedIn: 'root' })
export class AutenticacionServicio {
  readonly usuarioActual    = signal<Usuario | null>(this._cargarUsuario());
  /** null = todavía cargando; [] = sin plan; [...] = plan activo */
  readonly funcionalidades  = signal<string[] | null>(this._cargarFuncionalidades());
  private notif = inject(NotificacionesServicio);

  constructor(private http: HttpClient, private router: Router) {
    const token = this.obtenerToken();
    if (token) {
      this.notif.conectar(token);
      const cached = this._cargarFuncionalidades();
      // Si no hay cache o está vacía, pedir al backend
      if (!cached || !cached.length) {
        this.cargarPlan();
      }
    }
  }

  iniciarSesion(credenciales: CredencialesLogin) {
    return this.http.post<SesionUsuario>(`${entorno.apiUrl}/auth/login/`, credenciales).pipe(
      tap(sesion => {
        localStorage.setItem(CLAVE_TOKEN, sesion.access);
        localStorage.setItem(CLAVE_USUARIO, JSON.stringify(sesion.usuario));
        this.usuarioActual.set(sesion.usuario);
        this.notif.conectar(sesion.access);
        this.cargarPlan();
      })
    );
  }

  /** Carga el plan y funcionalidades activas del usuario desde el backend. */
  cargarPlan() {
    this.http.get<{ plan: string | null; funcionalidades: string[] }>(
      `${entorno.apiUrl}/auth/mi-plan/`
    ).subscribe({
      next: res => {
        localStorage.setItem(CLAVE_FUNCS, JSON.stringify(res.funcionalidades));
        this.funcionalidades.set(res.funcionalidades);
      },
    });
  }

  /** Devuelve true si el plan activo incluye la funcionalidad indicada. */
  tieneFuncionalidad(func: string): boolean {
    const funcs = this.funcionalidades();
    if (funcs === null) return true; // todavía cargando → no ocultar
    return funcs.includes(func);    // [] → false; [...] → según plan
  }

  registrar(datos: DatosRegistro) {
    return this.http.post<SesionUsuario>(`${entorno.apiUrl}/auth/registro/`, datos).pipe(
      tap(sesion => {
        localStorage.setItem(CLAVE_TOKEN, sesion.access);
        localStorage.setItem(CLAVE_USUARIO, JSON.stringify(sesion.usuario));
        this.usuarioActual.set(sesion.usuario);
      })
    );
  }

  cerrarSesion() {
    this.notif.desconectar();
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
    localStorage.removeItem(CLAVE_FUNCS);
    this.usuarioActual.set(null);
    this.funcionalidades.set(null);
    this.router.navigate(['/login']);
  }

  /** Limpia la sesión en memoria y localStorage sin redirigir (uso interno post-registro). */
  cerrarSesionSilenciosa() {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
    localStorage.removeItem(CLAVE_FUNCS);
    this.usuarioActual.set(null);
    this.funcionalidades.set(null);
  }

  obtenerToken(): string | null {
    return localStorage.getItem(CLAVE_TOKEN);
  }

  guardarSesion(access: string, usuario: Usuario) {
    localStorage.setItem(CLAVE_TOKEN, access);
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
    this.usuarioActual.set(usuario);
  }

  estaAutenticado(): boolean {
    return !!this.obtenerToken();
  }

  esAdmin(): boolean {
    return this.usuarioActual()?.rol === 'admin';
  }

  esSuperAdmin(): boolean {
    return this.usuarioActual()?.rol === 'superadmin';
  }

  private _cargarUsuario(): Usuario | null {
    try {
      const datos = localStorage.getItem(CLAVE_USUARIO);
      return datos ? JSON.parse(datos) : null;
    } catch {
      return null;
    }
  }

  private _cargarFuncionalidades(): string[] | null {
    try {
      const datos = localStorage.getItem(CLAVE_FUNCS);
      if (!datos) return null;
      const parsed = JSON.parse(datos);
      return Array.isArray(parsed) && parsed.length ? parsed : null;
    } catch {
      return null;
    }
  }
}
