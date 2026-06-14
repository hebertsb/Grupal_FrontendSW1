import {
  Component, OnInit, OnDestroy, AfterViewInit,
  inject, signal, ElementRef, ViewChild,
} from '@angular/core';
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
export class PlanoCondominioComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('containerRef') containerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('innerWrapper') innerWrapper!: ElementRef<HTMLDivElement>;
  @ViewChild('imgPlano')     imgPlanoRef!:  ElementRef<HTMLImageElement>;

  private srv    = inject(PlanosServicio);
  private camSrv = inject(CamarasServicio);

  readonly cargando      = signal(true);
  readonly guardando     = signal(false);
  readonly subiendo      = signal(false);
  readonly plano         = signal<PlanoCondominio | null>(null);
  readonly camaras       = signal<Camara[]>([]);
  readonly posiciones    = signal<PosLocal[]>([]);
  readonly camaraSelec   = signal<Camara | null>(null);
  readonly modoEliminar  = signal(false);
  readonly nombrePlano   = signal('Plano Principal');
  readonly errorMsg      = signal('');
  readonly guardadoOk    = signal(false);

  // ── Zoom / Pan ──────────────────────────────────────────────────────────────
  private _scale  = 1;
  private _tx     = 0;
  private _ty     = 0;
  private _dragging  = false;
  private _dragMoved = false;
  private _dragStartX  = 0;
  private _dragStartY  = 0;
  private _dragStartTX = 0;
  private _dragStartTY = 0;

  private _wheelHandler!:     (e: WheelEvent)     => void;
  private _mouseMoveHandler!: (e: MouseEvent)     => void;
  private _mouseUpHandler!:   (e: MouseEvent)     => void;

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

  ngAfterViewInit() {
    // Wheel necesita { passive: false } para poder llamar preventDefault
    this._wheelHandler = (e: WheelEvent) => this._onWheel(e);
    this._mouseMoveHandler = (e: MouseEvent) => this._onMouseMove(e);
    this._mouseUpHandler   = (e: MouseEvent) => this._onMouseUp(e);

    document.addEventListener('mousemove', this._mouseMoveHandler);
    document.addEventListener('mouseup',   this._mouseUpHandler);
  }

  ngOnDestroy() {
    document.removeEventListener('mousemove', this._mouseMoveHandler);
    document.removeEventListener('mouseup',   this._mouseUpHandler);
    if (this.containerRef) {
      this.containerRef.nativeElement.removeEventListener('wheel', this._wheelHandler);
    }
  }

  // Cuando la imagen carga: conectar wheel, fijar ancho del inner y ajustar fit
  onImageLoad() {
    const cont  = this.containerRef?.nativeElement;
    const img   = this.imgPlanoRef?.nativeElement;
    const inner = this.innerWrapper?.nativeElement;
    if (!cont || !img || !inner) return;

    // Fijar el inner wrapper al tamaño natural de la imagen
    inner.style.width  = img.naturalWidth  + 'px';
    inner.style.height = img.naturalHeight + 'px';

    cont.addEventListener('wheel', this._wheelHandler, { passive: false });
    this.fitToContainer();
  }

  // ── Zoom / Pan handlers ──────────────────────────────────────────────────────

  private _onWheel(e: WheelEvent) {
    e.preventDefault();
    const cont  = this.containerRef.nativeElement;
    const rect  = cont.getBoundingClientRect();
    const factor = e.deltaY > 0 ? 0.85 : 1.18;
    const newScale = Math.min(Math.max(this._scale * factor, 0.15), 12);

    // Zoom hacia el cursor
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    this._tx = mx - (mx - this._tx) * (newScale / this._scale);
    this._ty = my - (my - this._ty) * (newScale / this._scale);
    this._scale = newScale;
    this._applyTransform();
  }

  onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    this._dragging  = true;
    this._dragMoved = false;
    this._dragStartX  = e.clientX;
    this._dragStartY  = e.clientY;
    this._dragStartTX = this._tx;
    this._dragStartTY = this._ty;
  }

  private _onMouseMove(e: MouseEvent) {
    if (!this._dragging) return;
    const dx = e.clientX - this._dragStartX;
    const dy = e.clientY - this._dragStartY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      this._dragMoved = true;
      this._tx = this._dragStartTX + dx;
      this._ty = this._dragStartTY + dy;
      this._applyTransform();
    }
  }

  private _onMouseUp(e: MouseEvent) {
    if (!this._dragging) return;
    const wasDrag = this._dragMoved;
    this._dragging  = false;
    this._dragMoved = false;
    if (!wasDrag && e.button === 0) {
      this._handleClick(e);
    }
  }

  private _handleClick(e: MouseEvent) {
    const plano = this.plano();
    if (!plano?.plano_id) return;

    const img  = this.imgPlanoRef?.nativeElement;
    const cont = this.containerRef.nativeElement;
    if (!img) return;

    const rect  = cont.getBoundingClientRect();
    const imgX  = (e.clientX - rect.left - this._tx) / this._scale;
    const imgY  = (e.clientY - rect.top  - this._ty) / this._scale;
    const pos_x = Math.max(0, Math.min(1, imgX / img.naturalWidth));
    const pos_y = Math.max(0, Math.min(1, imgY / img.naturalHeight));

    if (this.modoEliminar()) {
      const cerca = this._encontrarCercana(pos_x, pos_y);
      if (cerca) this._quitarPosicion(cerca.camaraId);
      return;
    }

    const selec = this.camaraSelec();
    if (!selec) return;

    const existe = this.posiciones().find(p => p.camaraId === selec.camara_id);
    if (existe) {
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

  // ── Zoom controls ────────────────────────────────────────────────────────────

  zoomIn()  { this._zoomCenter(1.3); }
  zoomOut() { this._zoomCenter(0.77); }

  private _zoomCenter(factor: number) {
    const cont  = this.containerRef?.nativeElement;
    if (!cont) return;
    const cx = cont.clientWidth  / 2;
    const cy = cont.clientHeight / 2;
    const newScale = Math.min(Math.max(this._scale * factor, 0.15), 12);
    this._tx = cx - (cx - this._tx) * (newScale / this._scale);
    this._ty = cy - (cy - this._ty) * (newScale / this._scale);
    this._scale = newScale;
    this._applyTransform();
  }

  fitToContainer() {
    const cont = this.containerRef?.nativeElement;
    const img  = this.imgPlanoRef?.nativeElement;
    if (!cont || !img || !img.naturalWidth) return;

    const scaleX = cont.clientWidth  / img.naturalWidth;
    const scaleY = cont.clientHeight / img.naturalHeight;
    this._scale  = Math.min(scaleX, scaleY) * 0.93;

    const scaledW = img.naturalWidth  * this._scale;
    const scaledH = img.naturalHeight * this._scale;
    this._tx = (cont.clientWidth  - scaledW) / 2;
    this._ty = (cont.clientHeight - scaledH) / 2;
    this._applyTransform();
  }

  private _applyTransform() {
    const inner = this.innerWrapper?.nativeElement;
    if (!inner) return;
    inner.style.transform = `translate(${this._tx}px,${this._ty}px) scale(${this._scale})`;
  }

  // ── SVG coordinate conversion ─────────────────────────────────────────────

  // Convierte posición normalizada (0-1) a coordenadas SVG (viewBox 0-100)
  svgX(pos_x: number) { return pos_x * 100; }
  svgY(pos_y: number) { return pos_y * 100; }

  // ── Cámaras ───────────────────────────────────────────────────────────────

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

  _quitar(camaraId: number) { this._quitarPosicion(camaraId); }

  // ── Upload imagen ────────────────────────────────────────────────────────

  onFileSelect(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file  = input.files?.[0];
    input.value = '';
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['jpg', 'jpeg', 'png'].includes(ext)) {
      this.errorMsg.set('Solo se aceptan imágenes JPG, JPEG o PNG');
      return;
    }
    this.errorMsg.set('');
    this.subiendo.set(true);

    const fd = new FormData();
    fd.append('imagen',        file);
    fd.append('nombre',        this.nombrePlano());
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

  // ── Guardar ───────────────────────────────────────────────────────────────

  guardar() {
    const plano = this.plano();
    if (!plano?.plano_id) return;
    this.guardando.set(true);
    this.guardadoOk.set(false);

    const ops = this.posiciones().map(p =>
      this.srv.guardarPosicion(plano.plano_id!, p.camaraId, p.pos_x, p.pos_y)
    );

    if (ops.length === 0) { this.guardando.set(false); return; }

    let completados = 0;
    ops.forEach(obs => obs.subscribe({
      next: () => {
        if (++completados === ops.length) {
          this.guardando.set(false);
          this.guardadoOk.set(true);
          setTimeout(() => this.guardadoOk.set(false), 2500);
        }
      },
      error: () => {
        this.guardando.set(false);
        this.errorMsg.set('Error al guardar posiciones');
      },
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
    const RADIO = 0.05;
    return this.posiciones().find(p =>
      Math.abs(p.pos_x - px) < RADIO && Math.abs(p.pos_y - py) < RADIO
    );
  }

  private _quitarPosicion(camaraId: number) {
    const plano = this.plano();
    if (plano?.plano_id) {
      this.srv.eliminarPosicion(plano.plano_id, camaraId).subscribe();
    }
    this.posiciones.update(list => list.filter(p => p.camaraId !== camaraId));
  }

  readonly _colores = [
    '#4CAF50','#2196F3','#FF9800','#E91E63',
    '#9C27B0','#00BCD4','#FF5722','#607D8B',
  ];
  colorCamara(idx: number): string { return this._colores[idx % this._colores.length]; }

  indiceGlobal(camaraId: number): number {
    return this.camaras().findIndex(c => c.camara_id === camaraId);
  }

  // Nombre recortado para la etiqueta SVG
  labelCorto(nombre: string): string {
    return nombre.length > 13 ? nombre.slice(0, 12) + '…' : nombre;
  }
}
