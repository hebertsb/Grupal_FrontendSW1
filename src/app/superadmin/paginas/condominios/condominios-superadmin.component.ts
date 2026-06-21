import { Component, OnInit, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CabeceraComponent } from '../../../compartido/componentes/cabecera/cabecera.component';
import { entorno } from '../../../../environments/environment';

interface Suscripcion {
  plan_nombre:      string;
  is_activo:        boolean;
  stripe_estado:    string;
  periodo_actual_fin: string | null;
}

interface Condominio {
  condominio_id:     number;
  nombre:            string;
  ubicacion:         string;
  stripe_cliente_id: string | null;
  suscripcion?:      Suscripcion;
}

@Component({
  selector: 'app-condominios-superadmin',
  standalone: true,
  imports: [RouterLink, CabeceraComponent, FormsModule],
  templateUrl: './condominios-superadmin.component.html',
  styleUrl: './condominios-superadmin.component.scss',
})
export class CondominiosSuperAdminComponent implements OnInit {
  private http = inject(HttpClient);

  readonly cargando     = signal(true);
  readonly condominios  = signal<Condominio[]>([]);
  readonly mostrarForm  = signal(false);
  readonly guardando    = signal(false);
  readonly error        = signal<string | null>(null);

  nombre    = '';
  ubicacion = '';

  ngOnInit() {
    this._cargar();
  }

  private _cargar() {
    this.cargando.set(true);
    this.http.get<Condominio[]>(`${entorno.apiUrl}/condominios/`).subscribe({
      next: condominios => {
        this.http.get<any[]>(`${entorno.apiUrl}/condominios/suscripciones/`).subscribe({
          next: subs => {
            this.condominios.set(condominios.map(c => ({
              ...c,
              suscripcion: subs.find(s => s.condominio === c.condominio_id),
            })));
            this.cargando.set(false);
          },
          error: () => { this.condominios.set(condominios); this.cargando.set(false); },
        });
      },
      error: () => this.cargando.set(false),
    });
  }

  guardarCondominio() {
    if (!this.nombre.trim()) return;
    this.guardando.set(true);
    this.error.set(null);
    this.http.post(`${entorno.apiUrl}/condominios/`, { nombre: this.nombre.trim(), ubicacion: this.ubicacion.trim() }).subscribe({
      next: () => {
        this.nombre    = '';
        this.ubicacion = '';
        this.mostrarForm.set(false);
        this.guardando.set(false);
        this._cargar();
      },
      error: () => { this.error.set('Error al crear condominio.'); this.guardando.set(false); },
    });
  }

  colorEstado(c: Condominio): string {
    if (!c.suscripcion)          return 'var(--texto-2)';
    if (c.suscripcion.is_activo) return 'var(--exito)';
    return 'var(--peligro)';
  }

  etiquetaEstado(c: Condominio): string {
    if (!c.suscripcion) return 'Sin suscripción';
    const mapa: Record<string, string> = {
      active: 'Activo', trialing: 'Prueba',
      past_due: 'Pago pendiente', canceled: 'Cancelado', incomplete: 'Incompleto',
    };
    return mapa[c.suscripcion.stripe_estado] ?? c.suscripcion.stripe_estado;
  }
}
