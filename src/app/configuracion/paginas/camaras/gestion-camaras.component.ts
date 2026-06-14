import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CamarasServicio, ZonaRoi } from '../../../compartido/servicios/camaras.servicio';
import { IaServicio } from '../../../compartido/servicios/ia.servicio';
import { AutenticacionServicio } from '../../../compartido/servicios/autenticacion.servicio';
import { Camara } from '../../../compartido/modelos/camara.modelo';
import { CabeceraComponent } from '../../../compartido/componentes/cabecera/cabecera.component';
import { entorno } from '../../../../environments/environment';

interface FormCamara {
  nombre_ubicacion: string;
  // Constructores de URL
  protocolo:  'rtsp' | 'http' | 'https';
  host:       string;
  puerto:     string;
  usuario:    string;
  password:   string;
  ruta:       string;
  // URL final (override manual)
  rtsp_url:   string;
  modo_url:   'asistido' | 'manual';
  is_active:  boolean;
}

type EstadoConexion = 'pendiente' | 'probando' | 'ok' | 'error';

@Component({
  selector: 'app-gestion-camaras',
  standalone: true,
  imports: [FormsModule, CabeceraComponent],
  templateUrl: './gestion-camaras.component.html',
  styleUrl: './gestion-camaras.component.scss',
})
export class GestionCamarasComponent implements OnInit {
  private srv  = inject(CamarasServicio);
  private ia   = inject(IaServicio);
  private auth = inject(AutenticacionServicio);

  readonly camaras      = signal<Camara[]>([]);
  readonly cargando     = signal(true);
  readonly modalOpen    = signal(false);
  readonly guardando    = signal(false);
  readonly editandoId   = signal<number | null>(null);

  // Estado de conexión por cámara (camara_id → estado)
  readonly estadosConexion = signal<Record<number, EstadoConexion>>({});
  readonly mensajesConexion = signal<Record<number, string>>({});

  form: FormCamara = this.formVacio();

  ngOnInit() { this.cargar(); }

  cargar() {
    this.srv.listar().subscribe({
      next: lista => { this.camaras.set(lista); this.cargando.set(false); },
      error: ()   => this.cargando.set(false),
    });
  }

  formVacio(): FormCamara {
    return {
      nombre_ubicacion: '',
      protocolo: 'rtsp',
      host: '', puerto: '8554', usuario: '', password: '', ruta: '/',
      rtsp_url: '',
      modo_url: 'asistido',
      is_active: true,
    };
  }

  // Construye la URL a partir de los campos asistidos
  urlConstructida(): string {
    const f = this.form;
    if (f.modo_url === 'manual') return f.rtsp_url;
    const creds = f.usuario ? `${encodeURIComponent(f.usuario)}:${encodeURIComponent(f.password)}@` : '';
    const ruta  = f.ruta.startsWith('/') ? f.ruta : `/${f.ruta}`;
    return `${f.protocolo}://${creds}${f.host}:${f.puerto}${ruta}`;
  }

  urlFinal(): string {
    return this.form.modo_url === 'manual' ? this.form.rtsp_url : this.urlConstructida();
  }

  // Abre modal para crear
  abrirNueva() {
    this.form = this.formVacio();
    this.editandoId.set(null);
    this.modalOpen.set(true);
  }

  // Abre modal para editar
  abrirEditar(cam: Camara) {
    this.form = {
      nombre_ubicacion: cam.nombre_ubicacion,
      protocolo: 'rtsp',
      host: '', puerto: '8554', usuario: '', password: '', ruta: '/',
      rtsp_url: cam.rtsp_url,
      modo_url: 'manual',
      is_active: cam.is_active,
    };
    this.editandoId.set(cam.camara_id);
    this.modalOpen.set(true);
  }

  readonly errorForm = signal('');

  guardar() {
    const url = this.urlFinal().trim();
    if (!this.form.nombre_ubicacion.trim()) {
      this.errorForm.set('Falta el nombre / ubicación de la cámara');
      return;
    }
    if (!url) {
      this.errorForm.set('Falta la URL del stream (completa los campos o usa "URL directa")');
      return;
    }
    this.errorForm.set('');

    this.guardando.set(true);
    const id = this.editandoId();
    const payload: any = {
      nombre_ubicacion: this.form.nombre_ubicacion,
      rtsp_url: url,
      is_active: this.form.is_active,
    };
    if (!id) {
      payload.condominio = 3;  // TODO: obtener del condominio activo
    }

    const obs = id
      ? this.srv.actualizar(id, payload)
      : this.srv.crear(payload);

    obs.subscribe({
      next: () => {
        this.modalOpen.set(false);
        this.guardando.set(false);
        this.cargar();
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorForm.set('Error al guardar: ' + (err?.error?.detail || err?.message || 'desconocido'));
      },
    });
  }

  eliminar(id: number) {
    if (!confirm('¿Eliminar esta cámara del sistema?')) return;
    this.srv.eliminar(id).subscribe(() => this.cargar());
  }

