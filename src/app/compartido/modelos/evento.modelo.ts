export type EstadoEvento = 'pendiente' | 'en_atencion' | 'resuelto' | 'falsa_alarma';
export type PrioridadEvento = 'critica' | 'moderada' | 'normal';

export interface Evento {
  evento_id:             number;
  camara:                number;
  camara_nombre?:        string;
  regla:                 number;
  regla_nombre?:         string;
  confianza_ia:          number;
  imagen_evidencia_path?: string;
  resolucion?:           string;
  estado:                EstadoEvento;
  tiempo_respuesta?:     string;
  atendido_por?:         number;
  atendido_nombre?:      string;
  timestamp_deteccion:   string;
}

export function prioridadEvento(ev: Evento): PrioridadEvento {
  if (ev.estado === 'resuelto' || ev.estado === 'falsa_alarma') return 'normal';
  if (ev.confianza_ia >= 0.80) return 'critica';
  return 'moderada';
}
