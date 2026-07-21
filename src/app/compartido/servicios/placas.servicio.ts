import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { entorno } from '../../../environments/environment';
import { PlacaRegistrada } from '../modelos/placa.modelo';

@Injectable({ providedIn: 'root' })
export class PlacasServicio {
  private readonly base = `${entorno.apiUrl}/placas`;

  constructor(private http: HttpClient) {}

  listar()                                         { return this.http.get<PlacaRegistrada[]>(this.base + '/'); }
  crear(datos: Partial<PlacaRegistrada>)           { return this.http.post<PlacaRegistrada>(this.base + '/', datos); }
  actualizar(id: string, datos: Partial<PlacaRegistrada>) { return this.http.patch<PlacaRegistrada>(`${this.base}/${id}/`, datos); }
  eliminar(id: string)                             { return this.http.delete<void>(`${this.base}/${id}/`); }
}
