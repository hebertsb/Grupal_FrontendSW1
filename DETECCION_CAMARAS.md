# SIVIC Angular — Guía técnica: Cámaras y Detección IA

> Autor: Hebert Suarez Burgos  
> Última actualización: 2026-06-21

---

## 1. Cómo funciona el panel de cámaras en Angular

El panel (`PanelCamarasComponent`) carga la lista de cámaras desde la API y renderiza una celda por cámara. Cada celda (`CeldaCamaraComponent`) detecta automáticamente el tipo de cámara y muestra la imagen adecuada.

### Rutas de navegación

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/camaras` | `PanelCamarasComponent` | Grid de cámaras en vivo |
| `/reportes` | `ReportesIaComponent` | Dashboard de reportes con gráficos y asistente IA |

---

## 2. Tipos de cámara — cómo los detecta Angular

Todo depende del campo `rtsp_url` que devuelve la API:

```typescript
// celda-camara.component.ts
readonly esLocal = computed(() => this.camara.rtsp_url.startsWith('local://'));
```

| `rtsp_url` | Tipo | Qué muestra Angular |
|-----------|------|---------------------|
| `local://celular-1` | Cámara local (celular Flutter) | Polling del último frame guardado por Flutter |
| `http://.../video` | IP Webcam / MJPEG | `<img>` con stream MJPEG directo |
| `rtsp://...` | Cámara IP fija | Stream MJPEG via proxy Django |

---

## 3. Cámara local (celular Flutter)

### Problema que resuelve
Flutter analiza con la cámara del celular y guarda el último frame en memoria del backend. Angular no tiene acceso RTSP a ese celular, pero puede pedir el último frame guardado.

### Flujo

```
Flutter (cada 2s) → POST /api/camaras/<id>/analizar_local/ → Django guarda frame en cache
Angular (cada 2s) → GET  /api/camaras/<id>/ultimo_frame/?token=<jwt> → recibe JPEG
Angular → actualiza <img src> con timestamp para forzar refresco
```

### Código clave

```typescript
// celda-camara.component.ts
private _refrescarFrameLocal() {
  const token = this.auth.obtenerToken() ?? '';
  this.localFrameUrl.set(
    `${entorno.apiUrl}/camaras/${this.camara.camara_id}/ultimo_frame/` +
    `?token=${encodeURIComponent(token)}&_t=${Date.now()}`
  );
}
```

El `&_t=Date.now()` fuerza al navegador a no cachear la imagen.

El token se pasa como query param porque `<img src>` no soporta headers personalizados. El backend Django acepta el token en `?token=` gracias a `AutenticacionJWT`.

### Template HTML

```html
@if (modo() === 'live' && esLocal()) {
  @if (localFrameUrl()) {
    <img class="celda__media" [src]="localFrameUrl()!" alt="CAM {{ camara.camara_id }}" />
  } @else {
    <div class="celda__estado">Esperando frame local…</div>
  }
}
```

---

## 4. Cámara IP / MJPEG

### Stream en tiempo real

```html
@if (modo() === 'live' && !esLocal()) {
  <img class="celda__media"
       [src]="streamUrl()"
       (load)="cargando.set(false); errorStream.set(false)"
       (error)="errorStream.set(true)" />
}
```

El `streamUrl()` apunta a `GET /api/camaras/<id>/stream/` que es un proxy MJPEG de Django (lee el stream RTSP con OpenCV y lo convierte a multipart/x-mixed-replace).

---

## 5. Análisis IA desde el panel web

La detección IA para cámaras IP se puede disparar manualmente desde el panel. Angular llama a:

```
POST /api/camaras/<id>/analizar_ia/
```

Django captura un frame del RTSP, lo envía al microservicio IA en `http://127.0.0.1:8002/api/analizar` y devuelve el JSON con detecciones y alertas.

**Las cámaras locales no necesitan este botón** — Flutter ya llama a `analizar_local/` automáticamente cada 2 segundos.

---

## 6. Alertas en tiempo real (WebSocket)

Angular mantiene una conexión WebSocket con Django para recibir alertas en tiempo real sin hacer polling:

```typescript
// Conexión al grupo "sivic_alertas"
ws = new WebSocket(`wss://<backend>/ws/alertas/?token=<jwt>`);

