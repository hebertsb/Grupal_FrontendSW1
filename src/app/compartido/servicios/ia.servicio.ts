import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/environment';
import { AutenticacionServicio } from './autenticacion.servicio';

export interface Deteccion {
  clase:     string;
  confianza: number;
  bbox: { x: number; y: number; w: number; h: number };
  raza?: string;
  suelto?: boolean;
  clase_heces?: string;
}

export interface ResultadoAnalisis {
  detecciones:      Deteccion[];
  aviso?:           string;
  error?:           string;
  alertas?:         string[];
  raza?:            string;
  simulado?:        boolean;
  conteo_personas?: number;
  nivel?:           'normal' | 'sospechoso' | 'critico';
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
    const apiBase = entorno.apiUrl.endsWith('/api') ? entorno.apiUrl.slice(0, -4) : entorno.apiUrl;
    return this.http.post<ResultadoAnalisis>(
      `${apiBase}/identity/analizar`,
      fd,
      { headers: this.headers() }
    );
  }

  analizarFramePersona(imagen: Blob, modoFiltro: string = 'todo'): Observable<ResultadoAnalisis> {
    const fd = new FormData();
    fd.append('imagen', imagen, 'frame.jpg');
    fd.append('modo_filtro', modoFiltro);
    return this.http.post<ResultadoAnalisis>(
      `${entorno.apiUrl}/camaras/analizar_persona/`,
      fd,
      { headers: this.headers() }
    );
  }

  analizarCamaraViva(camaraId: number, modoFiltro: string = 'todo'): Observable<ResultadoAnalisis> {
    return this.http.post<ResultadoAnalisis>(
      `${entorno.apiUrl}/camaras/${camaraId}/analizar_ia/`,
      { modo_filtro: modoFiltro },
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
