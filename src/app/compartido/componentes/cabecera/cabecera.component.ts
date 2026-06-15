import { Component, inject, signal, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TemaServicio } from '../../servicios/tema.servicio';
import { NotificacionesServicio, AlertaWS } from '../../servicios/notificaciones.servicio';

@Component({
  selector: 'app-cabecera',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './cabecera.component.html',
  styleUrl: './cabecera.component.scss',
})
export class CabeceraComponent {
  private tema  = inject(TemaServicio);
  readonly notif = inject(NotificacionesServicio);

  readonly temaActual       = this.tema.temaActual;
  readonly dropdownAbierto  = signal(false);

  alternarTema() { this.tema.alternar(); }

  toggleDropdown() { this.dropdownAbierto.update(v => !v); }

  abrirAlerta(a: AlertaWS) {
    this.notif.marcarLeida(a.evento_id);
    this.dropdownAbierto.set(false);
  }

  limpiarTodas() {
    this.notif.marcarTodasLeidas();
    this.dropdownAbierto.set(false);
  }

  @HostListener('document:click', ['$event'])
  clickFuera(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.campana-wrap')) {
      this.dropdownAbierto.set(false);
    }
  }
}
