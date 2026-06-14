import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { entorno } from '../../../environments/environment';

export interface PosicionCamara {
  posicion_id?: number;
  plano:         number;
  camara:        number;
  nombre_camara?: string;
  pos_x:         number;
  pos_y:         number;
}

export interface PlanoCondominio {
  plano_id?:   number;
  condominio:  number;
  nombre:      string;
  imagen_url:  string;
  created_at?: string;
  posiciones?: PosicionCamara[];
}

@Injectable({ providedIn: 'root' })
export class PlanosServicio {
  private readonly base = `${entorno.apiUrl}/camaras/planos`;

  constructor(private http: HttpClient) {}

  listar(condominioId: number) {
    return this.http.get<PlanoCondominio[]>(`${this.base}/?condominio=${condominioId}`);
  }

  crear(form: FormData) {
    return this.http.post<PlanoCondominio>(`${this.base}/`, form);
  }

  eliminar(planoId: number) {
    return this.http.delete<void>(`${this.base}/${planoId}/`);
  }

  listarPosiciones(planoId: number) {
    return this.http.get<PosicionCamara[]>(`${this.base}/${planoId}/posiciones/`);
  }

  guardarPosicion(planoId: number, camaraId: number, posX: number, posY: number) {
    return this.http.post<PosicionCamara>(`${this.base}/${planoId}/posiciones/`, {
      camara_id: camaraId,
      pos_x: posX,
      pos_y: posY,
    });
  }

  eliminarPosicion(planoId: number, camaraId: number) {
    return this.http.delete<void>(`${this.base}/${planoId}/posiciones/${camaraId}/`);
  }
}
