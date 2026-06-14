import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { EventosServicio } from '../../../compartido/servicios/eventos.servicio';
import { CabeceraComponent } from '../../../compartido/componentes/cabecera/cabecera.component';
import { Evento, prioridadEvento } from '../../../compartido/modelos/evento.modelo';

@Component({
  selector: 'app-dashboard-guardia',
  standalone: true,
  imports: [RouterLink, DatePipe, CabeceraComponent],
  templateUrl: './dashboard-guardia.component.html',
  styleUrl:    './dashboard-guardia.component.scss',
})
export class DashboardGuardiaComponent implements OnInit {
  readonly cargando  = signal(true);
  readonly criticas  = signal(0);
  readonly moderadas = signal(0);
  readonly resueltos = signal(0);
  readonly alertas   = signal<Evento[]>([]);

  constructor(private eventosSrv: EventosServicio) {}

  ngOnInit() {
    this.eventosSrv.listar().subscribe({
      next: lista => {
        const hoy = new Date().toDateString();
        this.criticas.set(lista.filter(e => prioridadEvento(e) === 'critica').length);
        this.moderadas.set(lista.filter(e => prioridadEvento(e) === 'moderada').length);
        this.resueltos.set(lista.filter(e =>
          e.estado === 'resuelto' && new Date(e.timestamp_deteccion).toDateString() === hoy
        ).length);
        this.alertas.set(lista.filter(e => e.estado === 'pendiente').slice(0, 8));
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  prioridad = prioridadEvento;

  colorPrioridad(ev: Evento): string {
    const p = prioridadEvento(ev);
    return p === 'critica' ? 'var(--peligro)' : p === 'moderada' ? 'var(--advertencia)' : 'var(--exito)';
  }

  iconoPrioridad(ev: Evento): string {
    const p = prioridadEvento(ev);
    return p === 'critica' ? 'crisis_alert' : p === 'moderada' ? 'warning' : 'check_circle';
  }
}
