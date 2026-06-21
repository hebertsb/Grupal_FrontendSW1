import {
  Component, ElementRef, Input, OnDestroy, OnInit,
  ViewChild, computed, inject, signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Camara } from '../../../compartido/modelos/camara.modelo';
import { AutenticacionServicio } from '../../../compartido/servicios/autenticacion.servicio';
import { IaServicio, Deteccion } from '../../../compartido/servicios/ia.servicio';
import { entorno } from '../../../../environments/environment';

@Component({
  selector: 'app-celda-camara',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './celda-camara.component.html',
  styleUrl: './celda-camara.component.scss',
})
export class CeldaCamaraComponent implements OnInit, OnDestroy {
  @Input({ required: true }) camara!: Camara;
  @Input() seleccionada = false;

  @ViewChild('videoLocal') videoLocalRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('inputFile')  inputFileRef?:  ElementRef<HTMLInputElement>;

  private auth = inject(AutenticacionServicio);
  private ia   = inject(IaServicio);

  readonly modo        = signal<'live' | 'archivo'>('live');
  readonly cargando    = signal(true);
  readonly errorStream = signal(false);
  private  _retrySeed  = signal(0);
  readonly horaActual  = signal(new Date());
  readonly arrastrando = signal(false);
  readonly archivoUrl  = signal<string | null>(null);
  readonly esVideo     = signal(false);
  readonly detecciones    = signal<Deteccion[]>([]);
  readonly analizando     = signal(false);
  readonly fps            = signal(0);
  readonly alertasModel   = signal<string[]>([]);
  readonly iaVivaActiva   = signal(false);
  readonly conteoPersonas = signal(0);
  readonly nivel          = signal<'normal' | 'sospechoso' | 'critico' | null>(null);
  readonly modoFiltro     = signal<'personas' | 'vehiculos' | 'mascotas' | 'todo'>('todo');

  private readonly _ALERTAS_PERSONA  = new Set(['zona_restringida_persona', 'merodeo', 'personas_peleando', 'caida_persona', 'intrusion_nocturna', 'acceso_fuera_horario']);
  private readonly _ALERTAS_VEHICULO = new Set(['vehiculo_zona_restringida', 'vehiculo_mal_estacionado']);
  private readonly _ALERTAS_MASCOTA  = new Set(['perro_sin_correa', 'heces_detectadas']);

  readonly esLocal       = computed(() => this.camara.rtsp_url.startsWith('local://'));
  readonly localFrameUrl = signal<string | null>(null);

  private intervaloReloj?:   ReturnType<typeof setInterval>;
  private intervaloFrames?:  ReturnType<typeof setInterval>;
  private intervaloIaViva?:  ReturnType<typeof setInterval>;
  private intervaloLocal?:   ReturnType<typeof setInterval>;

  ngOnInit() {
    this.intervaloReloj = setInterval(() => this.horaActual.set(new Date()), 1000);
    if (this.esLocal()) {
      this._refrescarFrameLocal();
      this.intervaloLocal = setInterval(() => this._refrescarFrameLocal(), 2000);
    }
  }

  private _refrescarFrameLocal() {
    const token = this.auth.obtenerToken() ?? '';
    this.localFrameUrl.set(
      `${entorno.apiUrl}/camaras/${this.camara.camara_id}/ultimo_frame/?token=${encodeURIComponent(token)}&_t=${Date.now()}`
    );
  }

  ngOnDestroy() {
    clearInterval(this.intervaloReloj);
    clearInterval(this.intervaloFrames);
    clearInterval(this.intervaloIaViva);
    clearInterval(this.intervaloLocal);
    const url = this.archivoUrl();
    if (url) URL.revokeObjectURL(url);
  }

  private _iniciarIaViva() {
    if (this.iaVivaActiva()) return;
    this.iaVivaActiva.set(true);
    this._llamarIaViva();
    this.intervaloIaViva = setInterval(() => this._llamarIaViva(), 2000);
  }

  private _detenerIaViva() {
    clearInterval(this.intervaloIaViva);
    this.iaVivaActiva.set(false);
    this.detecciones.set([]);
    this.alertasModel.set([]);
    this.conteoPersonas.set(0);
    this.nivel.set(null);
  }

  private _llamarIaViva() {
    if (this.analizando()) return;
    this.analizando.set(true);
    this.ia.analizarCamaraViva(this.camara.camara_id, this.modoFiltro()).subscribe({
      next: r => {
        const dets = this._filtrarDets(r.detecciones ?? []);
        this.detecciones.set(dets);
        this.alertasModel.set(this._filtrarAlertas(r.alertas ?? []));
        this.conteoPersonas.set(r.conteo_personas ?? dets.filter(d => d.clase === 'persona').length);
        this.nivel.set(r.nivel ?? null);
        this.analizando.set(false);
      },
      error: () => this.analizando.set(false),
    });
  }

  private _filtrarDets(dets: Deteccion[]): Deteccion[] {
    switch (this.modoFiltro()) {
      case 'personas':  return dets.filter(d => d.clase === 'persona'  && d.confianza >= 0.95);
      case 'vehiculos': return dets.filter(d => d.clase === 'vehiculo' && d.confianza >= 0.5);
      case 'mascotas':  return dets.filter(d => ['perro', 'dog', 'mascota', 'heces', 'feces', 'poop'].includes(d.clase.toLowerCase()) && d.confianza >= 0.5);
      default:          return dets.filter(d => d.confianza >= 0.5);
    }
  }

