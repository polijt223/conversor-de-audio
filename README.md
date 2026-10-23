# 🎵 AudioPulse - Conversor de Audio Local y Privado

**AudioPulse** es una aplicación web local de alto rendimiento diseñada para convertir archivos de audio (y extraer audio de videos) de forma **100% privada, ilimitada y sin depender de conexión a internet ni servidores en la nube**.

Impulsado por el motor nativo **FFmpeg 6.1 (C++)** empaquetado localmente, AudioPulse aprovecha al máximo la aceleración multihilo de tu procesador para convertir archivos a velocidades extremas.

---

## ✨ Características Principales

- ⚡ **Conversión Ultrarrápida**: Procesamiento nativo multihilo en tu CPU sin limitaciones de memoria del navegador.
- 🔒 **100% Privado y Offline**: Tus archivos nunca salen de tu ordenador (`localhost`). Cero telemetría y máxima seguridad para audios confidenciales.
- 📦 **Conversión por Lotes (Batch)**: Añade decenas de archivos a la vez, conviértelos simultáneamente con barra de progreso y descárgalos agrupados en un archivo `.ZIP` con un solo clic.
- 🎧 **Preescucha Integrada**: Reproductor de audio embebido para escuchar tanto el archivo original como el archivo convertido antes de descargar.
- 🎚️ **Control de Calidad y Bitrate**:
  - Ajuste de bitrate: **320 kbps (Estudio)**, **256 kbps**, **192 kbps (Estándar)**, **128 kbps**, **96 kbps (Voz)**.
  - Formatos sin pérdida (Lossless): FLAC y WAV PCM de 16/24 bits.
- 🛠️ **Ajustes Avanzados**:
  - **Frecuencia de muestreo (Sample Rate)**: 44.1 kHz, 48 kHz, 96 kHz, 22.05 kHz o conservar original.
  - **Canales de audio**: Estéreo (2.0), Mono (1.0) o conservar original.
  - **Normalización Inteligente (EBU R128)**: Ajusta el nivel sonoro de forma uniforme sin distorsión ni clipping.
- 🎬 **Extracción de Audio desde Video**: Soporta arrastrar archivos de video (`MP4`, `MKV`, `WEBM`, `AVI`, `MOV`) para extraer directamente la pista de audio a cualquier formato deseado.

---

## 🎛️ Formatos Soportados

| Formato | Tipo | Uso Recomendado |
| :--- | :--- | :--- |
| **MP3** | Con compresión | Universal, compatible con cualquier reproductor, auto y móvil |
| **WAV** | Sin compresión | Edición profesional, producción de audio, máxima fidelidad |
| **FLAC** | Sin pérdida (Hi-Fi) | Archivo musical de alta definición a mitad del peso de WAV |
| **AAC** | Con compresión | Excelente relación calidad/peso, nativo de YouTube y streaming |
| **M4A** | Con compresión | Formato predilecto para el ecosistema Apple (iPhone, Mac) |
| **OGG** | Con compresión | Códec Vorbis abierto, ideal para videojuegos y web |
| **OPUS** | Ultra eficiente | El códec más avanzado para voz, podcasts y streaming moderno |
| **WMA** | Con compresión | Compatibilidad con sistemas y software heredado de Windows |

---

## 🚀 Cómo Iniciar la Aplicación

Tienes dos formas sumamente sencillas de abrir la aplicación:

### Método 1: Un solo clic (Recomendado en Windows)
Haz doble clic sobre el archivo ejecutable:
```text
iniciar.bat
```
Este script iniciará automáticamente el servidor local y abrirá la interfaz en tu navegador predeterminado en `http://localhost:3050`.

### Método 2: Desde la terminal
En la carpeta del proyecto, ejecuta:
```bash
npm start
```
Luego abre tu navegador favorito y accede a:
👉 **[http://localhost:3050](http://localhost:3050)**

---

## 📂 Estructura del Proyecto

```text
conversor de audio/
├── package.json         # Dependencias (express, multer, ffmpeg-static, archiver, cors)
├── server.js            # Servidor local Express + integración nativa con FFmpeg
├── iniciar.bat          # Lanzador automático de 1 clic para Windows
├── .gitignore           # Exclusión de archivos temporales y módulos
├── public/              # Interfaz de usuario (Frontend moderno)
│   ├── index.html       # Estructura semántica, dropzone y controles
│   ├── style.css        # Diseño oscuro de lujo con glassmorphism y animaciones
│   └── app.js           # Lógica interactiva de lotes, previsualización y ZIP
└── temp_uploads/        # Almacenamiento temporal con auto-limpieza periódica
```

---

## 🛡️ Seguridad y Limpieza de Disco

Para no ocupar espacio en tu disco duro, la aplicación incluye una rutina de limpieza automática:
- Los archivos temporales subidos y convertidos se eliminan automáticamente tras su descarga o cuando superan 1 hora de antigüedad.
- Si en cualquier momento deseas reiniciar el espacio, puedes eliminar con total tranquilidad las carpetas `temp_uploads` y `temp_converted`.
