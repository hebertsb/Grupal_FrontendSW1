import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { entorno } from '../../../environments/environment';
import { Camara } from '../modelos/camara.modelo';

export interface ZonaRoi {
  roi_id?:               number;
  camara:                number;
  tipo_zona:             string;
  poligono_coordenadas:  number[][];
}

@Injectable({ providedIn: 'root' })
export class CamarasServicio {
  private readonly base      = `${entorno.apiUrl}/camaras`;
  private readonly baseZonas = `${entorno.apiUrl}/camaras/zonas-roi`;

  constructor(private http: HttpClient) {}

  listar()             { return this.http.get<Camara[]>(this.base + '/'); }
  obtener(id: number)  { return this.http.get<Camara>(`${this.base}/${id}/`); }
  crear(datos: Partial<Camara>)              { return this.http.post<Camara>(this.base + '/', datos); }
  actualizar(id: number, datos: Partial<Camara>) { return this.http.patch<Camara>(`${this.base}/${id}/`, datos); }
  eliminar(id: number)                       { return this.http.delete<void>(`${this.base}/${id}/`); }

  // Zonas ROI
  listarZonas(camaraId: number)    { return this.http.get<ZonaRoi[]>(`${this.baseZonas}/?camara=${camaraId}`); }
  crearZona(zona: ZonaRoi)         { return this.http.post<ZonaRoi>(this.baseZonas + '/', zona); }
  eliminarZona(roiId: number)      { return this.http.delete<void>(`${this.baseZonas}/${roiId}/`); }
}
