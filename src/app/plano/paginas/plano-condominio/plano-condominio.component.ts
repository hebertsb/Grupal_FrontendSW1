import { Component, OnInit, inject, signal, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlanosServicio, PlanoCondominio, PosicionCamara } from '../../../compartido/servicios/planos.servicio';
import { CamarasServicio } from '../../../compartido/servicios/camaras.servicio';
import { CabeceraComponent } from '../../../compartido/componentes/cabecera/cabecera.component';
import { Camara } from '../../../compartido/modelos/camara.modelo';

const CONDOMINIO_ID = 3; // TODO: obtener del condominio activo del usuario

interface PosLocal {
  camaraId:     number;
  nombreCamara: string;
  pos_x:        number;
  pos_y:        number;
}

@Component({
  selector: 'app-plano-condominio',
  standalone: true,
  imports: [FormsModule, CabeceraComponent],
  templateUrl: './plano-condominio.component.html',
  styleUrl:    './plano-condominio.component.scss',
})
export class PlanoCondominioComponent implements OnInit {
  @ViewChild('imgPlano') imgPlanoRef!: ElementRef<HTMLImageElement>;

  private srv     = inject(PlanosServicio);
  private camSrv  = inject(CamarasServicio);

  readonly cargando       = signal(true);
  readonly guardando      = signal(false);
  readonly subiendo       = signal(false);
  readonly plano          = signal<PlanoCondominio | null>(null);
  readonly camaras        = signal<Camara[]>([]);
  readonly posiciones     = signal<PosLocal[]>([]);
  readonly camaraSelec    = signal<Camara | null>(null);
  readonly modoEliminar   = signal(false);
  readonly nombrePlano    = signal('Plano Principal');
  readonly errorMsg       = signal('');

  ngOnInit() {
    this.camSrv.listar().subscribe(lista => this.camaras.set(lista));
    this.srv.listar(CONDOMINIO_ID).subscribe({
      next: planos => {
        if (planos.length > 0) {
          const p = planos[0];
          this.plano.set(p);
          this.posiciones.set(
            (p.posiciones ?? []).map(pos => ({
              camaraId:     pos.camara,
              nombreCamara: pos.nombre_camara ?? '',
              pos_x:        +pos.pos_x,
              pos_y:        +pos.pos_y,
            }))
          );
        }
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  // ── Subir imagen ──────────────────────────────────────────────────────────

  onFileSelect(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['jpg', 'jpeg', 'png'].includes(ext)) {
      this.errorMsg.set('Solo se aceptan imágenes JPG, JPEG o PNG');
      return;
    }
    this.errorMsg.set('');
    this.subiendo.set(true);

    const fd = new FormData();
    fd.append('imagen',       file);
    fd.append('nombre',       this.nombrePlano());
    fd.append('condominio_id', String(CONDOMINIO_ID));

    this.srv.crear(fd).subscribe({
      next: nuevo => {
        this.plano.set(nuevo);
        this.posiciones.set([]);
        this.subiendo.set(false);
      },
      error: err => {
        this.errorMsg.set(err?.error?.error ?? 'Error al subir imagen');
        this.subiendo.set(false);
      },
    });
  }

  // ── Interacción con el plano ──────────────────────────────────────────────

  onClickPlano(ev: MouseEvent) {
    const plano = this.plano();
    if (!plano?.plano_id) return;

    const img   = this.imgPlanoRef?.nativeElement;
    if (!img) return;
    const rect  = img.getBoundingClientRect();
    const pos_x = (ev.clientX - rect.left)  / rect.width;
    const pos_y = (ev.clientY - rect.top)   / rect.height;

    // Modo eliminar: click sobre cámara existente → quitar
    if (this.modoEliminar()) {
      const cerca = this._encontrarCercana(pos_x, pos_y);
      if (cerca) this._quitarPosicion(cerca.camaraId);
      return;
    }

    const selec = this.camaraSelec();
    if (!selec) return;

    // Si ya está colocada, actualizar posición
    const actual = this.posiciones().find(p => p.camaraId === selec.camara_id);
    if (actual) {
      this.posiciones.update(list =>
        list.map(p => p.camaraId === selec.camara_id ? { ...p, pos_x, pos_y } : p)
      );
    } else {
      this.posiciones.update(list => [
        ...list,
        { camaraId: selec.camara_id, nombreCamara: selec.nombre_ubicacion, pos_x, pos_y },
      ]);
    }
    this.camaraSelec.set(null);
  }

  seleccionarCamara(cam: Camara) {
    if (this.camaraSelec()?.camara_id === cam.camara_id) {
      this.camaraSelec.set(null);
    } else {
      this.camaraSelec.set(cam);
      this.modoEliminar.set(false);
    }
  }

  toggleModoEliminar() {
    this.modoEliminar.update(v => !v);
    if (this.modoEliminar()) this.camaraSelec.set(null);
  }

  estaColocada(camaraId: number): boolean {
    return this.posiciones().some(p => p.camaraId === camaraId);
  }

  posicionDe(camaraId: number): PosLocal | undefined {
    return this.posiciones().find(p => p.camaraId === camaraId);
  }

  // ── Guardar posiciones ────────────────────────────────────────────────────

  guardar() {
    const plano = this.plano();
    if (!plano?.plano_id) return;
    this.guardando.set(true);

    const ops = this.posiciones().map(p =>
      this.srv.guardarPosicion(plano.plano_id!, p.camaraId, p.pos_x, p.pos_y)
    );

    if (ops.length === 0) { this.guardando.set(false); return; }

    let completados = 0;
    ops.forEach(obs => obs.subscribe({
      next: () => { if (++completados === ops.length) this.guardando.set(false); },
      error: () => { this.guardando.set(false); this.errorMsg.set('Error al guardar posiciones'); },
    }));
  }

  // ── Eliminar plano ────────────────────────────────────────────────────────

  eliminarPlano() {
    const plano = this.plano();
    if (!plano?.plano_id || !confirm(`¿Eliminar el plano "${plano.nombre}"?`)) return;
    this.srv.eliminar(plano.plano_id).subscribe({
      next: () => { this.plano.set(null); this.posiciones.set([]); },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _encontrarCercana(px: number, py: number): PosLocal | undefined {
    const RADIO = 0.04;
    return this.posiciones().find(p =>
      Math.abs(p.pos_x - px) < RADIO && Math.abs(p.pos_y - py) < RADIO
    );
  }

  _quitar(camaraId: number) { this._quitarPosicion(camaraId); }

  private _quitarPosicion(camaraId: number) {
    const plano = this.plano();
    if (plano?.plano_id) {
      this.srv.eliminarPosicion(plano.plano_id, camaraId).subscribe();
    }
    this.posiciones.update(list => list.filter(p => p.camaraId !== camaraId));
  }

  colores = ['#4CAF50','#2196F3','#FF9800','#E91E63','#9C27B0','#00BCD4','#FF5722','#607D8B'];
  colorCamara(idx: number): string { return this.colores[idx % this.colores.length]; }

  indiceGlobal(camaraId: number): number {
    return this.camaras().findIndex(c => c.camara_id === camaraId);
  }
}
