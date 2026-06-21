import {
  AfterViewInit, Component, ElementRef, NgZone,
  OnDestroy, OnInit, ViewChild, signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import * as echarts from 'echarts';
import { entorno } from '../../../../environments/environment';
import { CabeceraComponent } from '../../../compartido/componentes/cabecera/cabecera.component';

interface CamaraDisp { id: number; nombre: string; }

interface Resumen {
  kpis: {
    total_eventos: number; eventos_hoy: number; confianza_promedio: number;
    camara_top: string; regla_top: string; dias: number;
    filtros_activos: { camara_id: string | null; regla: string | null; estado: string | null };
  };
  camaras_disponibles: CamaraDisp[];
  reglas_disponibles:  string[];
  por_camara:  { id: number; camara: string; total: number; confianza: number }[];
  por_regla:   { regla: string;  total: number; confianza: number }[];
  por_hora:    { hora: number;   total: number }[];
  por_dia:     { fecha: string;  total: number }[];
  por_estado:  { estado: string; total: number }[];
}

@Component({
  selector: 'app-reportes-ia',
  standalone: true,
  imports: [FormsModule, CabeceraComponent],
  templateUrl: './reportes-ia.component.html',
  styleUrl: './reportes-ia.component.scss',
})
export class ReportesIaComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCamara')    private elCamara!:    ElementRef<HTMLDivElement>;
  @ViewChild('chartRegla')     private elRegla!:     ElementRef<HTMLDivElement>;
  @ViewChild('chartTendencia') private elTendencia!: ElementRef<HTMLDivElement>;
  @ViewChild('chartHoras')     private elHoras!:     ElementRef<HTMLDivElement>;
  @ViewChild('chartConfianza') private elConfianza!: ElementRef<HTMLDivElement>;
  @ViewChild('chartEstado')    private elEstado!:    ElementRef<HTMLDivElement>;

  readonly cargando = signal(true);
  readonly datos    = signal<Resumen | null>(null);

  // Filtros
  readonly diasSel    = signal(30);
  camaraFiltro = '';
  reglaFiltro  = '';
  estadoFiltro = '';

  // Asistente IA por voz
  readonly escuchando     = signal(false);
  readonly preguntaTexto  = signal('');
  readonly respuestaIa    = signal('');
  readonly consultando    = signal(false);
  private recognition: any = null;

  private charts: echarts.ECharts[] = [];
  private resizeObs?: ResizeObserver;
  private viewReady = false;

  private readonly COLORES = ['#238be6','#3fb950','#d29922','#f85149','#bc8cff','#ffa657','#39d353','#58a6ff'];
  private readonly T = {
    bg: '#0d1117', surface: '#161b22', border: '#30363d', texto: '#e6edf3',
    texto2: '#8b949e', primario: '#238be6', exito: '#3fb950',
    peligro: '#f85149', adverten: '#d29922',
  };

  constructor(private http: HttpClient, private zone: NgZone) {}

  ngOnInit()       { this.cargar(); }
  ngAfterViewInit(){ this.viewReady = true; if (this.datos()) this.renderizarCharts(); }
  ngOnDestroy()    { this.resizeObs?.disconnect(); this.charts.forEach(c => c.dispose()); }

  cargar(dias = this.diasSel()) {
    this.diasSel.set(dias);
    this.cargando.set(true);
    const params: Record<string, string> = { dias: String(dias) };
    if (this.camaraFiltro) params['camara_id'] = this.camaraFiltro;
    if (this.reglaFiltro)  params['regla']     = this.reglaFiltro;
    if (this.estadoFiltro) params['estado']     = this.estadoFiltro;

    const qs = new URLSearchParams(params).toString();
    this.http.get<Resumen>(`${entorno.apiUrl}/eventos/reportes/resumen/?${qs}`).subscribe({
      next: data => {
        this.datos.set(data);
        this.cargando.set(false);
        if (this.viewReady) setTimeout(() => this.renderizarCharts(), 50);
      },
      error: () => this.cargando.set(false),
    });
  }

  limpiarFiltros() {
    this.camaraFiltro = '';
    this.reglaFiltro  = '';
    this.estadoFiltro = '';
    this.cargar();
  }

  get filtrosActivos(): boolean {
    return !!(this.camaraFiltro || this.reglaFiltro || this.estadoFiltro);
  }

  private renderizarCharts() {
    this.charts.forEach(c => c.dispose());
    this.charts = [];
    const d = this.datos()!;
    this.charts.push(
      this._barrasCamara(d), this._donaRegla(d), this._lineaTendencia(d),
      this._barrasHoras(d),  this._barrasConfianza(d), this._donaEstado(d),
    );
    this.resizeObs?.disconnect();
    this.resizeObs = new ResizeObserver(() =>
      this.zone.run(() => this.charts.forEach(c => c.resize()))
    );
    const cont = this.elCamara.nativeElement.closest('.reportes-wrapper');
    if (cont) this.resizeObs.observe(cont);
  }

  private _init(el: ElementRef): echarts.ECharts {
    const existing = echarts.getInstanceByDom(el.nativeElement);
    if (existing) existing.dispose();
    return echarts.init(el.nativeElement, null, { renderer: 'canvas' });
  }

  private _baseOpt(titulo: string): echarts.EChartsOption {
    return {
      backgroundColor: this.T.surface,
      title: { text: titulo, textStyle: { color: this.T.texto, fontSize: 13, fontWeight: 'bold' }, left: 16, top: 12 },
      tooltip: { backgroundColor: '#1c2128', borderColor: this.T.border, textStyle: { color: this.T.texto }, trigger: 'axis' as const },
      grid: { left: 16, right: 16, bottom: 16, top: 54, containLabel: true },
    };
  }

  private _barrasCamara(d: Resumen): echarts.ECharts {
    const c = this._init(this.elCamara);
    c.setOption({
      ...this._baseOpt('Detecciones por Cámara'),
      xAxis: { type: 'category', data: d.por_camara.map(r => r.camara), axisLabel: { color: this.T.texto2, fontSize: 10, rotate: 20 }, axisLine: { lineStyle: { color: this.T.border } } },
      yAxis: { type: 'value', axisLabel: { color: this.T.texto2 }, splitLine: { lineStyle: { color: this.T.border, type: 'dashed' } } },
      series: [{ type: 'bar', data: d.por_camara.map(r => r.total), barMaxWidth: 52,
        itemStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#58a6ff'},{offset:1,color:'#1158c7'}]), borderRadius:[6,6,0,0] },
        label: { show: true, position: 'top', color: this.T.texto, fontSize: 11 },
      }],
    });
    c.on('click', (p: any) => {
      const cam = d.por_camara[p.dataIndex];
      if (cam) { this.camaraFiltro = String(cam.id); this.cargar(); }
    });
    return c;
  }

  private _donaRegla(d: Resumen): echarts.ECharts {
    const c = this._init(this.elRegla);
    c.setOption({
      ...this._baseOpt('Tipos de Infracción'),
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)', backgroundColor: '#1c2128', borderColor: this.T.border, textStyle: { color: this.T.texto } },
      legend: { bottom: 8, textStyle: { color: this.T.texto2, fontSize: 10 }, icon: 'circle', itemWidth: 8 },
      series: [{ type: 'pie', radius: ['42%','68%'], center: ['50%','48%'],
        data: d.por_regla.map((r,i) => ({ name: r.regla, value: r.total, itemStyle: { color: this.COLORES[i % this.COLORES.length] } })),
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 12, fontWeight: 'bold', color: this.T.texto } },
      }],
    });
    c.on('click', (p: any) => { this.reglaFiltro = p.name; this.cargar(); });
    return c;
  }

  private _lineaTendencia(d: Resumen): echarts.ECharts {
    const c = this._init(this.elTendencia);
    c.setOption({
      ...this._baseOpt(`Tendencia — últimos ${this.diasSel()} días`),
      xAxis: { type: 'category', data: d.por_dia.map(r => r.fecha), axisLabel: { color: this.T.texto2, fontSize: 10, rotate: 30 }, axisLine: { lineStyle: { color: this.T.border } } },
      yAxis: { type: 'value', axisLabel: { color: this.T.texto2 }, splitLine: { lineStyle: { color: this.T.border, type: 'dashed' } } },
      series: [{ type: 'line', data: d.por_dia.map(r => r.total), smooth: true, symbol: 'circle', symbolSize: 6,
        lineStyle: { color: this.T.primario, width: 2.5 },
        itemStyle: { color: this.T.primario },
        areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(35,139,230,0.35)'},{offset:1,color:'rgba(35,139,230,0.02)'}]) },
      }],
    });
    return c;
  }

  private _barrasHoras(d: Resumen): echarts.ECharts {
    const c = this._init(this.elHoras);
    const totales = Array(24).fill(0);
    d.por_hora.forEach(r => { totales[r.hora] = r.total; });
    const max = Math.max(...totales, 1);
    c.setOption({
      ...this._baseOpt('Incidentes por Hora del Día'),
      xAxis: { type: 'category', data: Array.from({length:24},(_,i)=>`${i}h`), axisLabel: { color: this.T.texto2, fontSize: 9 }, axisLine: { lineStyle: { color: this.T.border } } },
      yAxis: { type: 'value', axisLabel: { color: this.T.texto2 }, splitLine: { lineStyle: { color: this.T.border, type: 'dashed' } } },
      series: [{ type: 'bar', data: totales, barMaxWidth: 24,
        itemStyle: { color: (p: any) => p.value===0 ? this.T.border : p.value/max>0.7 ? this.T.peligro : p.value/max>0.4 ? this.T.adverten : this.T.exito, borderRadius:[3,3,0,0] },
      }],
    });
    return c;
  }

  private _barrasConfianza(d: Resumen): echarts.ECharts {
    const c = this._init(this.elConfianza);
    c.setOption({
      ...this._baseOpt('Confianza IA por Tipo de Infracción'),
      grid: { left: 16, right: 60, bottom: 16, top: 54, containLabel: true },
      tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}: <b>${p[0].value}%</b>`, backgroundColor: '#1c2128', borderColor: this.T.border, textStyle: { color: this.T.texto } },
      xAxis: { type: 'value', max: 100, axisLabel: { color: this.T.texto2, formatter: '{value}%' }, splitLine: { lineStyle: { color: this.T.border, type: 'dashed' } } },
      yAxis: { type: 'category', data: d.por_regla.map(r => r.regla), axisLabel: { color: this.T.texto2, fontSize: 10 } },
      series: [{ type: 'bar', data: d.por_regla.map(r => r.confianza), barMaxWidth: 28,
        itemStyle: { color: (p: any) => p.value>=90 ? this.T.exito : p.value>=75 ? this.T.primario : this.T.adverten, borderRadius:[0,6,6,0] },
        label: { show: true, position: 'right', color: this.T.texto2, fontSize: 11, formatter: '{c}%' },
      }],
    });
    return c;
  }

  private _donaEstado(d: Resumen): echarts.ECharts {
    const c = this._init(this.elEstado);
    const CE: Record<string,string> = { pendiente: this.T.adverten, en_atencion: this.T.primario, resuelto: this.T.exito, falsa_alarma: this.T.texto2 };
    const LE: Record<string,string> = { pendiente:'Pendiente', en_atencion:'En Atención', resuelto:'Resuelto', falsa_alarma:'Falsa Alarma' };
    c.setOption({
      ...this._baseOpt('Estado de Alertas'),
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)', backgroundColor: '#1c2128', borderColor: this.T.border, textStyle: { color: this.T.texto } },
      legend: { bottom: 8, textStyle: { color: this.T.texto2, fontSize: 10 }, icon: 'circle', itemWidth: 8 },
      series: [{ type: 'pie', radius: ['42%','68%'], center: ['50%','48%'],
        data: d.por_estado.map(r => ({ name: LE[r.estado]??r.estado, value: r.total, itemStyle: { color: CE[r.estado]??this.T.primario } })),
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 12, fontWeight: 'bold', color: this.T.texto } },
      }],
    });
    c.on('click', (p: any) => {
      const rev = Object.entries(LE).find(([,v])=>v===p.name)?.[0] ?? '';
      if (rev) { this.estadoFiltro = rev; this.cargar(); }
    });
    return c;
  }

  nombreCamara(id: string): string {
    return this.datos()?.camaras_disponibles?.find(c => String(c.id) === id)?.nombre ?? id;
  }

  colorEstado(e: string) {
    return { pendiente:'#d29922', en_atencion:'#238be6', resuelto:'#3fb950', falsa_alarma:'#8b949e' }[e] ?? '#8b949e';
  }

  // ── Asistente IA por voz ──────────────────────────────────────────────────

  detenerEscucha() {
    this.recognition?.stop();
    this.escuchando.set(false);
  }

  iniciarEscucha() {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.'); return; }

    this.recognition = new SR();
    this.recognition.lang = 'es-ES';
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;

    this.escuchando.set(true);
    this.preguntaTexto.set('');
    this.respuestaIa.set('');

    this.recognition.onresult = (ev: any) => {
      const texto = ev.results[0][0].transcript;
      this.preguntaTexto.set(texto);
      this.escuchando.set(false);
      this.consultarGroq(texto);
    };
    this.recognition.onerror  = () => this.escuchando.set(false);
    this.recognition.onend    = () => this.escuchando.set(false);
    this.recognition.start();
  }

  consultarGroq(pregunta: string) {
    if (!pregunta.trim() || !this.datos()) return;
    this.consultando.set(true);
    const d = this.datos()!;
    // Enviamos solo el resumen (sin las listas completas) para no saturar el contexto
    const contexto = {
      kpis:       d.kpis,
      por_camara: d.por_camara,
      por_regla:  d.por_regla,
      por_hora:   d.por_hora.filter(h => h.total > 0),
      por_estado: d.por_estado,
    };
    this.http.post<{ respuesta: string }>(`${entorno.apiUrl}/eventos/reportes/consulta/`, {
      pregunta, datos: contexto,
    }).subscribe({
      next: r => { this.respuestaIa.set(r.respuesta); this.consultando.set(false); },
      error: (e: any) => { this.respuestaIa.set('Error: ' + (e?.error?.error ?? e?.message ?? 'Sin detalle')); this.consultando.set(false); },
    });
  }
}
