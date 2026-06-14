import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/environment';
import { AutenticacionServicio } from './autenticacion.servicio';

export interface Deteccion {
  clase:     string;
  confianza: number;
  bbox: { x: number; y: number; w: number; h: number };
}

export interface ResultadoAnalisis {
  detecciones: Deteccion[];
  aviso?: string;
  error?: string;
}

export interface ResultadoConexion {
  ok:      boolean;
  mensaje: string;
}

@Injectable({ providedIn: 'root' })
export class IaServicio {
  private http = inject(HttpClient);
  private auth = inject(AutenticacionServicio);

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.obtenerToken() ?? ''}` });
  }

  analizarFrame(imagen: Blob): Observable<ResultadoAnalisis> {
    const fd = new FormData();
    fd.append('imagen', imagen, 'frame.jpg');
    return this.http.post<ResultadoAnalisis>(
      `${entorno.apiUrl}/camaras/analizar/`,
      fd,
      { headers: this.headers() }
    );
  }

  probarConexion(rtspUrl: string): Observable<ResultadoConexion> {
    return this.http.post<ResultadoConexion>(
      `${entorno.apiUrl}/camaras/probar/`,
      { rtsp_url: rtspUrl },
      { headers: this.headers() }
    );
  }
}