  private _filtrarAlertas(alertas: string[]): string[] {
    switch (this.modoFiltro()) {
      case 'personas':  return alertas.filter(a => this._ALERTAS_PERSONA.has(a));
      case 'vehiculos': return alertas.filter(a => this._ALERTAS_VEHICULO.has(a));
      case 'mascotas':  return alertas.filter(a => this._ALERTAS_MASCOTA.has(a));
      default:          return alertas;
    }
  }

  colorNivel(): string {
    switch (this.nivel()) {
      case 'critico':    return 'rgba(248,81,73,0.92)';
      case 'sospechoso': return 'rgba(210,153,34,0.92)';
      default:           return 'rgba(63,185,80,0.92)';
    }
  }

  labelNivel(): string {
    switch (this.nivel()) {
      case 'critico':    return 'CRÍTICO';
      case 'sospechoso': return 'SOSPECHOSO';
      default:           return 'NORMAL';
    }
  }

  // ── URL del stream MJPEG (token en query param para <img>) ──
  streamUrl(): string {
    const token = this.auth.obtenerToken() ?? '';
    const seed  = this._retrySeed();
    return `${entorno.apiUrl}/camaras/${this.camara.camara_id}/stream/?token=${encodeURIComponent(token)}&_r=${seed}`;
  }

  alCargar()  { this.cargando.set(false); this.errorStream.set(false); this._iniciarIaViva(); }
  alError()   { this.cargando.set(false); this.errorStream.set(true);  this._detenerIaViva(); }

  reintentar(ev: Event) {
    ev.stopPropagation();
    this.cargando.set(true);
    this.errorStream.set(false);
    this._retrySeed.update(n => n + 1);
  }

  abrirSelectorConStop(ev: Event) {
    ev.stopPropagation();
    this.abrirSelector();
  }

  // ── Drag & Drop ──
  onDragOver(ev: DragEvent)  { ev.preventDefault(); this.arrastrando.set(true);  }
  onDragLeave()               { this.arrastrando.set(false); }

  onDrop(ev: DragEvent) {
    ev.preventDefault();
    this.arrastrando.set(false);
    const file = ev.dataTransfer?.files[0];
    if (file) this.cargarArchivo(file);
  }

  abrirSelector() { this.inputFileRef?.nativeElement.click(); }

  onFileSelect(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (file) this.cargarArchivo(file);
    (ev.target as HTMLInputElement).value = '';
  }

  cargarArchivo(file: File) {
    clearInterval(this.intervaloFrames);
    const prev = this.archivoUrl();
    if (prev) URL.revokeObjectURL(prev);

    const url = URL.createObjectURL(file);
    this.archivoUrl.set(url);
    this.esVideo.set(file.type.startsWith('video/'));
    this.modo.set('archivo');
    this.detecciones.set([]);

    if (!file.type.startsWith('video/')) {
      // Imagen → convertir a Blob y analizar de inmediato
      this.analizarBlob(file);
    }
  }

  onVideoLoaded() {
    // Video cargado → iniciar captura de frames cada 800ms para hacer la simulación más fluida
    clearInterval(this.intervaloFrames);
    this.intervaloFrames = setInterval(() => this.capturarYAnalizar(), 800);
  }

  private capturarYAnalizar() {
    const video = this.videoLocalRef?.nativeElement;
    if (!video || video.paused || video.ended || this.analizando()) return;

    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 360;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (blob) this.analizarBlob(blob);
    }, 'image/jpeg', 0.82);
  }

  analizarBlob(blob: Blob) {
    if (this.analizando()) return;
    this.analizando.set(true);
    this.ia.analizarFramePersona(blob, this.modoFiltro()).subscribe({
      next: r => {
        const dets = this._filtrarDets(r.detecciones ?? []);
        this.detecciones.set(dets);
        this.alertasModel.set(this._filtrarAlertas(r.alertas ?? []));
        this.conteoPersonas.set(r.conteo_personas ?? dets.filter(d => d.clase === 'persona').length);
        this.nivel.set(r.nivel ?? null);
        this.analizando.set(false);
      },
      error: () => this.analizando.set(false),
    });
  }

  volverALive() {
    clearInterval(this.intervaloFrames);
    this._detenerIaViva();
    const url = this.archivoUrl();
    if (url) URL.revokeObjectURL(url);
    this.archivoUrl.set(null);
    this.modo.set('live');
    this.cargando.set(true);
    this.errorStream.set(false);
  }

  colorClase(clase: string): string {
    const mapa: Record<string, string> = {
      persona: '#f85149', person: '#f85149',
      vehiculo: '#d29922', car: '#d29922', vehicle: '#d29922',
      mascota: '#3fb950',  dog: '#3fb950', cat: '#3fb950', perro: '#3fb950',
      heces: '#8b5a2b', feces: '#8b5a2b', poop: '#8b5a2b',
    };
    return mapa[clase.toLowerCase()] ?? '#1f6feb';
  }
}
