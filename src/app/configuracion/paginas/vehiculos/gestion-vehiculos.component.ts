import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlacasServicio } from '../../../compartido/servicios/placas.servicio';
import { PlacaRegistrada } from '../../../compartido/modelos/placa.modelo';
import { CabeceraComponent } from '../../../compartido/componentes/cabecera/cabecera.component';

const PATRON_BO = /^(\d{3,4}[A-Z]{2,3}|[A-Z]{2,3}\d{3,4})$/;

@Component({
  selector: 'app-gestion-vehiculos',
  standalone: true,
  imports: [FormsModule, CabeceraComponent],
  templateUrl: './gestion-vehiculos.component.html',
  styleUrl: './gestion-vehiculos.component.scss',
})
export class GestionVehiculosComponent implements OnInit {
  private srv = inject(PlacasServicio);

  readonly placas      = signal<PlacaRegistrada[]>([]);
  readonly cargando    = signal(true);
  readonly modalOpen   = signal(false);
  readonly guardando   = signal(false);
  readonly editandoId  = signal<string | null>(null);
  readonly errorForm   = signal('');
  readonly busqueda    = signal('');

  form = this.formVacio();

  readonly placasFiltradas = computed(() => {
    const q = this.busqueda().toUpperCase().trim();
    if (!q) return this.placas();
    return this.placas().filter(p =>
      p.placa.includes(q) || (p.descripcion ?? '').toUpperCase().includes(q)
    );
  });

  readonly totalActivas = computed(() => this.placas().filter(p => p.activa).length);

  ngOnInit() { this.cargar(); }

  cargar() {
    this.cargando.set(true);
    this.srv.listar().subscribe({
      next: lista => { this.placas.set(lista); this.cargando.set(false); },
      error: ()   => this.cargando.set(false),
    });
  }

  formVacio() {
    return { placa: '', descripcion: '', activa: true };
  }

  abrirNueva() {
    this.form = this.formVacio();
    this.editandoId.set(null);
    this.errorForm.set('');
    this.modalOpen.set(true);
  }

  abrirEditar(p: PlacaRegistrada) {
    this.form = { placa: p.placa, descripcion: p.descripcion ?? '', activa: p.activa };
    this.editandoId.set(p.id!);
    this.errorForm.set('');
    this.modalOpen.set(true);
  }

  guardar() {
    const placa = this.form.placa.trim().toUpperCase();

    if (!placa) {
      this.errorForm.set('Ingresa el número de placa');
      return;
    }
    if (!PATRON_BO.test(placa)) {
      this.errorForm.set('Formato inválido. Ejemplos válidos: 1154AER, 824EDH, CAL280');
      return;
    }

    this.errorForm.set('');
    this.guardando.set(true);

    const payload: Partial<PlacaRegistrada> = {
      placa,
      descripcion: this.form.descripcion.trim() || undefined,
      activa: this.form.activa,
    };

    const id = this.editandoId();
    const obs = id ? this.srv.actualizar(id, payload) : this.srv.crear(payload);

    obs.subscribe({
      next: () => {
        this.modalOpen.set(false);
        this.guardando.set(false);
        this.cargar();
      },
      error: (err) => {
        this.guardando.set(false);
        const detalle = err?.error?.placa?.[0] ?? err?.error?.detail ?? 'Error al guardar';
        this.errorForm.set(detalle);
      },
    });
  }

  toggleActiva(p: PlacaRegistrada) {
    this.srv.actualizar(p.id!, { activa: !p.activa }).subscribe(() => this.cargar());
  }

  eliminar(p: PlacaRegistrada) {
    if (!confirm(`¿Eliminar la placa ${p.placa}?`)) return;
    this.srv.eliminar(p.id!).subscribe(() => this.cargar());
  }

  cerrarModal() {
    this.modalOpen.set(false);
    this.errorForm.set('');
  }

  normalizarInput(valor: string): string {
    return valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
}
