import {
  Component, ElementRef, Input, OnDestroy, OnInit,
  ViewChild, inject, signal,
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
  readonly horaActual  = signal(new Date());
  readonly arrastrando = signal(false);
  readonly archivoUrl  = signal<string | null>(null);
  readonly esVideo     = signal(false);
  readonly detecciones = signal<Deteccion[]>([]);
  readonly analizando  = signal(false);
  readonly fps         = signal(0);   // frames analizados en último segundo

  private intervaloReloj?:  ReturnType<typeof setInterval>;
  private intervaloFrames?: ReturnType<typeof setInterval>;

  ngOnInit() {
    this.intervaloReloj = setInterval(() => this.horaActual.set(new Date()), 1000);
  }

  ngOnDestroy() {
    clearInterval(this.intervaloReloj);
    clearInterval(this.intervaloFrames);
    const url = this.archivoUrl();
    if (url) URL.revokeObjectURL(url);
  }

  // ── URL del stream MJPEG (token en query param para <img>) ──
  streamUrl(): string {
    const token = this.auth.obtenerToken() ?? '';
    return `${entorno.apiUrl}/camaras/${this.camara.camara_id}/stream/?token=${encodeURIComponent(token)}`;
  }

  alCargar()  { this.cargando.set(false); this.errorStream.set(false); }
  alError()   { this.cargando.set(false); this.errorStream.set(true);  }

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
    // Video cargado → iniciar captura de frames cada 2s
    clearInterval(this.intervaloFrames);
    this.intervaloFrames = setInterval(() => this.capturarYAnalizar(), 2000);
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
    this.ia.analizarFrame(blob).subscribe({
      next:  r => { this.detecciones.set(r.detecciones ?? []); this.analizando.set(false); },
      error: () => this.analizando.set(false),
    });
  }

  volverALive() {
    clearInterval(this.intervaloFrames);
    const url = this.archivoUrl();
    if (url) URL.revokeObjectURL(url);
    this.archivoUrl.set(null);
    this.detecciones.set([]);
    this.modo.set('live');
    this.cargando.set(true);
    this.errorStream.set(false);
  }

  colorClase(clase: string): string {
    const mapa: Record<string, string> = {
      persona: '#f85149', person: '#f85149',
      vehiculo: '#d29922', car: '#d29922', vehicle: '#d29922',
      mascota: '#3fb950',  dog: '#3fb950', cat: '#3fb950',
    };
    return mapa[clase.toLowerCase()] ?? '#1f6feb';
  }
}
