import { Component, Input, Output, EventEmitter } from '@angular/core';
import { NgClass } from '@angular/common';
import { Camara } from '../../../compartido/modelos/camara.modelo';
import { CeldaCamaraComponent } from '../celda-camara/celda-camara.component';

export type LayoutCuadricula = 1 | 2 | 3 | 4;

@Component({
  selector: 'app-cuadricula-camaras',
  standalone: true,
  imports: [NgClass, CeldaCamaraComponent],
  templateUrl: './cuadricula-camaras.component.html',
  styleUrl: './cuadricula-camaras.component.scss',
})
export class CuadriculaCamarasComponent {
  @Input() camaras: Camara[] = [];
  @Input() columnas: LayoutCuadricula = 2;
  @Input() camaraSeleccionadaId: number | null = null;

  @Output() seleccionar = new EventEmitter<Camara>();

  claseLayout(): string {
    return `cuadricula-camaras--${this.columnas}col`;
  }
}
