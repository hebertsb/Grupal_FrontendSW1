import { Component, inject } from '@angular/core';
import { TemaServicio } from '../../servicios/tema.servicio';

@Component({
  selector: 'app-cabecera',
  standalone: true,
  templateUrl: './cabecera.component.html',
  styleUrl: './cabecera.component.scss',
})
export class CabeceraComponent {
  private tema = inject(TemaServicio);

  readonly temaActual = this.tema.temaActual;

  alternarTema() { this.tema.alternar(); }
}
