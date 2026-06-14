import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { entorno } from '../../../../environments/environment';
import { CabeceraComponent } from '../../../compartido/componentes/cabecera/cabecera.component';

interface ReglaInfraccion {
  regla_id:    number;
  nombre_regla: string;
  descripcion?: string;
}

@Component({
  selector: 'app-gestion-reglas',
  standalone: true,
  imports: [FormsModule, CabeceraComponent],
  templateUrl: './gestion-reglas.component.html',
  styleUrl:    './gestion-reglas.component.scss',
})
export class GestionReglasComponent implements OnInit {
  readonly reglas       = signal<ReglaInfraccion[]>([]);
  readonly cargando     = signal(true);
  readonly confirmarId  = signal<number | null>(null);
  readonly guardando    = signal(false);

  busqueda = '';
  modalOpen  = false;
  editando: ReglaInfraccion | null = null;
  form = { nombre_regla: '', descripcion: '' };

  get reglasFiltradas() {
    const b = this.busqueda.toLowerCase();
    return this.reglas().filter(r =>
      r.nombre_regla.toLowerCase().includes(b) ||
      (r.descripcion ?? '').toLowerCase().includes(b)
    );
  }

  constructor(private http: HttpClient) {}

  ngOnInit() { this.cargar(); }

  cargar() {
    this.cargando.set(true);
    this.http.get<ReglaInfraccion[]>(`${entorno.apiUrl}/reglas/`).subscribe({
      next:  lista => { this.reglas.set(lista); this.cargando.set(false); },
      error: ()    => this.cargando.set(false),
    });
  }

  abrirNueva() {
    this.editando = null;
    this.form = { nombre_regla: '', descripcion: '' };
    this.modalOpen = true;
  }

  abrirEditar(r: ReglaInfraccion) {
    this.editando = r;
    this.form = { nombre_regla: r.nombre_regla, descripcion: r.descripcion ?? '' };
    this.modalOpen = true;
  }

  guardar() {
    if (!this.form.nombre_regla.trim()) return;
    this.guardando.set(true);
    const req$ = this.editando
      ? this.http.patch(`${entorno.apiUrl}/reglas/${this.editando.regla_id}/`, this.form)
      : this.http.post(`${entorno.apiUrl}/reglas/`,  this.form);
    req$.subscribe({ next: () => { this.modalOpen = false; this.guardando.set(false); this.cargar(); },
                     error: () => this.guardando.set(false) });
  }

  pedirConfirmar(id: number) { this.confirmarId.set(id); }

  eliminar(id: number) {
    this.http.delete(`${entorno.apiUrl}/reglas/${id}/`).subscribe(() => {
      this.confirmarId.set(null);
      this.cargar();
    });
  }
}
