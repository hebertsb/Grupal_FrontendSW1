import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { CabeceraComponent } from '../../../compartido/componentes/cabecera/cabecera.component';
import { entorno } from '../../../../environments/environment';

interface Suscripcion {
  suscripcion_id:        number;
  condominio:            number;
  plan:                  number;
  plan_nombre:           string;
  is_activo:             boolean;
  stripe_estado:         string;
  stripe_suscripcion_id: string | null;
  fecha_inicio:          string | null;
  periodo_actual_inicio: string | null;
  periodo_actual_fin:    string | null;
  cancelar_al_vencer:    boolean;
}

interface Condominio {
  condominio_id: number;
  nombre:        string;
}

interface SuscripcionVista extends Suscripcion {
  condominio_nombre: string;
}

const ESTADO_ETIQUETA: Record<string, string> = {
  active:             'Activo',
  trialing:           'Prueba',
  past_due:           'Pago pendiente',
  canceled:           'Cancelado',
  incomplete:         'Incompleto',
  incomplete_expired: 'Expirado',
  unpaid:             'Impago',
  paused:             'Pausado',
};

@Component({
  selector: 'app-suscripciones-superadmin',
  standalone: true,
  imports: [RouterLink, CabeceraComponent],
  templateUrl: './suscripciones-superadmin.component.html',
  styleUrl: './suscripciones-superadmin.component.scss',
})
export class SuscripcionesSuperAdminComponent implements OnInit {
  private http = inject(HttpClient);

  readonly cargando      = signal(true);
  readonly suscripciones = signal<SuscripcionVista[]>([]);

  readonly totalActivas   = computed(() => this.suscripciones().filter(s => s.is_activo).length);
  readonly totalCanceladas = computed(() => this.suscripciones().filter(s => s.stripe_estado === 'canceled').length);
  readonly totalPendientes = computed(() => this.suscripciones().filter(s => s.stripe_estado === 'past_due').length);

  ngOnInit() {
    Promise.all([
      this.http.get<Condominio[]>(`${entorno.apiUrl}/condominios/`).toPromise(),
      this.http.get<Suscripcion[]>(`${entorno.apiUrl}/condominios/suscripciones/`).toPromise(),
    ]).then(([condominios, subs]) => {
      const mapaCondominios = new Map((condominios ?? []).map(c => [c.condominio_id, c.nombre]));
      this.suscripciones.set((subs ?? []).map(s => ({
        ...s,
        condominio_nombre: mapaCondominios.get(s.condominio) ?? `Condominio ${s.condominio}`,
      })));
      this.cargando.set(false);
    }).catch(() => this.cargando.set(false));
  }

  colorEstado(s: SuscripcionVista): string {
    if (s.is_activo)                      return 'var(--exito)';
    if (s.stripe_estado === 'past_due')   return 'var(--advertencia)';
    if (s.stripe_estado === 'canceled')   return 'var(--peligro)';
    return 'var(--texto-2)';
  }

  etiquetaEstado(s: SuscripcionVista): string {
    return ESTADO_ETIQUETA[s.stripe_estado] ?? s.stripe_estado;
  }

  formatFecha(fecha: string | null): string {
    if (!fecha) return '—';
    return fecha.substring(0, 10);
  }
}
