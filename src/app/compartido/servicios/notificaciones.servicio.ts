import { Injectable, signal, computed } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { entorno } from '../../../environments/environment';

export interface AlertaWS {
  tipo:          'alerta';
  evento_id:     number;
  camara_nombre: string;
  regla_nombre:  string;
  confianza_ia:  number;
  timestamp:     string;
  imagen_url?:   string;
  leida?:        boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificacionesServicio {
  private ws$: WebSocketSubject<AlertaWS> | null = null;
  private _token = '';
  private _reconectar: ReturnType<typeof setTimeout> | null = null;

  readonly alertas   = signal<AlertaWS[]>([]);
  readonly noLeidas  = computed(() => this.alertas().filter(a => !a.leida).length);

  conectar(token: string) {
    if (this.ws$ && !this.ws$.closed) return;
    this._token = token;
    const url = `${entorno.wsUrl}/ws/alertas/?token=${token}`;

    this.ws$ = webSocket<AlertaWS>({ url, deserializer: e => JSON.parse(e.data) });

    this.ws$.subscribe({
      next: msg => {
        if (msg.tipo === 'alerta') {
          this.alertas.update(prev =>
            [{ ...msg, leida: false }, ...prev].slice(0, 50)
          );
        }
      },
      error: () => {
        this.ws$ = null;
        // Reintentar conexión a los 5s
        this._reconectar = setTimeout(() => this.conectar(this._token), 5000);
      },
      complete: () => { this.ws$ = null; },
    });
  }

  desconectar() {
    if (this._reconectar) clearTimeout(this._reconectar);
    this.ws$?.complete();
    this.ws$ = null;
    this.alertas.set([]);
  }

  marcarLeida(evento_id: number) {
    this.alertas.update(prev =>
      prev.map(a => a.evento_id === evento_id ? { ...a, leida: true } : a)
    );
  }

  marcarTodasLeidas() {
    this.alertas.update(prev => prev.map(a => ({ ...a, leida: true })));
  }
}
