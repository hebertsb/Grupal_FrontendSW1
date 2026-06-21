import { Component, OnInit, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CabeceraComponent } from '../../../compartido/componentes/cabecera/cabecera.component';
import { entorno } from '../../../../environments/environment';

interface Condominio {
  condominio_id:     number;
  nombre:            string;
  ubicacion:         string;
  stripe_cliente_id: string | null;
}

interface Suscripcion {
  suscripcion_id:    number;
  condominio:        number;
  plan_nombre:       string;
  is_activo:         boolean;
  stripe_estado:     string;
  fecha_inicio:      string;
  periodo_actual_fin: string | null;
}

interface CondominioFila extends Condominio {
  suscripcion?: Suscripcion;
}

interface StatCard { etiqueta: string; valor: number | string; icono: string; color: string; }

@Component({
  selector: 'app-dashboard-superadmin',
  standalone: true,
  imports: [RouterLink, CabeceraComponent],
  templateUrl: './dashboard-superadmin.component.html',
  styleUrl: './dashboard-superadmin.component.scss',
})
export class DashboardSuperAdminComponent implements OnInit {
  private http = inject(HttpClient);

  readonly cargando     = signal(true);
  readonly stats        = signal<StatCard[]>([]);
  readonly condominios  = signal<CondominioFila[]>([]);

  ngOnInit() {
    forkJoin({
      condominios:   this.http.get<Condominio[]>(`${entorno.apiUrl}/condominios/`),
      suscripciones: this.http.get<Suscripcion[]>(`${entorno.apiUrl}/suscripciones/`),
    }).subscribe({
      next: ({ condominios, suscripciones }) => {
        const filas: CondominioFila[] = condominios.map(c => ({
          ...c,
          suscripcion: suscripciones.find(s => s.condominio === c.condominio_id),
        }));

        const activos = filas.filter(f => f.suscripcion?.is_activo).length;

        this.stats.set([
          { etiqueta: 'Total condominios',   valor: condominios.length, icono: 'apartment',          color: 'var(--primario)'    },
          { etiqueta: 'Condominios activos', valor: activos,            icono: 'check_circle',        color: 'var(--exito)'       },
          { etiqueta: 'Sin suscripción',     valor: condominios.length - suscripciones.length,
                                                                         icono: 'warning',             color: 'var(--advertencia)' },
          { etiqueta: 'Suspendidos',         valor: filas.filter(f => f.suscripcion && !f.suscripcion.is_activo).length,
                                                                         icono: 'block',               color: 'var(--peligro)'     },
        ]);

        this.condominios.set(filas);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  colorEstado(fila: CondominioFila): string {
    if (!fila.suscripcion)          return 'var(--texto-2)';
    if (fila.suscripcion.is_activo) return 'var(--exito)';
    return 'var(--peligro)';
  }

  etiquetaEstado(fila: CondominioFila): string {
    if (!fila.suscripcion) return 'Sin suscripción';
    const estado = fila.suscripcion.stripe_estado;
    const mapa: Record<string, string> = {
      active:   'Activo',
      trialing: 'Prueba',
      past_due: 'Pago pendiente',
      canceled: 'Cancelado',
      incomplete: 'Incompleto',
    };
    return mapa[estado] ?? estado;
  }
}