  alternarActiva(cam: Camara) {
    this.srv.actualizar(cam.camara_id, { is_active: !cam.is_active }).subscribe(() => this.cargar());
  }

  // Prueba conexión de cámara ya guardada
  probarCamara(cam: Camara) {
    this.setEstado(cam.camara_id, 'probando', '');
    this.ia.probarConexion(cam.rtsp_url).subscribe({
      next: r => this.setEstado(cam.camara_id, r.ok ? 'ok' : 'error', r.mensaje),
      error: () => this.setEstado(cam.camara_id, 'error', 'Error de red'),
    });
  }

  // Prueba la URL del form modal
  readonly probandoForm   = signal(false);
  readonly resultadoForm  = signal<{ ok: boolean; msg: string } | null>(null);

  probarUrlForm() {
    const url = this.urlFinal().trim();
    if (!url) return;
    this.probandoForm.set(true);
    this.resultadoForm.set(null);
    this.ia.probarConexion(url).subscribe({
      next:  r => { this.resultadoForm.set({ ok: r.ok,    msg: r.mensaje }); this.probandoForm.set(false); },
      error: () => { this.resultadoForm.set({ ok: false, msg: 'Error de red' }); this.probandoForm.set(false); },
    });
  }

  // ── Gestión Zonas ROI ────────────────────────────────────────────────────
  readonly zonaModalOpen   = signal(false);
  readonly zonasCamara     = signal<ZonaRoi[]>([]);
  readonly camaraZonasId   = signal<number | null>(null);
  readonly guardandoZona   = signal(false);

  readonly TIPOS_ZONA = [
    { value: 'zona_prohibida',      label: 'Zona Prohibida' },
    { value: 'horario_restringido', label: 'Horario Restringido (piscina/quinchos)' },
    { value: 'perimetro',           label: 'Perímetro del condominio' },
    { value: 'parqueo',             label: 'Parqueo' },
    { value: 'area_comun',          label: 'Área Común' },
  ];

  formZona = { tipo_zona: 'zona_prohibida', coordenadas: '[[0.1,0.1],[0.9,0.1],[0.9,0.9],[0.1,0.9]]' };
  errorZona = signal('');

  abrirZonas(cam: Camara) {
    this.camaraZonasId.set(cam.camara_id);
    this.zonaModalOpen.set(true);
    this.cargarZonas(cam.camara_id);
  }

  cargarZonas(camaraId: number) {
    this.srv.listarZonas(camaraId).subscribe({
      next: z => this.zonasCamara.set(z),
      error: () => this.zonasCamara.set([]),
    });
  }

  guardarZona() {
    let puntos: number[][];
    try {
      puntos = JSON.parse(this.formZona.coordenadas);
      if (!Array.isArray(puntos) || puntos.length < 3) throw new Error();
    } catch {
      this.errorZona.set('Coordenadas inválidas. Formato: [[x,y],[x,y],[x,y],...]');
      return;
    }
    this.errorZona.set('');
    this.guardandoZona.set(true);
    this.srv.crearZona({
      camara: this.camaraZonasId()!,
      tipo_zona: this.formZona.tipo_zona,
      poligono_coordenadas: puntos,
    }).subscribe({
      next: () => {
        this.guardandoZona.set(false);
        this.formZona = { tipo_zona: 'zona_prohibida', coordenadas: '[[0.1,0.1],[0.9,0.1],[0.9,0.9],[0.1,0.9]]' };
        this.cargarZonas(this.camaraZonasId()!);
      },
      error: () => { this.guardandoZona.set(false); this.errorZona.set('Error al guardar zona'); },
    });
  }

  eliminarZona(roiId: number) {
    if (!confirm('¿Eliminar esta zona?')) return;
    this.srv.eliminarZona(roiId).subscribe(() => this.cargarZonas(this.camaraZonasId()!));
  }

  labelTipo(tipo: string): string {
    return this.TIPOS_ZONA.find(t => t.value === tipo)?.label ?? tipo;
  }

  private setEstado(id: number, estado: EstadoConexion, msg: string) {
    this.estadosConexion.update(m => ({ ...m, [id]: estado }));
    this.mensajesConexion.update(m => ({ ...m, [id]: msg }));
  }

  // URL de miniatura para preview (stream MJPEG pequeño)
  miniStreamUrl(cam: Camara): string {
    const token = this.auth.obtenerToken() ?? '';
    return `${entorno.apiUrl}/camaras/${cam.camara_id}/stream/?token=${encodeURIComponent(token)}`;
  }

  iconoEstado(id: number): string {
    const e = this.estadosConexion()[id];
    return e === 'ok' ? 'check_circle' : e === 'error' ? 'error' : e === 'probando' ? 'refresh' : 'help_outline';
  }

  colorEstado(id: number): string {
    const e = this.estadosConexion()[id];
    return e === 'ok' ? 'var(--exito)' : e === 'error' ? 'var(--peligro)' : 'var(--texto-2)';
  }
}
