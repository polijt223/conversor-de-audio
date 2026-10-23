const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const archiver = require('archiver');
const crypto = require('crypto');

const app = express();
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3050;

// Configurar carpetas temporales
const UPLOADS_DIR = path.join(__dirname, 'temp_uploads');
const CONVERTED_DIR = path.join(__dirname, 'temp_converted');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(CONVERTED_DIR)) fs.mkdirSync(CONVERTED_DIR, { recursive: true });

// Almacén en memoria para metadatos de archivos convertidos
const convertedFilesStore = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de Multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const safeExt = path.extname(file.originalname) || '';
    cb(null, `upload-${uniqueSuffix}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 500 // 500 MB por archivo
  }
});

// Limpieza automática periódica (archivos mayores a 1 hora)
function cleanOldFiles() {
  const maxAge = 60 * 60 * 1000; // 1 hora
  const now = Date.now();

  [UPLOADS_DIR, CONVERTED_DIR].forEach(dir => {
    fs.readdir(dir, (err, files) => {
      if (err) return;
      files.forEach(file => {
        const filePath = path.join(dir, file);
        fs.stat(filePath, (statErr, stats) => {
          if (statErr) return;
          if (now - stats.mtimeMs > maxAge) {
            fs.unlink(filePath, () => {});
          }
        });
      });
    });
  });

  // Limpiar memoria
  for (const [id, meta] of convertedFilesStore.entries()) {
    if (now - meta.createdAt > maxAge) {
      convertedFilesStore.delete(id);
    }
  }
}
setInterval(cleanOldFiles, 15 * 60 * 1000); // Cada 15 minutos
cleanOldFiles();

// Estado del sistema y motor FFmpeg
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    ffmpegAvailable: Boolean(ffmpegPath && fs.existsSync(ffmpegPath)),
    engine: 'FFmpeg 6.1 Native Binary',
    supportedFormats: [
      { ext: 'mp3', label: 'MP3 (MPEG Audio Layer III)', lossy: true, defaultBitrate: '320k' },
      { ext: 'wav', label: 'WAV (Waveform Audio Uncompressed)', lossy: false },
      { ext: 'flac', label: 'FLAC (Free Lossless Audio Codec)', lossy: false },
      { ext: 'aac', label: 'AAC (Advanced Audio Coding)', lossy: true, defaultBitrate: '256k' },
      { ext: 'ogg', label: 'OGG (Vorbis Audio)', lossy: true, defaultBitrate: '192k' },
      { ext: 'm4a', label: 'M4A (Apple Audio)', lossy: true, defaultBitrate: '256k' },
      { ext: 'opus', label: 'OPUS (High-Efficiency Speech/Music)', lossy: true, defaultBitrate: '160k' },
      { ext: 'wma', label: 'WMA (Windows Media Audio)', lossy: true, defaultBitrate: '192k' }
    ]
  });
});

// Función auxiliar para construir argumentos de FFmpeg
function buildFfmpegArgs(inputPath, outputPath, format, options = {}) {
  const {
    bitrate = '320k',
    sampleRate = '44100',
    channels = '2',
    normalize = false
  } = options;

  const args = ['-y', '-i', inputPath];

  // Filtros de audio
  const audioFilters = [];
  if (normalize === true || normalize === 'true') {
    audioFilters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
  }

  if (audioFilters.length > 0) {
    args.push('-af', audioFilters.join(','));
  }

  // Tasa de muestreo (Hz)
  if (sampleRate && sampleRate !== 'original') {
    args.push('-ar', sampleRate);
  }

  // Canales (1 = Mono, 2 = Stereo)
  if (channels && channels !== 'original') {
    args.push('-ac', channels);
  }

  // Codecs y bitrate según formato objetivo
  switch (format.toLowerCase()) {
    case 'mp3':
      args.push('-c:a', 'libmp3lame', '-b:a', bitrate);
      break;
    case 'wav':
      args.push('-c:a', 'pcm_s16le');
      break;
    case 'flac':
      args.push('-c:a', 'flac', '-compression_level', '8');
      break;
    case 'aac':
      args.push('-c:a', 'aac', '-b:a', bitrate);
      break;
    case 'm4a':
      args.push('-c:a', 'aac', '-b:a', bitrate, '-movflags', '+faststart');
      break;
    case 'ogg':
      args.push('-c:a', 'libvorbis', '-b:a', bitrate);
      break;
    case 'opus':
      args.push('-c:a', 'libopus', '-b:a', bitrate);
      break;
    case 'wma':
      args.push('-c:a', 'wmav2', '-b:a', bitrate);
      break;
    default:
      args.push('-b:a', bitrate);
      break;
  }

  args.push(outputPath);
  return args;
}

// Endpoint de conversión individual
app.post('/api/convert', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo de audio.' });
  }

  const {
    format = 'mp3',
    bitrate = '320k',
    sampleRate = '44100',
    channels = '2',
    normalize = 'false'
  } = req.body;

  const fileId = crypto.randomUUID();
  const originalParsed = path.parse(req.file.originalname);
  const targetExt = `.${format.toLowerCase()}`;
  const convertedFileName = `${originalParsed.name}_convertido${targetExt}`;
  const convertedFilePath = path.join(CONVERTED_DIR, `${fileId}${targetExt}`);

  const ffmpegArgs = buildFfmpegArgs(req.file.path, convertedFilePath, format, {
    bitrate,
    sampleRate,
    channels,
    normalize
  });

  const proc = spawn(ffmpegPath, ffmpegArgs);
  let stderrData = '';

  proc.stderr.on('data', data => {
    stderrData += data.toString();
  });

  proc.on('close', code => {
    // Eliminar archivo subido original para ahorrar espacio
    fs.unlink(req.file.path, () => {});

    if (code !== 0) {
      console.error('Error FFmpeg:', stderrData);
      return res.status(500).json({
        error: `Error al convertir el archivo a formato ${format.toUpperCase()}`,
        details: stderrData.slice(-500)
      });
    }

    try {
      const stats = fs.statSync(convertedFilePath);
      const meta = {
        id: fileId,
        originalName: req.file.originalname,
        fileName: convertedFileName,
        filePath: convertedFilePath,
        format: format.toLowerCase(),
        size: stats.size,
        createdAt: Date.now()
      };

      convertedFilesStore.set(fileId, meta);

      res.json({
        success: true,
        file: {
          id: fileId,
          originalName: req.file.originalname,
          fileName: convertedFileName,
          format: format.toUpperCase(),
          size: stats.size,
          downloadUrl: `/api/download/${fileId}`
        }
      });
    } catch (statErr) {
      res.status(500).json({ error: 'No se pudo verificar el archivo convertido.' });
    }
  });

  proc.on('error', err => {
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Error al invocar el proceso FFmpeg.', details: err.message });
  });
});

// Endpoint de descarga de archivo individual
app.get('/api/download/:fileId', (req, res) => {
  const meta = convertedFilesStore.get(req.params.fileId);
  if (!meta || !fs.existsSync(meta.filePath)) {
    return res.status(404).send('Archivo no encontrado o expiró su tiempo de almacenamiento.');
  }

  res.download(meta.filePath, meta.fileName);
});

// Endpoint de descarga en lote (ZIP)
app.post('/api/download-zip', (req, res) => {
  const { fileIds = [] } = req.body;
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    return res.status(400).json({ error: 'Debe seleccionar al menos un archivo para descargar.' });
  }

  const validFiles = fileIds
    .map(id => convertedFilesStore.get(id))
    .filter(meta => meta && fs.existsSync(meta.filePath));

  if (validFiles.length === 0) {
    return res.status(404).json({ error: 'Ninguno de los archivos solicitados está disponible.' });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const zipFileName = `audios_convertidos_${timestamp}.zip`;

  res.attachment(zipFileName);
  res.setHeader('Content-Type', 'application/zip');

  const archiverModule = require('archiver');
  const archive = archiverModule.ZipArchive 
    ? new archiverModule.ZipArchive({ zlib: { level: 6 } })
    : archiverModule('zip', { zlib: { level: 6 } });

  archive.on('error', err => {
    console.error('Error al empaquetar ZIP:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al generar el archivo ZIP.' });
    }
  });

  archive.pipe(res);

  const usedNames = new Set();
  validFiles.forEach(meta => {
    let entryName = meta.fileName;
    let counter = 1;
    while (usedNames.has(entryName)) {
      const parsed = path.parse(meta.fileName);
      entryName = `${parsed.name}_(${counter})${parsed.ext}`;
      counter++;
    }
    usedNames.add(entryName);
    archive.file(meta.filePath, { name: entryName });
  });

  archive.finalize();
});

// Iniciar servidor con puerto adaptativo
function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`====================================================`);
    console.log(`🎵 Conversor de Audio Local Activo`);
    console.log(`🚀 Servidor ejecutándose en: http://localhost:${port}`);
    console.log(`⚡ Motor FFmpeg 6.1 cargado correctamente`);
    console.log(`🔒 Procesamiento 100% privado en tu equipo`);
    console.log(`====================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Puerto ${port} ocupado, intentando con puerto ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Error al iniciar servidor:', err);
    }
  });
}

startServer(DEFAULT_PORT);
