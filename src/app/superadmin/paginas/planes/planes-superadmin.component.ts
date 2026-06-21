import { Component, OnInit, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { CabeceraComponent } from '../../../compartido/componentes/cabecera/cabecera.component';
import { entorno } from '../../../../environments/environment';

interface Funcionalidad { funcionalidad: string; }

interface Plan {
  plan_id:          number;
  nombre:           string;
  precio_mensual:   string;
  funcionalidades:  Funcionalidad[];
  activos?:         number;
}

const ETIQUETAS: Record<string, string> = {
  deteccion_ia:        'Detección IA en tiempo real',
  panel_camaras:       'Panel de cámaras',
  alertas_basicas:     'Alertas básicas',
  reglas_roi:          'Reglas y ROI por cámara',
  gestion_usuarios:    'Gestión de usuarios',
  auditoria:           'Logs de auditoría',
  reportes_ia:         'Reportes IA exportables',
  plano_condominio:    'Plano del condominio',
  notificaciones_push: 'Notificaciones push',
};

@Component({
  selector: 'app-planes-superadmin',
  standalone: true,
  imports: [RouterLink, CabeceraComponent],
  templateUrl: './planes-superadmin.component.html',
  styleUrl: './planes-superadmin.component.scss',
})
export class PlanesSuperAdminComponent implements OnInit {
  private http = inject(HttpClient);

  readonly cargando = signal(true);
  readonly planes   = signal<Plan[]>([]);

  readonly etiquetas = ETIQUETAS;

  ngOnInit() {
    Promise.all([
      this.http.get<Plan[]>(`${entorno.apiUrl}/condominios/planes/`).toPromise(),
      this.http.get<any[]>(`${entorno.apiUrl}/condominios/suscripciones/`).toPromise(),
    ]).then(([planes, subs]) => {
      this.planes.set((planes ?? []).map(p => ({
        ...p,
        activos: (subs ?? []).filter(s => s.plan === p.plan_id && s.is_activo).length,
      })));
      this.cargando.set(false);
    }).catch(() => this.cargando.set(false));
  }

  etiquetaFuncionalidad(f: string): string {
    return ETIQUETAS[f] ?? f;
  }

  colorPlan(nombre: string): string {
    if (nombre === 'Premium') return 'var(--advertencia)';
    if (nombre === 'Estándar') return 'var(--primario)';
    return 'var(--texto-2)';
  }
}
