import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CamarasServicio } from '../../../compartido/servicios/camaras.servicio';
import { EventosServicio } from '../../../compartido/servicios/eventos.servicio';
import { CabeceraComponent } from '../../../compartido/componentes/cabecera/cabecera.component';
import { Evento } from '../../../compartido/modelos/evento.modelo';

interface Stat { etiqueta: string; valor: number; icono: string; color: string; }

@Component({
  selector: 'app-dashboard-admin',
  standalone: true,
  imports: [RouterLink, CabeceraComponent],
  templateUrl: './dashboard-admin.component.html',
  styleUrl: './dashboard-admin.component.scss',
})
export class DashboardAdminComponent implements OnInit {
  readonly cargando     = signal(true);
  readonly stats        = signal<Stat[]>([]);
  readonly recientes    = signal<Evento[]>([]);

  constructor(
    private camarasSrv: CamarasServicio,
    private eventosSrv: EventosServicio,
  ) {}

  ngOnInit() {
    forkJoin({
      camaras: this.camarasSrv.listar(),
      eventos: this.eventosSrv.listar(),
    }).subscribe({
      next: ({ camaras, eventos }) => {
        const activas   = camaras.filter(c => c.is_active).length;
        const pendientes = eventos.filter(e => e.estado === 'pendiente').length;
        const enAtencion = eventos.filter(e => e.estado === 'en_atencion').length;

        this.stats.set([
          { etiqueta: 'Cámaras activas',   valor: activas,    icono: 'videocam',                color: 'var(--exito)'       },
          { etiqueta: 'Total cámaras',      valor: camaras.length, icono: 'settings_input_component', color: 'var(--primario)'  },
          { etiqueta: 'Eventos pendientes', valor: pendientes, icono: 'notification_important',  color: 'var(--advertencia)' },
          { etiqueta: 'En atención',        valor: enAtencion, icono: 'search',                  color: 'var(--primario)'    },
        ]);

        this.recientes.set(eventos.slice(0, 6));
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  colorEstado(estado: string): string {
    return { pendiente: 'var(--advertencia)', en_atencion: 'var(--primario)', resuelto: 'var(--exito)', falsa_alarma: 'var(--texto-2)' }[estado] ?? 'var(--texto-2)';
  }

  etiquetaEstado(estado: string): string {
    return { pendiente: 'Pendiente', en_atencion: 'En Atención', resuelto: 'Resuelto', falsa_alarma: 'Falsa alarma' }[estado] ?? estado;
  }
}
