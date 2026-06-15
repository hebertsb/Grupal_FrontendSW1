# SIVIC Web — Panel de Administración y Vigilancia

Panel Angular 17 para el sistema SIVIC. Muestra cámaras en tiempo real estilo NVR, gestiona eventos de seguridad detectados por IA, recibe alertas WebSocket en tiempo real y permite configurar cámaras, reglas y usuarios.

---

## Requisitos previos

- Node.js >= 18
- Angular CLI 17: `npm install -g @angular/cli`
- Backend SIVIC corriendo con uvicorn (ver README del backend)

---

## Configurar URL del backend

Editar `src/environments/environment.ts`:

```typescript
export const entorno = {
  produccion: false,
  apiUrl: 'http://192.168.1.X:8000/api',  // IP del PC con el backend
  wsUrl:  'ws://192.168.1.X:8000',         // misma IP, protocolo ws://
};
```

Por defecto apunta a `localhost:8000`. Cambiar la IP si el backend corre en otra máquina de la red.

---

## Correr la app

```bash
npm install
ng serve
```

Acceder a `http://localhost:4200`

Para exponer en la red local (acceso desde otro dispositivo):
```bash
ng serve --host 0.0.0.0
```

---

## Estructura del proyecto

```
src/app/
├── app.component.ts               # Root component
├── app.config.ts                  # provideRouter, provideHttpClient, etc.
├── app.routes.ts                  # Rutas raíz con lazy loading
│
├── autenticacion/
│   └── paginas/login/             # Pantalla de login con JWT
│
├── compartido/
│   ├── componentes/
│   │   ├── cabecera/              # Header: campana de notificaciones WS + tema
│   │   ├── barra-lateral/         # Sidebar de navegación
│   │   └── diseno-principal/      # Shell con cabecera + sidebar
│   ├── modelos/                   # DTOs: Camara, Evento, Notificacion, Usuario
│   └── servicios/
│       ├── autenticacion.servicio.ts   # Login, logout, token en localStorage
│       ├── notificaciones.servicio.ts  # WebSocket RxJS + signals Angular
│       ├── camaras.servicio.ts
│       ├── eventos.servicio.ts
│       ├── planos.servicio.ts
│       ├── ia.servicio.ts
│       └── tema.servicio.ts
│
├── nucleo/
│   ├── guardias/
│   │   ├── auth.guard.ts          # Redirige a /login si no hay token
│   │   └── redirect-rol.guard.ts  # Redirige a /dashboard o /guardia segun rol
│   └── interceptores/
│       └── jwt.interceptor.ts     # Agrega Authorization: Bearer <token> a cada request HTTP
│
├── panel-camaras/
│   ├── componentes/
│   │   ├── celda-camara/          # Tile individual: imagen MJPEG + estado + acciones
│   │   └── cuadricula-camaras/    # Grid 1×1 / 2×2 / 3×3 / 4×4
│   └── paginas/panel-principal/   # Pantalla NVR principal
│
├── eventos/
│   └── paginas/lista-eventos/     # Tabla de eventos con filtros, cambio de estado inline
│
├── dashboard/
│   └── paginas/dashboard-admin/   # Resumen estadístico para admin
│
├── guardia/
│   └── paginas/dashboard-guardia/ # Vista simplificada para guardia
│
├── configuracion/
│   └── paginas/
│       ├── camaras/               # CRUD de cámaras (URL RTSP, tipo, nombre)
│       ├── reglas/                # CRUD de reglas de detección IA
│       └── usuarios/              # CRUD de usuarios del sistema
│
├── auditoria/
│   └── paginas/logs/              # Log de acciones del sistema
│
└── plano/
    └── paginas/plano-condominio/  # Plano del condominio con posición de cámaras
```

---

## Pantallas disponibles

