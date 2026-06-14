import { Component, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { EventosServicio } from '../../../compartido/servicios/eventos.servicio';
import { Evento, EstadoEvento, prioridadEvento } from '../../../compartido/modelos/evento.modelo';
import { CabeceraComponent } from '../../../compartido/componentes/cabecera/cabecera.component';

@Component({
  selector: 'app-lista-eventos',
  standalone: true,
  imports: [FormsModule, DatePipe, CabeceraComponent],
  templateUrl: './lista-eventos.component.html',
  styleUrl: './lista-eventos.component.scss',
})
export class ListaEventosComponent implements OnInit {
  readonly todos     = signal<Evento[]>([]);
  readonly cargando  = signal(true);

  // Filtros
  busqueda   = '';
  filtroEstado: EstadoEvento | '' = '';
  fechaDesde = '';
  fechaHasta = '';

  // Modal resolución
  eventoModal: Evento | null = null;
  estadoModal: EstadoEvento  = 'resuelto';
  resolucionModal = '';

  // Modal imagen
  imagenModal: string | null = null;

  readonly estados: { valor: EstadoEvento | ''; etiqueta: string }[] = [
    { valor: '',             etiqueta: 'Todos' },
    { valor: 'pendiente',    etiqueta: 'Pendiente' },
    { valor: 'en_atencion',  etiqueta: 'En Atención' },
    { valor: 'resuelto',     etiqueta: 'Resuelto' },
    { valor: 'falsa_alarma', etiqueta: 'Falsa alarma' },
  ];

  readonly eventosFiltrados = computed(() => {
    let lista = this.todos();
    const b = this.busqueda.toLowerCase().trim();
    if (b) lista = lista.filter(e =>
      (e.camara_nombre ?? '').toLowerCase().includes(b) ||
      (e.regla_nombre  ?? '').toLowerCase().includes(b) ||
      String(e.evento_id).includes(b)
    );
    if (this.filtroEstado) lista = lista.filter(e => e.estado === this.filtroEstado);
    if (this.fechaDesde)   lista = lista.filter(e => new Date(e.timestamp_deteccion) >= new Date(this.fechaDesde));
    if (this.fechaHasta)   lista = lista.filter(e => new Date(e.timestamp_deteccion) <= new Date(this.fechaHasta + 'T23:59:59'));
    return lista;
  });

  constructor(private eventosSrv: EventosServicio) {}

  ngOnInit() { this.cargar(); }

  cargar() {
    this.cargando.set(true);
    this.eventosSrv.listar().subscribe({
      next:  lista => { this.todos.set(lista); this.cargando.set(false); },
      error: ()    => this.cargando.set(false),
    });
  }

  prioridad = prioridadEvento;

  colorPrioridad(ev: Evento): string {
    const p = prioridadEvento(ev);
    if (p === 'critica')  return 'var(--peligro)';
    if (p === 'moderada') return 'var(--advertencia)';
    return 'var(--exito)';
  }

  iconoPrioridad(ev: Evento): string {
    const p = prioridadEvento(ev);
    return p === 'critica' ? 'crisis_alert' : p === 'moderada' ? 'warning' : 'check_circle';
  }

  etiquetaEstado(estado: string): string {
    return { pendiente: 'Pendiente', en_atencion: 'En Atención', resuelto: 'Resuelto', falsa_alarma: 'Falsa alarma' }[estado] ?? estado;
  }

  abrirModalResolucion(ev: Evento, estado: EstadoEvento) {
    this.eventoModal    = ev;
    this.estadoModal    = estado;
    this.resolucionModal = ev.resolucion ?? '';
  }

  confirmarResolucion() {
    if (!this.eventoModal) return;
    this.eventosSrv.actualizarEstado(this.eventoModal.evento_id, this.estadoModal, this.resolucionModal)
      .subscribe(() => { this.eventoModal = null; this.cargar(); });
  }

  cambioRapido(ev: Evento, estado: EstadoEvento) {
    this.eventosSrv.actualizarEstado(ev.evento_id, estado).subscribe(() => this.cargar());
  }

  limpiarFiltros() {
    this.busqueda   = '';
    this.filtroEstado = '';
    this.fechaDesde = '';
    this.fechaHasta = '';
  }
}
