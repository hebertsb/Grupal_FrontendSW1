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
  readonly inputTexto     = signal('');
  readonly soportaVoz     = typeof window !== 'undefined' && window.isSecureContext &&
                            !!((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition);
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
    [this.elCamara, this.elRegla, this.elTendencia,
     this.elHoras, this.elConfianza, this.elEstado].forEach(el => {
      if (el?.nativeElement) this.resizeObs!.observe(el.nativeElement);
    });
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

  enviarTexto() {
    const texto = this.inputTexto().trim();
    if (!texto || this.consultando()) return;
    this.preguntaTexto.set(texto);
    this.inputTexto.set('');
    this.consultarGroq(texto);
  }

  iniciarEscucha() {
    if (!window.isSecureContext) {
      this.respuestaIa.set('⚠️ La voz requiere HTTPS. Usa el campo de texto para escribir tu pregunta.');
      return;
    }
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
    this.recognition.onerror  = (ev: any) => {
      this.escuchando.set(false);
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        this.respuestaIa.set('⚠️ Micrófono bloqueado (requiere HTTPS). Usa el campo de texto.');
      }
    };
    this.recognition.onend    = () => this.escuchando.set(false);
    this.recognition.start();
  }

  consultarGroq(pregunta: string) {
    if (!pregunta.trim() || !this.datos()) return;
    this.consultando.set(true);
    const d = this.datos()!;
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

  // ── Export Excel ──────────────────────────────────────────────────────────

  readonly exportandoXlsx = signal(false);

  async exportarExcel() {
    const d = this.datos();
    if (!d) return;
    this.exportandoXlsx.set(true);
    try {
      const ExcelJS = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      wb.creator  = 'SIVIC';
      wb.created  = new Date();
      const fecha  = new Date().toLocaleDateString('es-BO');
      const AZUL   = { argb: 'FF238BE6' };
      const AZUL_C = { argb: 'FFDDEEFF' };
      const GRIS   = { argb: 'FFF5F7FA' };
      const BORDE  = { style: 'thin' as const, color: { argb: 'FFDDDDDD' } };
      const BORDES = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE };

      const _hdrStyle = (ws: any, row: number, cols: number) => {
        for (let c = 1; c <= cols; c++) {
          const cell = ws.getCell(row, c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: AZUL };
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
          cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center' };
          cell.border = BORDES;
        }
      };
      const _dataStyle = (ws: any, row: number, cols: number, odd: boolean) => {
        for (let c = 1; c <= cols; c++) {
          const cell = ws.getCell(row, c);
          if (odd) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: GRIS };
          cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center' };
          cell.border = BORDES;
        }
      };
      const _addChart = async (ws: any, chartIdx: number, startRow: number) => {
        if (!this.charts[chartIdx]) return;
        const b64 = this.charts[chartIdx].getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
        const b64data = b64.replace(/^data:image\/png;base64,/, '');
        const imgId = wb.addImage({ base64: b64data, extension: 'png' });
        ws.addImage(imgId, { tl: { col: 0, row: startRow }, ext: { width: 780, height: 320 } });
      };

      // ── Hoja 1: Resumen ──
      const ws1 = wb.addWorksheet('Resumen');
      ws1.columns = [{ width: 34 }, { width: 28 }];
      // Título
      ws1.mergeCells('A1:B1');
      const t1 = ws1.getCell('A1');
      t1.value = 'SIVIC — Reporte de Infracciones IA';
      t1.font  = { bold: true, size: 15, color: AZUL };
      t1.alignment = { vertical: 'middle' };
      ws1.getRow(1).height = 28;
      // Subtítulo
      ws1.mergeCells('A2:B2');
      ws1.getCell('A2').value = `Período: últimos ${d.kpis.dias} días  ·  Generado: ${fecha}`;
      ws1.getCell('A2').font  = { color: { argb: 'FF666666' }, size: 10 };
      ws1.addRow([]);
      // Filtros
      ws1.getCell('A4').value = 'Filtros aplicados';
      ws1.getCell('A4').font  = { bold: true, size: 10, color: { argb: 'FF444444' } };
      [['Cámara', this.camaraFiltro ? this.nombreCamara(this.camaraFiltro) : 'Todas'],
       ['Regla',   this.reglaFiltro  || 'Todas'],
       ['Estado',  this.estadoFiltro || 'Todos']].forEach((row, i) => {
        ws1.getRow(5 + i).values = row;
        ws1.getCell(5 + i, 1).font = { color: { argb: 'FF555555' } };
      });
      ws1.addRow([]);
      // Tabla KPIs
      const hdrRow1 = ws1.addRow(['Indicador', 'Valor']); _hdrStyle(ws1, hdrRow1.number, 2);
      ws1.getRow(hdrRow1.number).height = 22;
      [['Total eventos', d.kpis.total_eventos],
       ['Detecciones hoy', d.kpis.eventos_hoy],
       ['Confianza IA promedio', d.kpis.confianza_promedio + '%'],
       ['Cámara más activa', d.kpis.camara_top],
       ['Infracción más frecuente', d.kpis.regla_top],
      ].forEach((row, i) => {
        const r = ws1.addRow(row); _dataStyle(ws1, r.number, 2, i % 2 === 0);
        ws1.getRow(r.number).height = 20;
      });

      // ── Hoja 2: Por Cámara ──
      const ws2 = wb.addWorksheet('Por Cámara');
      ws2.columns = [{ width: 30 }, { width: 18 }, { width: 18 }];
      const hdr2 = ws2.addRow(['Cámara', 'Total Eventos', 'Confianza IA (%)']); _hdrStyle(ws2, hdr2.number, 3);
      ws2.getRow(hdr2.number).height = 22;
      d.por_camara.forEach((r, i) => {
        const row = ws2.addRow([r.camara, r.total, r.confianza]); _dataStyle(ws2, row.number, 3, i % 2 === 0);
        ws2.getRow(row.number).height = 20;
      });
      ws2.addRow([]); ws2.addRow(['Gráfico: Detecciones por Cámara']).font = { bold: true, color: AZUL };
      await _addChart(ws2, 0, ws2.rowCount + 1);

      // ── Hoja 3: Por Regla ──
      const ws3 = wb.addWorksheet('Por Regla');
      ws3.columns = [{ width: 30 }, { width: 18 }, { width: 18 }];
      const hdr3 = ws3.addRow(['Infracción', 'Total Eventos', 'Confianza IA (%)']); _hdrStyle(ws3, hdr3.number, 3);
      ws3.getRow(hdr3.number).height = 22;
      d.por_regla.forEach((r, i) => {
        const row = ws3.addRow([r.regla, r.total, r.confianza]); _dataStyle(ws3, row.number, 3, i % 2 === 0);
        ws3.getRow(row.number).height = 20;
      });
      ws3.addRow([]); ws3.addRow(['Gráfico: Tipos de Infracción']).font = { bold: true, color: AZUL };
      await _addChart(ws3, 1, ws3.rowCount + 1);

      // ── Hoja 4: Por Hora ──
      const ws4 = wb.addWorksheet('Por Hora');
      ws4.columns = [{ width: 16 }, { width: 18 }];
      const hdr4 = ws4.addRow(['Hora del día', 'Total Eventos']); _hdrStyle(ws4, hdr4.number, 2);
      ws4.getRow(hdr4.number).height = 22;
      d.por_hora.forEach((h, i) => {
        const row = ws4.addRow([`${h.hora}:00`, h.total]); _dataStyle(ws4, row.number, 2, i % 2 === 0);
        ws4.getRow(row.number).height = 20;
      });
      ws4.addRow([]); ws4.addRow(['Gráfico: Distribución por Hora']).font = { bold: true, color: AZUL };
      await _addChart(ws4, 3, ws4.rowCount + 1);

      // ── Hoja 5: Tendencia Diaria ──
      const ws5 = wb.addWorksheet('Tendencia Diaria');
      ws5.columns = [{ width: 18 }, { width: 18 }];
      const hdr5 = ws5.addRow(['Fecha', 'Total Eventos']); _hdrStyle(ws5, hdr5.number, 2);
      ws5.getRow(hdr5.number).height = 22;
      d.por_dia.forEach((r, i) => {
        const row = ws5.addRow([r.fecha, r.total]); _dataStyle(ws5, row.number, 2, i % 2 === 0);
        ws5.getRow(row.number).height = 20;
      });
      ws5.addRow([]); ws5.addRow(['Gráfico: Tendencia Temporal']).font = { bold: true, color: AZUL };
      await _addChart(ws5, 2, ws5.rowCount + 1);

      // ── Hoja 6: Por Estado ──
      const ws6 = wb.addWorksheet('Por Estado');
      ws6.columns = [{ width: 22 }, { width: 18 }];
      const hdr6 = ws6.addRow(['Estado', 'Total Eventos']); _hdrStyle(ws6, hdr6.number, 2);
      ws6.getRow(hdr6.number).height = 22;
      d.por_estado.forEach((r, i) => {
        const row = ws6.addRow([r.estado, r.total]); _dataStyle(ws6, row.number, 2, i % 2 === 0);
        ws6.getRow(row.number).height = 20;
      });
      ws6.addRow([]); ws6.addRow(['Gráfico: Estado de Alertas']).font = { bold: true, color: AZUL };
      await _addChart(ws6, 5, ws6.rowCount + 1);

      // ── Descargar ──
      const buf  = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url; a.download = `SIVIC_Reporte_${new Date().toISOString().slice(0,10)}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
    } finally {
      this.exportandoXlsx.set(false);
    }
  }

  // ── Export PDF ────────────────────────────────────────────────────────────

  readonly exportandoPdf = signal(false);

  async exportarPdf() {
    const d = this.datos();
    if (!d || !this.charts.length) return;
    this.exportandoPdf.set(true);
    try {
      const { jsPDF }             = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W   = doc.internal.pageSize.getWidth();
      const H   = doc.internal.pageSize.getHeight();
      let y = 0;

      const _sect = (titulo: string) => {
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(35, 82, 124);
        doc.setDrawColor(35, 139, 230); doc.setLineWidth(0.5);
        doc.line(14, y + 1, W - 14, y + 1);
        doc.text(titulo, 14, y - 1); y += 5;
      };

      // ── Cabecera azul oscura ──
      doc.setFillColor(10, 25, 47);
      doc.rect(0, 0, W, 36, 'F');
      // Banda de acento
      doc.setFillColor(35, 139, 230);
      doc.rect(0, 0, 4, 36, 'F');
      doc.setFontSize(17); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text('SIVIC', 12, 14);
      doc.setTextColor(88, 166, 255);
      doc.text('Sistema de Visión Inteligente para Condominios', 12, 22);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 200, 220);
      doc.text(`Reporte de Infracciones IA  ·  Últimos ${d.kpis.dias} días  ·  ${new Date().toLocaleDateString('es-BO')}`, 12, 30);
      if (this.filtrosActivos) {
        const filtros = [
          this.camaraFiltro && `Cámara: ${this.nombreCamara(this.camaraFiltro)}`,
          this.reglaFiltro  && `Regla: ${this.reglaFiltro}`,
          this.estadoFiltro && `Estado: ${this.estadoFiltro}`,
        ].filter(Boolean).join('  |  ');
        doc.setFontSize(7.5); doc.setTextColor(140, 170, 200);
        doc.text(`Filtros activos: ${filtros}`, W - 14, 30, { align: 'right' });
      }
      y = 44;

      // ── KPIs en fila ──
      _sect('Indicadores Clave');
      const kpiW = (W - 28 - 12) / 5;
      const kpiH = 18;
      const KPIS = [
        { label: 'Total Eventos',     val: String(d.kpis.total_eventos),      color: [35, 139, 230] as [number,number,number] },
        { label: 'Hoy',               val: String(d.kpis.eventos_hoy),        color: [63, 185, 80]  as [number,number,number] },
        { label: 'Confianza IA',      val: d.kpis.confianza_promedio + '%',   color: [210, 153, 34] as [number,number,number] },
        { label: 'Cámara Top',        val: d.kpis.camara_top.slice(0, 14),    color: [248, 81, 73]  as [number,number,number] },
        { label: 'Regla Top',         val: d.kpis.regla_top.slice(0, 14),     color: [188, 140, 255] as [number,number,number] },
      ];
      KPIS.forEach((k, i) => {
        const x = 14 + i * (kpiW + 3);
        doc.setFillColor(...k.color); doc.setDrawColor(...k.color);
        doc.roundedRect(x, y, kpiW, kpiH, 2, 2, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
        const valFs = k.val.length > 10 ? 8 : k.val.length > 7 ? 10 : 14;
        doc.setFontSize(valFs);
        const lines = doc.splitTextToSize(k.val, kpiW - 3);
        const valY  = lines.length > 1 ? y + 7.5 : y + 10;
        doc.text(lines.slice(0, 2), x + kpiW / 2, valY, { align: 'center', lineHeightFactor: 1.3 });
        doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
        doc.text(k.label, x + kpiW / 2, y + 15.5, { align: 'center' });
      });
      y += kpiH + 8;

      // ── Gráficos (una página, 3 pares) ──
      const CHART_TITLES = [
        'Detecciones por Cámara', 'Tipos de Infracción',
        'Tendencia Temporal',     'Distribución por Hora',
        'Confianza por Regla',    'Estado de Alertas',
      ];
      const GAP   = 4;
      const CONT  = W - 28;
      const wWide = CONT * 0.62;
      const wNarr = CONT * 0.35;
      const hRow  = CONT * 0.32;

      for (let i = 0; i < this.charts.length; i += 2) {
        if (y + hRow + 12 > H - 15) { doc.addPage(); y = 15; }
        _sect(`${CHART_TITLES[i]}  /  ${CHART_TITLES[i + 1] ?? ''}`);
        if (this.charts[i]) {
          const img = this.charts[i].getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
          // Marco ligero
          doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.3);
          doc.roundedRect(14, y, wWide, hRow, 2, 2, 'S');
          doc.addImage(img, 'PNG', 14, y, wWide, hRow);
        }
        if (this.charts[i + 1]) {
          const img2 = this.charts[i + 1].getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
          doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.3);
          doc.roundedRect(14 + wWide + GAP, y, wNarr, hRow, 2, 2, 'S');
          doc.addImage(img2, 'PNG', 14 + wWide + GAP, y, wNarr, hRow);
        }
        y += hRow + 8;
      }

      // ── Tablas de detalle ──
      if (y + 40 > H - 15) { doc.addPage(); y = 15; }
      _sect('Detalle por Tipo de Infracción');
      autoTable(doc, {
        startY: y,
        head: [['Infracción', 'Detecciones', 'Confianza IA']],
        body: d.por_regla.map(r => [r.regla, r.total, r.confianza + '%']),
        theme: 'striped',
        headStyles:         { fillColor: [35, 139, 230], textColor: 255, fontSize: 9, fontStyle: 'bold', halign: 'center' },
        bodyStyles:         { fontSize: 9, textColor: [40, 40, 40] },
        alternateRowStyles: { fillColor: [245, 248, 255] },
        columnStyles:       { 0: { halign: 'left' }, 1: { halign: 'center' }, 2: { halign: 'center' } },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
      if (y + 40 > H - 15) { doc.addPage(); y = 15; }
      _sect('Detalle por Cámara');
      autoTable(doc, {
        startY: y,
        head: [['Cámara', 'Detecciones', 'Confianza IA']],
        body: d.por_camara.map(r => [r.camara, r.total, r.confianza + '%']),
        theme: 'striped',
        headStyles:         { fillColor: [35, 139, 230], textColor: 255, fontSize: 9, fontStyle: 'bold', halign: 'center' },
        bodyStyles:         { fontSize: 9, textColor: [40, 40, 40] },
        alternateRowStyles: { fillColor: [245, 248, 255] },
        columnStyles:       { 0: { halign: 'left' }, 1: { halign: 'center' }, 2: { halign: 'center' } },
        margin: { left: 14, right: 14 },
      });

      // ── Pie de página ──
      const pages = doc.getNumberOfPages();
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setFillColor(245, 247, 250);
        doc.rect(0, H - 10, W, 10, 'F');
        doc.setFontSize(7.5); doc.setTextColor(100, 120, 150); doc.setFont('helvetica', 'normal');
        doc.text('SIVIC — Sistema de Visión Inteligente para Condominios', 14, H - 3.5);
        doc.text(`Pág. ${p} / ${pages}`, W - 14, H - 3.5, { align: 'right' });
      }

      doc.save(`SIVIC_Reporte_${new Date().toISOString().slice(0,10)}.pdf`);
    } finally {
      this.exportandoPdf.set(false);
    }
  }
}
