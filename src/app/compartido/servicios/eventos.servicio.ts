import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { entorno } from '../../../environments/environment';
import { Evento, EstadoEvento } from '../modelos/evento.modelo';

@Injectable({ providedIn: 'root' })
export class EventosServicio {
  private readonly base = `${entorno.apiUrl}/eventos`;

  constructor(private http: HttpClient) {}

  listar(params?: { estado?: EstadoEvento; camara_id?: number }) {
    return this.http.get<Evento[]>(this.base + '/', { params: params as any });
  }

  obtener(id: number) { return this.http.get<Evento>(`${this.base}/${id}/`); }

  actualizarEstado(id: number, estado: EstadoEvento, resolucion?: string) {
    return this.http.patch<Evento>(`${this.base}/${id}/estado/`, { estado, resolucion });
  }

  estadoEtiqueta(estado: EstadoEvento): string {
    const m: Record<EstadoEvento, string> = {
      pendiente:    'Pendiente',
      en_atencion:  'En Atención',
      resuelto:     'Resuelto',
      falsa_alarma: 'Falsa Alarma',
    };
    return m[estado] ?? estado;
  }
}
