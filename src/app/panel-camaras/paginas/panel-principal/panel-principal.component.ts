import { Component, OnInit, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { CamarasServicio } from '../../../compartido/servicios/camaras.servicio';
import { Camara } from '../../../compartido/modelos/camara.modelo';
import { CuadriculaCamarasComponent, LayoutCuadricula } from '../../componentes/cuadricula-camaras/cuadricula-camaras.component';
import { CabeceraComponent } from '../../../compartido/componentes/cabecera/cabecera.component';

interface OpcionLayout { columnas: LayoutCuadricula; icono: string; titulo: string; }

@Component({
  selector: 'app-panel-principal',
  standalone: true,
  imports: [NgClass, CuadriculaCamarasComponent, CabeceraComponent],
  templateUrl: './panel-principal.component.html',
  styleUrl: './panel-principal.component.scss',
})
export class PanelPrincipalComponent implements OnInit {
  readonly camaras         = signal<Camara[]>([]);
  readonly cargando        = signal(true);
  readonly columnas        = signal<LayoutCuadricula>(2);
  readonly camaraFoco      = signal<Camara | null>(null);

  readonly opcionesLayout: OpcionLayout[] = [
    { columnas: 1, icono: 'crop_square',    titulo: '1×1' },
    { columnas: 2, icono: 'grid_view',      titulo: '2×2' },
    { columnas: 3, icono: 'apps',           titulo: '3×3' },
    { columnas: 4, icono: 'grid_on',        titulo: '4×4' },
  ];

  constructor(private camarasSrv: CamarasServicio) {}

  ngOnInit() {
    this.camarasSrv.listar().subscribe({
      next: lista => {
        this.camaras.set(lista.filter(c => c.is_active));
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  seleccionarCamara(camara: Camara) {
    this.camaraFoco.set(
      this.camaraFoco()?.camara_id === camara.camara_id ? null : camara
    );
  }

  cambiarLayout(cols: LayoutCuadricula) {
    this.columnas.set(cols);
    this.camaraFoco.set(null);
  }

  camarasVisibles(): Camara[] {
    const foco = this.camaraFoco();
    return foco ? [foco] : this.camaras();
  }

  columnasVisibles(): LayoutCuadricula {
    return this.camaraFoco() ? 1 : this.columnas();
  }
}