ws.onmessage = (msg) => {
  const alerta = JSON.parse(msg.data);
  // alerta contiene: evento_id, camara_nombre, regla_nombre,
  //                  confianza_ia, timestamp, imagen_url,
  //                  conteo_personas, nivel
};
```

Cuando Flutter (o `analizar_ia`) detecta una infracción, Django hace broadcast a todos los clientes Angular conectados via el canal `sivic_alertas` de Django Channels.

---

## 7. Dashboard de Reportes IA

### Ruta: `/reportes`

Componente: `ReportesIaComponent`

#### Datos que consume
```
GET /api/eventos/reportes/resumen/?dias=30&camara_id=X&regla=Y&estado=Z
```

Devuelve:
```json
{
  "kpis": { "total_eventos", "eventos_hoy", "confianza_promedio", "camara_top", "regla_top", "dias" },
  "camaras_disponibles": [{ "id", "nombre" }],
  "reglas_disponibles": ["merodeo", "personas_peleando", ...],
  "por_camara": [{ "id", "camara", "total", "confianza" }],
  "por_regla":  [{ "regla", "total", "confianza" }],
  "por_hora":   [{ "hora", "total" }],
  "por_dia":    [{ "fecha", "total" }],
  "por_estado": [{ "estado", "total" }]
}
```

#### 6 gráficos ECharts
| Gráfico | Tipo | Interacción |
|---------|------|-------------|
| Eventos por cámara | Barras horizontales | Click → filtra por cámara |
| Infracciones detectadas | Dona | Click → filtra por regla |
| Tendencia temporal | Línea | Solo lectura |
| Distribución por hora | Barras verticales | Solo lectura |
| Confianza promedio por regla | Barras | Solo lectura |
| Estado de alertas | Dona | Click → filtra por estado |

#### Asistente IA por voz
```
Usuario habla → Web Speech API → texto transcripto
→ POST /api/eventos/reportes/consulta/ { pregunta, datos }
→ Django llama a Groq (LLaMA 3.1 8B)
→ Respuesta en lenguaje natural
```

---

## 8. Archivos clave

| Archivo | Qué hace |
|---------|----------|
| `src/app/panel-camaras/componentes/celda-camara/celda-camara.component.ts` | Lógica de tipo de cámara, polling frame local, stream MJPEG |
| `src/app/panel-camaras/componentes/celda-camara/celda-camara.component.html` | Template con @if para local vs IP |
| `src/app/reportes/paginas/reportes-ia/reportes-ia.component.ts` | Dashboard: carga datos, renderiza ECharts, asistente voz |
| `src/app/reportes/paginas/reportes-ia/reportes-ia.component.html` | Template del dashboard |
| `src/app/app.routes.ts` | Rutas de navegación |
| `src/app/compartido/componentes/barra-lateral/barra-lateral.component.ts` | Links del menú lateral |
| `src/environments/environment.ts` | `apiUrl` — URL del backend |

---

## 9. Configuración de entorno

```typescript
// src/environments/environment.ts
export const entorno = {
  apiUrl: 'http://localhost:8001/api',  // desarrollo local
  // apiUrl: 'https://smart-condominium.onrender.com/api',  // producción
};
```

**No cambiar `apiUrl` manualmente en producción.** El archivo `environment.production.ts` se usa al compilar con `ng build --configuration production`.

---

## 10. Cómo agregar visualización de un nuevo tipo de alerta

Si el backend agrega una nueva alerta (ej. `perro_detectado`), Angular necesita:

### 1. El WebSocket ya la recibe automáticamente
El campo `regla_nombre` del mensaje WebSocket contendrá el nombre de la regla que el admin configuró.

### 2. Agregar al dashboard de reportes
El endpoint `reportes/resumen/` ya la incluirá en `por_regla` automáticamente — sin cambios en Angular.

### 3. Si se quiere badge especial en la celda de cámara
```typescript
// En el onmessage del WebSocket
if (alerta.regla_nombre === 'perro_en_area') {
  this.mostrarBadgePerro.set(true);
  setTimeout(() => this.mostrarBadgePerro.set(false), 5000);
}
```

---

## 11. Qué NO tocar

| Qué | Por qué |
|-----|---------|
| `?token=<jwt>` en `ultimo_frame/` | Sin esto el endpoint devuelve 401; `<img>` no puede enviar headers |
| `&_t=Date.now()` en `localFrameUrl` | Sin esto el navegador cachea la imagen y no se actualiza |
| `setInterval` de 2000ms en cámara local | Menor tiempo satura el backend; mayor produce lag visual notable |
| Imports de ECharts (`import * as echarts from 'echarts'`) | La librería no tiene default export; cambiar el import rompe los gráficos |
| `ResizeObserver` en el componente de reportes | Necesario para que los gráficos se redimensionen con la ventana |

---

## 12. Troubleshooting

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| Cámara local muestra "Sin señal" | Flutter no está enviando frames | Iniciar la app Flutter con la cámara local activa |
| Stream MJPEG gira o congela | OpenCV perdió la conexión RTSP | El stream se reconecta solo; esperar o recargar |
| Gráficos vacíos en reportes | Sin eventos en la BD en los últimos N días | Cambiar el filtro de período o generar detecciones de prueba |
| "Error al consultar IA" en asistente | Backend caído o GROQ_API_KEY no configurada | Verificar que Django corra y `.env` tenga la clave |
| WebSocket no conecta | Token expirado o backend sin ASGI | Hacer logout/login; verificar que Django corre con `uvicorn` no `runserver` |
