import {
  Component, OnInit, OnDestroy, AfterViewInit,
  inject, signal, computed, ElementRef, ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PlanosServicio, PlanoCondominio, ImagenZona } from '../../../compartido/servicios/planos.servicio';
import { CamarasServicio } from '../../../compartido/servicios/camaras.servicio';
import { CabeceraComponent } from '../../../compartido/componentes/cabecera/cabecera.component';
import { Camara } from '../../../compartido/modelos/camara.modelo';
import { entorno } from '../../../../environments/environment';

const CONDOMINIO_ID = 3;

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
  @ViewChild('heatCanvas')   heatCanvasRef!: ElementRef<HTMLCanvasElement>;

  private srv    = inject(PlanosServicio);
  private camSrv = inject(CamarasServicio);
  private http   = inject(HttpClient);

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

  // ── Heatmap ───────────────────────────────────────────────────────────────
  readonly mostrarHeatmap = signal(false);
  readonly cargandoHeat   = signal(false);
  private  _eventosXCam: Map<number, number> = new Map();
  readonly totalEventosCam = signal<Map<number, number>>(new Map());

  // ── Modal imágenes de zona ────────────────────────────────────────────────
  readonly modalAbierto  = signal(false);
  readonly modalPos      = signal<PosLocal | null>(null);
  readonly imagenesZona  = signal<ImagenZona[]>([]);
  readonly imagenZonaIdx = signal(0);
  readonly cargandoModal = signal(false);
  readonly subiendoZona  = signal(false);

  // Dimensiones naturales de la imagen (para SVG viewBox correcto)
  readonly imgNatW = signal(0);
  readonly imgNatH = signal(0);

  // Tamaños del pin calculados en píxeles reales de la imagen
  // r ≈ 1.8% del ancho de la imagen → pin visible pero no gigante
  readonly ps = computed(() => {
    const r  = Math.max(12, this.imgNatW() * 0.025);
    const cy = -r * 1.5;                 // centro del círculo (sobre el tip)
    return {
      r, cy,
      // cola triangular
      tail: `${-r * 0.38},${cy + r} ${r * 0.38},${cy + r} 0,0`,
      // cuerpo de la cámara (rect blanco dentro del círculo)
      bx: -r * 0.55, by: cy - r * 0.45, bw: r * 1.1, bh: r * 0.78,
      // visor superior
      vx: -r * 0.25, vy: cy - r * 0.45 - r * 0.35, vw: r * 0.5, vh: r * 0.32,
      // lente
      lcy: cy - r * 0.07, lr: r * 0.32, li: r * 0.14,
      // flash
      fx: r * 0.44, fy: cy - r * 0.37, fr: r * 0.12,
      // stroke
      sw: r * 0.11,
      // sombra
      scy: r * 0.22, srx: r * 0.55, sry: r * 0.18,
      // etiqueta
      lx: -r * 2.6, ly: r * 0.28, lw: r * 5.2, lh: r * 1.55, lrx: r * 0.2,
      // texto
      ty: r * 0.28 + r * 1.12, fs: r * 0.88,
    };
  });

  // ── Zoom / Pan (propiedades públicas para uso en template) ──────────────────
  isDragging = false;

  private _scale       = 1;
  private _tx          = 0;
  private _ty          = 0;
  private _dragMoved   = false;
  private _dragStartX  = 0;
  private _dragStartY  = 0;
  private _dragStartTX = 0;
  private _dragStartTY = 0;

  private _wheelHandler!:      (e: WheelEvent) => void;
  private _mouseMoveHandler!:  (e: MouseEvent) => void;
  private _mouseUpHandler!:    (e: MouseEvent) => void;
  private _touchStartHandler!: (e: TouchEvent) => void;
  private _touchMoveHandler!:  (e: TouchEvent) => void;
  private _touchEndHandler!:   (e: TouchEvent) => void;
  private _wheelAttached       = false;

  // Estado para pinch-to-zoom táctil
  private _pinchDist0  = 0;
  private _pinchScale0 = 1;
  private _touchPanX0  = 0;
  private _touchPanY0  = 0;
  private _touchTX0    = 0;
  private _touchTY0    = 0;
  private _isTouching  = false;

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
    this._wheelHandler      = (e: WheelEvent) => this._onWheel(e);
    this._mouseMoveHandler  = (e: MouseEvent) => this._onMouseMove(e);
    this._mouseUpHandler    = (e: MouseEvent) => this._onMouseUp(e);
    this._touchStartHandler = (e: TouchEvent) => this._onTouchStart(e);
    this._touchMoveHandler  = (e: TouchEvent) => this._onTouchMove(e);
    this._touchEndHandler   = (e: TouchEvent) => this._onTouchEnd(e);
    document.addEventListener('mousemove', this._mouseMoveHandler);
    document.addEventListener('mouseup',   this._mouseUpHandler);
  }

  ngOnDestroy() {
    document.removeEventListener('mousemove', this._mouseMoveHandler);
    document.removeEventListener('mouseup',   this._mouseUpHandler);
    this._detachWheel();
    this._detachTouch();
  }

  // ── Imagen cargada ────────────────────────────────────────────────────────

  onImageLoad() {
    const img = this.imgPlanoRef?.nativeElement;
    if (img) {
      this.imgNatW.set(img.naturalWidth);
      this.imgNatH.set(img.naturalHeight);
    }
    this._attachWheel();
    this._attachTouch();
    requestAnimationFrame(() => this.fitToContainer());
  }

  private _attachWheel() {
    const cont = this.containerRef?.nativeElement;
    if (!cont || this._wheelAttached) return;
    cont.addEventListener('wheel', this._wheelHandler, { passive: false });
    this._wheelAttached = true;
  }

  private _detachWheel() {
    const cont = this.containerRef?.nativeElement;
    if (cont && this._wheelAttached) {
      cont.removeEventListener('wheel', this._wheelHandler);
      this._wheelAttached = false;
    }
  }

  private _attachTouch() {
    const cont = this.containerRef?.nativeElement;
    if (!cont) return;
    cont.addEventListener('touchstart', this._touchStartHandler, { passive: false });
    cont.addEventListener('touchmove',  this._touchMoveHandler,  { passive: false });
    cont.addEventListener('touchend',   this._touchEndHandler,   { passive: false });
  }

  private _detachTouch() {
    const cont = this.containerRef?.nativeElement;
    if (!cont) return;
    cont.removeEventListener('touchstart', this._touchStartHandler);
    cont.removeEventListener('touchmove',  this._touchMoveHandler);
    cont.removeEventListener('touchend',   this._touchEndHandler);
  }

  private _pinchDistance(t: TouchList): number {
    const dx = t[1].clientX - t[0].clientX;
    const dy = t[1].clientY - t[0].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private _onTouchStart(e: TouchEvent) {
    e.preventDefault();
    this._isTouching = true;
    if (e.touches.length === 1) {
      this._dragStartX  = e.touches[0].clientX;
      this._dragStartY  = e.touches[0].clientY;
      this._dragStartTX = this._tx;
      this._dragStartTY = this._ty;
      this._dragMoved   = false;
    } else if (e.touches.length === 2) {
      this._pinchDist0  = this._pinchDistance(e.touches);
      this._pinchScale0 = this._scale;
      // Centro del pinch
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const cont = this.containerRef?.nativeElement;
      if (cont) {
        const rect = cont.getBoundingClientRect();
        this._touchPanX0 = mx - rect.left;
        this._touchPanY0 = my - rect.top;
        this._touchTX0   = this._tx;
        this._touchTY0   = this._ty;
      }
    }
  }

  private _onTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 1 && this._isTouching) {
      const dx = e.touches[0].clientX - this._dragStartX;
      const dy = e.touches[0].clientY - this._dragStartY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        this._dragMoved = true;
        this._tx = this._dragStartTX + dx;
        this._ty = this._dragStartTY + dy;
        this._applyTransform();
      }
    } else if (e.touches.length === 2) {
      const dist  = this._pinchDistance(e.touches);
      const ratio = dist / this._pinchDist0;
      const newScale = Math.min(Math.max(this._pinchScale0 * ratio, 0.1), 15);
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const cont = this.containerRef?.nativeElement;
      if (cont) {
        const rect = cont.getBoundingClientRect();
        const cx = mx - rect.left;
        const cy = my - rect.top;
        this._tx = cx - (this._touchPanX0 - this._touchTX0) - (this._touchPanX0 * newScale / this._pinchScale0);
        this._ty = cy - (this._touchPanY0 - this._touchTY0) - (this._touchPanY0 * newScale / this._pinchScale0);
        this._scale = newScale;
        this._applyTransform();
      }
    }
  }

  private _onTouchEnd(e: TouchEvent) {
    if (e.touches.length === 0) {
      if (!this._dragMoved && this._isTouching) {
        // Tap simple → simular click
        const lastTouch = e.changedTouches[0];
        const fakeClick = { clientX: lastTouch.clientX, clientY: lastTouch.clientY, button: 0 } as MouseEvent;
        this._handleClick(fakeClick);
      }
      this._isTouching = false;
      this._dragMoved  = false;
    }
  }

  // ── Zoom / Pan handlers ───────────────────────────────────────────────────

  private _onWheel(e: WheelEvent) {
    e.preventDefault();
    const cont  = this.containerRef.nativeElement;
    const rect  = cont.getBoundingClientRect();
    const factor = e.deltaY > 0 ? 0.85 : 1.18;
    const newScale = Math.min(Math.max(this._scale * factor, 0.1), 15);
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    this._tx = mx - (mx - this._tx) * (newScale / this._scale);
    this._ty = my - (my - this._ty) * (newScale / this._scale);
    this._scale = newScale;
    this._applyTransform();
  }

  onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    this.isDragging  = true;
    this._dragMoved  = false;
    this._dragStartX  = e.clientX;
    this._dragStartY  = e.clientY;
    this._dragStartTX = this._tx;
    this._dragStartTY = this._ty;
  }

  private _onMouseMove(e: MouseEvent) {
    if (!this.isDragging) return;
    const dx = e.clientX - this._dragStartX;
    const dy = e.clientY - this._dragStartY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      this._dragMoved  = true;
      this._tx = this._dragStartTX + dx;
      this._ty = this._dragStartTY + dy;
      this._applyTransform();
    }
  }

  private _onMouseUp(e: MouseEvent) {
    if (!this.isDragging) return;
    const wasDrag     = this._dragMoved;
    this.isDragging   = false;
    this._dragMoved   = false;
    if (!wasDrag && e.button === 0) this._handleClick(e);
  }

  private _handleClick(e: MouseEvent) {
    const plano = this.plano();
    if (!plano?.plano_id) return;
    const inner = this.innerWrapper?.nativeElement;
    const cont  = this.containerRef?.nativeElement;
    if (!inner || !cont) return;

    const rect  = cont.getBoundingClientRect();
    const imgX  = (e.clientX - rect.left - this._tx) / this._scale;
    const imgY  = (e.clientY - rect.top  - this._ty) / this._scale;
    const pos_x = Math.max(0, Math.min(1, imgX / inner.offsetWidth));
    const pos_y = Math.max(0, Math.min(1, imgY / inner.offsetHeight));

    if (this.modoEliminar()) {
      const cerca = this._encontrarCercana(pos_x, pos_y);
      if (cerca) this._quitarPosicion(cerca.camaraId);
      return;
    }

    const selec = this.camaraSelec();
    if (!selec) {
      const cerca = this._encontrarCercana(pos_x, pos_y);
      if (cerca) this._abrirModal(cerca, plano.plano_id);
      return;
    }

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

  // ── Zoom controls ─────────────────────────────────────────────────────────

  zoomIn()  { this._zoomDesdeCenter(1.3);  }
  zoomOut() { this._zoomDesdeCenter(0.77); }

  private _zoomDesdeCenter(factor: number) {
    const cont = this.containerRef?.nativeElement;
    if (!cont) return;
    const cx = cont.clientWidth  / 2;
    const cy = cont.clientHeight / 2;
    const newScale = Math.min(Math.max(this._scale * factor, 0.1), 15);
    this._tx = cx - (cx - this._tx) * (newScale / this._scale);
    this._ty = cy - (cy - this._ty) * (newScale / this._scale);
    this._scale = newScale;
    this._applyTransform();
  }

  fitToContainer() {
    const cont  = this.containerRef?.nativeElement;
    const inner = this.innerWrapper?.nativeElement;
    if (!cont || !inner || inner.offsetWidth === 0 || inner.offsetHeight === 0) return;

    const scaleX = cont.clientWidth  / inner.offsetWidth;
    const scaleY = cont.clientHeight / inner.offsetHeight;
    this._scale  = Math.min(scaleX, scaleY) * 0.94;

    const scaledW = inner.offsetWidth  * this._scale;
    const scaledH = inner.offsetHeight * this._scale;
    this._tx = (cont.clientWidth  - scaledW) / 2;
    this._ty = (cont.clientHeight - scaledH) / 2;
    this._applyTransform();
  }

  private _applyTransform() {
    const inner = this.innerWrapper?.nativeElement;
    if (!inner) return;
    inner.style.transform = `translate(${this._tx}px,${this._ty}px) scale(${this._scale})`;
  }

  // ── Coordenadas SVG (en píxeles reales de la imagen) ─────────────────────

  svgX(pos_x: number) { return pos_x * this.imgNatW(); }
  svgY(pos_y: number) { return pos_y * this.imgNatH(); }

  get svgViewBox(): string {
    return `0 0 ${this.imgNatW()} ${this.imgNatH()}`;
  }

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

  quitarCamara(camaraId: number) { this._quitarPosicion(camaraId); }

  // ── Upload ────────────────────────────────────────────────────────────────

  onFileSelect(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file  = input.files?.[0];
    input.value = '';
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['jpg', 'jpeg', 'png'].includes(ext)) {
      this.errorMsg.set('Solo se aceptan JPG, JPEG o PNG');
      return;
    }
    this.errorMsg.set('');
    this.subiendo.set(true);
    const fd = new FormData();
    fd.append('imagen',        file);
    fd.append('nombre',        this.nombrePlano());
    fd.append('condominio_id', String(CONDOMINIO_ID));
    this.srv.crear(fd).subscribe({
      next: nuevo => { this.plano.set(nuevo); this.posiciones.set([]); this.subiendo.set(false); },
      error: err  => { this.errorMsg.set(err?.error?.error ?? 'Error al subir imagen'); this.subiendo.set(false); },
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
    let done = 0;
    ops.forEach(obs => obs.subscribe({
      next: () => {
        if (++done === ops.length) {
          this.guardando.set(false);
          this.guardadoOk.set(true);
          setTimeout(() => this.guardadoOk.set(false), 2500);
        }
      },
      error: () => { this.guardando.set(false); this.errorMsg.set('Error al guardar'); },
    }));
  }

  eliminarPlano() {
    const plano = this.plano();
    if (!plano?.plano_id || !confirm(`¿Eliminar el plano "${plano.nombre}"?`)) return;
    this.srv.eliminar(plano.plano_id).subscribe({
      next: () => { this.plano.set(null); this.posiciones.set([]); this._wheelAttached = false; },
    });
  }

  // ── Modal zona ───────────────────────────────────────────────────────────

  private _abrirModal(pos: PosLocal, planoId: number) {
    this.modalPos.set(pos);
    this.imagenZonaIdx.set(0);
    this.imagenesZona.set([]);
    this.modalAbierto.set(true);
    this.cargandoModal.set(true);
    this.srv.listarImagenesZona(planoId, pos.camaraId).subscribe({
      next: imgs => { this.imagenesZona.set(imgs); this.cargandoModal.set(false); },
      error: ()  => { this.cargandoModal.set(false); },
    });
  }

  cerrarModal() { this.modalAbierto.set(false); this.modalPos.set(null); }

  prevImagen() { this.imagenZonaIdx.update(i => Math.max(0, i - 1)); }
  nextImagen() { this.imagenZonaIdx.update(i => Math.min(this.imagenesZona().length - 1, i + 1)); }

  onZonaFileSelect(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file  = input.files?.[0];
    input.value = '';
    const pos   = this.modalPos();
    const plano = this.plano();
    if (!file || !pos || !plano?.plano_id) return;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['jpg', 'jpeg', 'png'].includes(ext)) { this.errorMsg.set('Solo JPG/JPEG/PNG'); return; }
    if (this.imagenesZona().length >= 10) return;

    this.subiendoZona.set(true);
    const fd = new FormData();
    fd.append('imagen', file);
    this.srv.subirImagenZona(plano.plano_id, pos.camaraId, fd).subscribe({
      next: img => {
        this.imagenesZona.update(list => [...list, img]);
        this.imagenZonaIdx.set(this.imagenesZona().length - 1);
        this.subiendoZona.set(false);
      },
      error: () => { this.errorMsg.set('Error al subir imagen de zona'); this.subiendoZona.set(false); },
    });
  }

  eliminarImagenZonaActual() {
    const imgs  = this.imagenesZona();
    const idx   = this.imagenZonaIdx();
    const img   = imgs[idx];
    const pos   = this.modalPos();
    const plano = this.plano();
    if (!img?.imagen_id || !pos || !plano?.plano_id) return;

    this.srv.eliminarImagenZona(plano.plano_id, pos.camaraId, img.imagen_id).subscribe({
      next: () => {
        const nuevas = imgs.filter((_, i) => i !== idx);
        this.imagenesZona.set(nuevas);
        this.imagenZonaIdx.set(Math.min(idx, Math.max(0, nuevas.length - 1)));
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _encontrarCercana(px: number, py: number): PosLocal | undefined {
    const R = 0.06;
    return this.posiciones().find(p => Math.abs(p.pos_x - px) < R && Math.abs(p.pos_y - py) < R);
  }

  private _quitarPosicion(camaraId: number) {
    const plano = this.plano();
    if (plano?.plano_id) this.srv.eliminarPosicion(plano.plano_id, camaraId).subscribe();
    this.posiciones.update(list => list.filter(p => p.camaraId !== camaraId));
  }

  readonly colores = [
    '#4CAF50','#2196F3','#FF9800','#E91E63',
    '#9C27B0','#00BCD4','#FF5722','#607D8B',
  ];
  colorCamara(idx: number): string { return this.colores[idx % this.colores.length]; }
  indiceGlobal(camaraId: number): number {
    return this.camaras().findIndex(c => c.camara_id === camaraId);
  }
  labelCorto(nombre: string): string {
    return nombre.length > 13 ? nombre.slice(0, 12) + '…' : nombre;
  }

  // ── Heatmap ───────────────────────────────────────────────────────────────

  toggleHeatmap() {
    this.mostrarHeatmap.update(v => !v);
    if (this.mostrarHeatmap() && this._eventosXCam.size === 0) {
      this._cargarEventos();
    } else {
      this._dibujarHeatmap();
    }
  }

  private _cargarEventos() {
    this.cargandoHeat.set(true);
    this.http.get<any>(`${entorno.apiUrl}/eventos/reportes/resumen/?dias=90`).subscribe({
      next: datos => {
        this._eventosXCam.clear();
        const mapa = new Map<number, number>();
        for (const c of (datos.por_camara ?? [])) {
          this._eventosXCam.set(+c.id, c.total);
          mapa.set(+c.id, c.total);
        }
        this.totalEventosCam.set(mapa);
        this.cargandoHeat.set(false);
        this._dibujarHeatmap();
      },
      error: () => this.cargandoHeat.set(false),
    });
  }

  private _dibujarHeatmap() {
    const canvas = this.heatCanvasRef?.nativeElement;
    if (!canvas) return;
    const W = this.imgNatW();
    const H = this.imgNatH();
    if (!W || !H) return;

    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);

    if (!this.mostrarHeatmap()) return;

    const vals = Array.from(this._eventosXCam.values());
    const maxTotal = vals.length ? Math.max(...vals, 1) : 1;
    const R = Math.max(W, H) * 0.13;

    for (const pos of this.posiciones()) {
      const total = this._eventosXCam.get(pos.camaraId) ?? 0;
      const intensity = total / maxTotal;
      const cx = pos.pos_x * W;
      const cy = pos.pos_y * H;

      let color: string;
      if (intensity > 0.66)      color = '248,81,73';   // rojo
      else if (intensity > 0.33) color = '210,153,34';  // naranja
      else if (total > 0)        color = '63,185,80';   // verde
      else                        color = '100,100,100'; // gris (0 eventos)

      const alpha = total > 0 ? 0.28 + intensity * 0.52 : 0.15;
      const grad  = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      grad.addColorStop(0,   `rgba(${color},${alpha})`);
      grad.addColorStop(0.4, `rgba(${color},${alpha * 0.55})`);
      grad.addColorStop(1,   'rgba(0,0,0,0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // Número de eventos encima del pin
      if (total > 0) {
        const fontSize = Math.max(14, R * 0.28);
        ctx.font      = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillText(String(total), cx + 1, cy + 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(String(total), cx, cy);
      }
    }
  }

  eventosEnCamara(camaraId: number): number {
    return this.totalEventosCam().get(camaraId) ?? 0;
  }
}
