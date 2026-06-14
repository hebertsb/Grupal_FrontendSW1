import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { entorno } from '../../../environments/environment';
import { CredencialesLogin, SesionUsuario, Usuario } from '../modelos/usuario.modelo';

const CLAVE_TOKEN   = 'sivic_token';
const CLAVE_USUARIO = 'sivic_usuario';

@Injectable({ providedIn: 'root' })
export class AutenticacionServicio {
  readonly usuarioActual = signal<Usuario | null>(this._cargarUsuario());

  constructor(private http: HttpClient, private router: Router) {}

  iniciarSesion(credenciales: CredencialesLogin) {
    return this.http.post<SesionUsuario>(`${entorno.apiUrl}/auth/login/`, credenciales).pipe(
      tap(sesion => {
        localStorage.setItem(CLAVE_TOKEN, sesion.access);
        localStorage.setItem(CLAVE_USUARIO, JSON.stringify(sesion.usuario));
        this.usuarioActual.set(sesion.usuario);
      })
    );
  }

  cerrarSesion() {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
    this.usuarioActual.set(null);
    this.router.navigate(['/login']);
  }

  obtenerToken(): string | null {
    return localStorage.getItem(CLAVE_TOKEN);
  }

  estaAutenticado(): boolean {
    return !!this.obtenerToken();
  }

  esAdmin(): boolean {
    return this.usuarioActual()?.rol === 'admin';
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
