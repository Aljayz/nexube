

# Nexube

> Una aplicación de transmisión de medios para escritorio construida con Electron, React y Vite — diseñada para hogares con múltiples perfiles y control de reproducción avanzado.

<p align="center">
  <img src="screenshots/app-view/Home.png" alt="Pantalla de Inicio de Nexube" width="800"/>
</p>

---
## Enlace de Descarga
[Última versión (Nexube v0.2.6)](https://github.com/Aljayz/nexube/releases/tag/v0.2.6)

---
## Ranking
<a href="https://viberank.dev/apps/Nexube" target="_blank" rel="noopener noreferrer"><img src="https://viberank.dev/badge?app=Nexube&theme=dark" alt="Nexube en VibeRank" /></a>

---

## Características

### 🎬 Experiencia Principal
- **Reproductor de Streaming Multi-Fuente** — Cambia sin problemas entre Videasy, VidAPI, VidSrc y AllManga (anime) sin salir del reproductor
- **Modo Imagen en Imagen (PiP)** — Ventana emergente nativa PiP con configuración de marco de ventana multiplataforma
- **Bloqueo de Pop-ups y Redirecciones** — Intercepción a nivel de webview con seguimiento de estadísticas por sesión
- **Gestor de Descargas HLS** — Captura de streams binario integrado `vid-dl` (PyInstaller), con seguimiento de progreso y gestión de cola

### Sistema Multi-Perfil
- **Tres Tipos de Perfil** — Perfiles Maestro, Niños y Estándar, cada uno con configuraciones independientes
- **Protección con PIN/Contraseña** — Perfiles para adultos seguros mientras el Modo Niños sigue siendo accesible
- **Filtrado de Contenido por Edad** — Restricción automática de contenido en el Modo Niños
- **Configuración por Perfil** — Colores de acento personalizados, rutas de descarga, fuente de streaming preferida, umbral de marcar-visto automáticamente e historial de búsqueda

### Gestión de Contenido
- **Lista de Deseos, Historial y Seguimiento de Progreso** — Persistencia en SQLite por perfil, continúa donde lo dejaste
- **Integración con TMDB** — Explora contenido destacado, popular y mejor valorado con metadatos enriquecidos
- **Búsqueda Inteligente** — Busca entre películas y series de TV con historial por perfil

### Detrás del Código
- **Sistema de Retroalimentación en la Aplicación** — Informa problemas directamente mediante un proxy sin servidor → Issues de GitHub
- **Navegación Impulsada por Teclado** — Soporte completo de atajos para usuarios avanzados
- **Multiplataforma** — Instaladores nativos para Windows (NSIS), Linux (AppImage, deb, pacman(próximamente)) y macOS (DMG)(próximamente)

---
## Soporte Futuro
- **Soporte para Móviles**
- **Compilación Nativa para macOS**
- **Plugins de Fuentes Personalizadas**
- **Soporte de Subtítulos**

---

## Capturas de Pantalla

<details>
<summary><strong>Configuración y Bienvenida</strong></summary>
<p align="center">
  <img src="screenshots/app-view/splash.png" alt="Pantalla de Inicio" width="400"/>
  <img src="screenshots/app-view/Setup.png" alt="Configuración de la API de TMDB" width="400"/>
  <img src="screenshots/app-view/setup-profile.png" alt="Configuración de Perfil" width="400"/>
  <img src="screenshots/app-view/setup-profile-w-sec.png" alt="Perfil con Seguridad" width="400"/>
</p>
</details>

<details>
<summary><strong>Interfaz Principal</strong></summary>
<p align="center">
  <img src="screenshots/app-view/Home.png" alt="Inicio" width="400"/>
  <img src="screenshots/app-view/Library.png" alt="Biblioteca" width="400"/>
  <img src="screenshots/app-view/Search.png" alt="Búsqueda" width="400"/>
  <img src="screenshots/app-view/Detail.png" alt="Detalle del Contenido" width="400"/>
  <img src="screenshots/app-view/Player.png" alt="Reproductor" width="400"/>
  <img src="screenshots/app-view/NavSwitch.png" alt="Cambio de Navegación" width="400"/>
</p>
</details>

<details>
<summary><strong>Utilidades y Configuración</strong></summary>
<p align="center">
  <img src="screenshots/app-view/Download.png" alt="Gestor de Descargas" width="400"/>
  <img src="screenshots/app-view/Notif.png" alt="Notificaciones" width="400"/>
  <img src="screenshots/app-view/Settings.png" alt="Configuración" width="400"/>
  <img src="screenshots/app-view/Help.png" alt="Ayuda y Atajos" width="400"/>
  <img src="screenshots/app-view/notice.png" alt="Aviso" width="400"/>
</p>
</details>

---

## Obtención de tu Clave API de TMDB

Nexube depende de [The Movie Database (TMDB)](https://www.themoviedb.org) para obtener todos los metadatos de contenido. Para comenzar, necesitarás generar una clave API personal gratuita. Sigue los pasos a continuación cuidadosamente.

1.  **Crea o Inicia Sesión en tu Cuenta**
    Dirígete a [themoviedb.org](https://www.themoviedb.org). Si ya tienes una cuenta, simplemente inicia sesión. De lo contrario, completa el formulario de registro para crear una.
    ![Iniciar Sesión/Registrarse en TMDB](screenshots/setup-view/setup/tmdb.png)

2.  **Activa tu Cuenta**
    Después de registrarte, revisa la bandeja de entrada del correo electrónico que utilizaste. Encontrarás un enlace de activación; haz clic en él para verificar y activar tu cuenta.
    ![Correo de Activación](screenshots/setup-view/setup/acvtivation.png)

3.  **Navega a la Configuración de la Cuenta**
    Una vez que hayas iniciado sesión y estés en la página principal, haz clic en tu avatar de perfil en la esquina superior derecha.
    ![Página Principal](screenshots/setup-view/setup/landing.png)
    Aparecerá un menú desplegable. Selecciona la opción **"Settings"** (Configuración).
    ![Menú Desplegable de Configuración](screenshots/setup-view/setup/step-1.png)

4.  **Abre la Sección de API**
    En la página de Configuración, localiza el menú de navegación en el lado izquierdo de tu pantalla. Haz clic en la entrada **"API"**.
    ![Enlace Lateral de API](screenshots/setup-view/setup/step-2.png)

5.  **Genera una Nueva Clave API**
    Serás llevado a la página de gestión de API. Haz clic en el botón **"Create"** (Crear) para iniciar el proceso de generación de una nueva clave.
    ![Botón Crear Clave API](screenshots/setup-view/setup/step-3.png)

6.  **Elige el Tipo de Clave**
    Aparecerá un cuadro preguntando cómo pretendes usar la clave API. Selecciona la opción **"Personal Use Only"** (Solo Uso Personal). Esta es la elección adecuada para usar Nexube.
    ![Selección de Uso Personal](screenshots/setup-view/setup/step-4.png)

7.  **Acepta los Términos de Uso**
    Lee los términos, luego marca la casilla de reconocimiento. Haz clic en el botón **"Yes, this is for personal use"** (Sí, esto es para uso personal) para continuar.
    ![Aceptación de los Términos de Uso](screenshots/setup-view/setup/step-5.png)

8.  **Completa el Formulario de Aplicación**
    Rellena los detalles requeridos. Puedes inventar un nombre a tu elección o simplemente copiar el pre-rellenado. Para el **"Application URL"** (URL de la Aplicación), puedes usar un enlace a tu perfil en redes sociales o cualquier URL válida que tengas. **Un consejo rápido:** el sistema a veces requiere un resumen de aplicación más elaborado, así que no dudes en expandir el campo "Summary" (Resumen) con una descripción breve y clara.
    ![Formulario de Detalles de la Aplicación](screenshots/setup-view/setup/step-6.png)

9.  **Revela tu Nueva Clave**
    Una vez que la clave API se cree correctamente, la verás listada en la página. Haz clic en el texto resaltado que representa tu nueva clave para ver sus detalles completos.
    ![Revelar Clave API](screenshots/setup-view/setup/step-7.png)

10. **Copia el Valor de la Clave API**
    Después de hacer clic en el texto resaltado, se expandirá una sección con datos debajo. Busca la cadena aleatoria de caracteres en el campo **"API Key"**. Copia cuidadosamente este valor completo; es lo que pegarás en Nexube.
    ![Copiar Valor de la Clave API](screenshots/setup-view/setup/step-8.png)
> `Nota de Seguridad:` Las claves API deben mantenerse estrictamente confidenciales. La clave mostrada en este ejemplo ha expirado y ya no está activa.
---

## Inicio Rápido

### Requisitos Previos
- **Node.js** ≥ 18
- **pnpm** ≥ 9
- **Python** (para el descargador `vid-dl`)

### Instalación

```bash
# Clone the repository
git clone https://github.com/Aljayz/nexube.git
cd nexube/apps/desktop

# Install dependencies
pnpm install

# Run web-only dev server (hot reload, port 5173)
pnpm dev

# Run full Electron app in dev mode
pnpm electron:dev
```

---

## Scripts Disponibles

| Comando | Descripción |
|---|---|
| `pnpm dev` | Servidor de desarrollo de Vite (solo renderizador, navegador) |
| `pnpm build` | Compilación de producción del renderizador |
| `pnpm electron:dev` | Aplicación Electron con reemplazo de módulos en caliente |
| `pnpm electron:build` | Compilación de producción completa + empaquetado por plataforma |

---

## Atajos de Teclado

| Atajo | Acción |
|---|---|
| `Ctrl/Cmd + K` o `Ctrl/Cmd + F` | Abrir búsqueda |
| `Ctrl/Cmd + Z` | Navegar hacia atrás |
| `Ctrl/Cmd + R` | Recargar aplicación |
| `Ctrl/Cmd + X` | Cerrar sesión |
| `Escape` | Cerrar modal / salir del reproductor |
| `?` | Mostrar superposición de ayuda y atajos |
| `Space` | Reproducir / Pausar |
| `F` | Alternar pantalla completa |
| `←` / `→` | Retroceder / Adelantar 10 segundos |

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Capa de Escritorio | Electron 28 |
| Framework de UI | React 18 + Tailwind CSS 3 |
| Sistema de Compilación | Vite 5 + `vite-plugin-electron` |
| Estado y Base de Datos | SQLite vía `@nexube/store` |
| Streaming | Webview del sistema (incrustaciones iframe) |
| Empaquetado | electron-builder 24 |
| Monorepo | Espacios de trabajo pnpm + Turborepo |

---

## Estructura del Proyecto

```
nexube/
├── apps/desktop/
│   ├── electron/                  # Main process
│   │   ├── main.js                # Window creation, IPC registration
│   │   ├── preload.js             # Context bridge → window.electron.*
│   │   ├── popout-preload.js      # PiP window preload
│   │   ├── ipc/                   # IPC handlers (10 modules)
│   │   └── services/              # Downloader, HLS capture, source resolvers
│   ├── src/                       # Renderer (React)
│   │   ├── pages/                 # Route-level components (7 pages)
│   │   ├── components/            # Reusable UI (30+ components)
│   │   ├── hooks/                 # Custom React hooks (5)
│   │   └── App.jsx                # Root component
│   ├── scripts/                   # Build & utility scripts
│   ├── resources/                 # Bundled binaries (vid-dl per platform)
│   ├── public/                    # Static assets (icons, avatars)
│   ├── package.json
│   ├── vite.config.mjs
│   └── tailwind.config.js
├── packages/
│   ├── store/                     # @nexube/store — SQLite database layer
│   ├── types/                     # @nexube/types — Shared TypeScript definitions
│   ├── player-engine/             # @nexube/player-engine — Player logic
│   └── ui-tokens/                 # @nexube/ui-tokens — Design tokens
└── docs/
    ├── ARCHITECTURE.md
    ├── DEVELOPMENT.md
    └── FEEDBACK_SYSTEM_SETUP.md
```

---

## Compilación para Distribución

```bash
# Linux (AppImage + deb + pacman)
pnpm electron:build

# Windows (NSIS installer) — requires Wine on Linux
pnpm electron:build --win

# macOS (DMG) — requires macOS
pnpm electron:build --mac
```

Los archivos de salida se colocan en `release/`.

---

## Documentación

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — Diseño del sistema, flujo de datos, mapa de IPC
- **[DEVELOPMENT.md](./docs/DEVELOPMENT.md)** — Guía de configuración, convenciones de código, contribuciones
- **[FEEDBACK_SYSTEM_SETUP.md](./docs/FEEDBACK_SYSTEM_SETUP.md)** — Despliegue del proxy de retroalimentación sin servidor

---

## Inspiración

Este proyecto fue inspirado por [Streambert](https://github.com/truelockmc/streambert) de [truelockmc](https://github.com/truelockmc). Aunque Nexube es una implementación completamente independiente escrita desde cero, su trabajo influyó profundamente en el concepto y la arquitectura inicial.

---

## Licencia

**GNU GPL-3.0** — consulte [LICENSE](./LICENSE) para obtener todos los detalles.

Derechos de autor © 2026 [Aljayz](https://github.com/Aljayz)
