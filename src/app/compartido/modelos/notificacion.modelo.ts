export type EstadoNotificacion = 'enviada' | 'leida' | 'fallida';

export interface Notificacion {
  notificacion_id: number;
  evento_id?: number;
  usuario_id: number;
  titulo: string;
  cuerpo?: string;
  estado: EstadoNotificacion;
  created_at: string;
}