| Ruta | Rol | Descripción |
|---|---|---|
| `/login` | Todos | Autenticación |
| `/camaras` | Todos | Panel NVR: grid de cámaras en tiempo real |
| `/alertas` | Todos | Historial de eventos IA con filtros |
| `/plano` | Todos | Plano del condominio con cámaras |
| `/dashboard` | Admin | Resumen estadístico |
| `/guardia` | Guardia | Dashboard simplificado |
| `/configuracion/camaras` | Admin | Alta/baja/edición de cámaras |
| `/configuracion/reglas` | Admin | Reglas de detección y umbrales |
| `/configuracion/usuarios` | Admin | Gestión de usuarios |
| `/auditoria` | Admin | Log de acciones |

---

## Notificaciones WebSocket en tiempo real

### Cómo funciona

```
Backend YOLO detecta infracción
        ↓
POST /api/eventos/inferencia/
        ↓
Django emite al grupo WebSocket "sivic_alertas"
        ↓
NotificacionesServicio recibe mensaje JSON
        ↓
Signal alertas() actualizado
        ↓
cabecera.component.html → badge campana con contador
Lista de alertas en dropdown sin recargar página
```

### Servicio (`notificaciones.servicio.ts`)

Usa `webSocket()` de `rxjs/webSocket` + Angular Signals:

```typescript
// Signals reactivos
readonly alertas  = signal<AlertaWS[]>([]);
readonly noLeidas = computed(() => this.alertas().filter(a => !a.leida).length);

// Conecta al backend con el JWT del usuario logueado
conectar(token: string) { ... }  // ws://<host>:8000/ws/alertas/?token=<jwt>

// Auto-reconexión cada 5s si el canal se cierra
desconectar()           // limpia y para reconexión
marcarLeida(id)         // marca alerta individual como leída
marcarTodasLeidas()     // limpia badge
```

**URL de conexión:** `entorno.wsUrl + '/ws/alertas/?token=' + token`

Si el token es inválido el backend cierra con código `4001`. El servicio reintenta automáticamente cada 5s.

### Visualización en UI

- **`cabecera.component.html`**: campana con badge `noLeidas()`, dropdown con lista de alertas al hacer click
- Timestamp mostrado con `| date:'HH:mm:ss':'-0400'` (Bolivia UTC-4)
- Las alertas sin leer se marcan visualmente y al hacer click navegan a `/alertas`

---

## Stream de cámaras (MJPEG)

El panel de cámaras usa `<img [src]="url">` donde la URL apunta al endpoint del backend:

```
http://<host>:8000/api/camaras/<id>/stream/
```

El backend sirve `multipart/x-mixed-replace` (MJPEG) con frames JPEG continuos. El navegador los muestra como video en tiempo real sin ninguna librería adicional.

**Tipos de cámara soportados:**

| Tipo | URL que configuras en BD |
|---|---|
| RTSP cámara IP | `rtsp://admin:pass@192.168.1.X:554/stream` |
| RTSP celular (DailyRoutes) | `rtsp://192.168.1.X:5540/back` |
| HTTP MJPEG (IP Webcam) | `http://192.168.1.X:8080/video` |
| URL pública | `http://X.X.X.X/mjpg/video.mjpg` |

Si una cámara falla, la celda muestra "Sin señal" con botón "Reintentar" que recarga la URL.

---

## Autenticación y roles

- Login → `POST /api/autenticacion/login/` → JWT guardado en `localStorage` clave `sivic_token`
- `jwt.interceptor.ts` agrega `Authorization: Bearer <token>` a todos los requests HTTP
- `auth.guard.ts` redirige a `/login` si no hay token
- `redirect-rol.guard.ts` redirige según campo `rol` del JWT: `admin` → `/dashboard`, `guardia` → `/guardia`

---

## Timestamps

Backend devuelve `"2026-06-13T18:45:00Z"` (UTC ISO 8601). Angular muestra en Bolivia (UTC-4):

```html
<!-- Eventos -->
{{ ev.timestamp_deteccion | date:'dd/MM/yy HH:mm':'-0400' }}

<!-- Alertas WS en cabecera -->
{{ a.timestamp | date:'HH:mm:ss':'-0400' }}
```

---

## Modo oscuro / claro

`tema.servicio.ts` alterna la clase `tema-oscuro` en `<body>` y persiste en `localStorage`. El botón está en la cabecera (icono sol/luna).

---

## Colaboradores

- Hebert Suárez Burgos
