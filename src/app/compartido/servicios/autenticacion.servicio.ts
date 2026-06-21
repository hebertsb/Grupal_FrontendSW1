import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { entorno } from '../../../environments/environment';
import { CredencialesLogin, DatosRegistro, SesionUsuario, Usuario } from '../modelos/usuario.modelo';
import { NotificacionesServicio } from './notificaciones.servicio';

const CLAVE_TOKEN   = 'sivic_token';
const CLAVE_USUARIO = 'sivic_usuario';

@Injectable({ providedIn: 'root' })
export class AutenticacionServicio {
  readonly usuarioActual = signal<Usuario | null>(this._cargarUsuario());
  private notif = inject(NotificacionesServicio);

  constructor(private http: HttpClient, private router: Router) {
    // Reconectar WS si ya hay sesión activa (recarga de página)
    const token = this.obtenerToken();
    if (token) this.notif.conectar(token);
  }

  iniciarSesion(credenciales: CredencialesLogin) {
    return this.http.post<SesionUsuario>(`${entorno.apiUrl}/auth/login/`, credenciales).pipe(
      tap(sesion => {
        localStorage.setItem(CLAVE_TOKEN, sesion.access);
        localStorage.setItem(CLAVE_USUARIO, JSON.stringify(sesion.usuario));
        this.usuarioActual.set(sesion.usuario);
        this.notif.conectar(sesion.access);
      })
    );
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
    this.usuarioActual.set(null);
    this.router.navigate(['/login']);
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
}
