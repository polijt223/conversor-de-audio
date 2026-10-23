// ========================================================
// AudioPulse - Client Application Logic
// ========================================================

document.addEventListener('DOMContentLoaded', () => {
  // Estado de la aplicación
  const state = {
    files: [], // Array de items en la cola
    globalFormat: 'mp3',
    globalBitrate: '320k',
    globalChannels: 'original',
    globalSampleRate: 'original',
    globalNormalize: false,
    isConvertingBatch: false
  };

  // Elementos del DOM
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const formatPillsContainer = document.getElementById('formatPillsContainer');
  const globalBitrateSelect = document.getElementById('globalBitrate');
  const bitrateControlGroup = document.getElementById('bitrateControlGroup');
  const globalChannelsSelect = document.getElementById('globalChannels');
  const globalSampleRateSelect = document.getElementById('globalSampleRate');
  const globalNormalizeCheck = document.getElementById('globalNormalize');
  const toggleAdvancedSettingsBtn = document.getElementById('toggleAdvancedSettingsBtn');
  const advancedSettingsPanel = document.getElementById('advancedSettingsPanel');

  const queueSection = document.getElementById('queueSection');
  const queueStatsBadge = document.getElementById('queueStatsBadge');
  const fileCardsList = document.getElementById('fileCardsList');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const convertAllBtn = document.getElementById('convertAllBtn');
  const convertAllBtnText = document.getElementById('convertAllBtnText');
  const downloadZipBtn = document.getElementById('downloadZipBtn');

  const overallProgressContainer = document.getElementById('overallProgressContainer');
  const overallProgressBar = document.getElementById('overallProgressBar');
  const overallProgressLabel = document.getElementById('overallProgressLabel');
  const overallProgressCount = document.getElementById('overallProgressCount');
  const systemStatusBadge = document.getElementById('systemStatusBadge');
  const toastContainer = document.getElementById('toastContainer');

  // Inicializar estado del sistema
  checkSystemStatus();

  // 1. Selector de Formato Global
  formatPillsContainer.querySelectorAll('.format-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      formatPillsContainer.querySelectorAll('.format-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const selectedFormat = pill.dataset.format;
      state.globalFormat = selectedFormat;

      // Actualizar visibilidad/deshabilitación de bitrate para formatos lossless
      if (selectedFormat === 'wav' || selectedFormat === 'flac') {
        globalBitrateSelect.disabled = true;
        bitrateControlGroup.style.opacity = '0.5';
      } else {
        globalBitrateSelect.disabled = false;
        bitrateControlGroup.style.opacity = '1';
      }

      // Actualizar archivos pendientes en la cola que no hayan sido convertidos
      let updatedCount = 0;
      state.files.forEach(item => {
        if (item.status === 'pending') {
          item.targetFormat = selectedFormat;
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        renderQueue();
        showToast(`Formato global cambiado a ${selectedFormat.toUpperCase()} para archivos pendientes.`, 'info');
      }
    });
  });

  // 2. Selectores de calidad globales
  globalBitrateSelect.addEventListener('change', (e) => {
    state.globalBitrate = e.target.value;
  });

  globalChannelsSelect.addEventListener('change', (e) => {
    state.globalChannels = e.target.value;
  });

  globalSampleRateSelect.addEventListener('change', (e) => {
    state.globalSampleRate = e.target.value;
  });

  globalNormalizeCheck.addEventListener('change', (e) => {
    state.globalNormalize = e.target.checked;
  });

  // 3. Desplegar opciones avanzadas
  toggleAdvancedSettingsBtn.addEventListener('click', () => {
    const isOpen = advancedSettingsPanel.classList.toggle('open');
    const chevron = toggleAdvancedSettingsBtn.querySelector('.chevron-icon');
    if (isOpen) {
      chevron.classList.add('rotate');
    } else {
      chevron.classList.remove('rotate');
    }
  });

  // 4. Drag & Drop y Selección de Archivos
  dropZone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-active');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      handleFilesAdded(droppedFiles);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdded(e.target.files);
      fileInput.value = ''; // Reset para permitir volver a seleccionar el mismo archivo
    }
  });

  // Función para procesar nuevos archivos
  function handleFilesAdded(fileList) {
    const newItems = [];
    Array.from(fileList).forEach(file => {
      const ext = getFileExtension(file.name);
      const itemId = 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

      newItems.push({
        id: itemId,
        file: file,
        originalName: file.name,
        ext: ext,
        size: file.size,
        targetFormat: state.globalFormat,
        status: 'pending', // 'pending' | 'converting' | 'done' | 'error'
        previewUrl: URL.createObjectURL(file),
        downloadUrl: null,
        convertedFileId: null,
        convertedName: null,
        convertedSize: null,
        error: null
      });
    });

    state.files.push(...newItems);
    renderQueue();
    showToast(`Se agregaron ${newItems.length} archivo(s) a la cola.`, 'success');
  }

  // 5. Renderizado de la Cola
  function renderQueue() {
    if (state.files.length === 0) {
      queueSection.style.display = 'none';
      return;
    }

    queueSection.style.display = 'block';
    const totalSize = state.files.reduce((acc, f) => acc + f.size, 0);
    queueStatsBadge.textContent = `${state.files.length} archivo${state.files.length > 1 ? 's' : ''} (${formatBytes(totalSize)})`;

    // Estado del botón descargar ZIP
    const convertedItems = state.files.filter(f => f.status === 'done');
    downloadZipBtn.disabled = convertedItems.length === 0;

    fileCardsList.innerHTML = '';

    state.files.forEach(item => {
      const card = document.createElement('div');
      card.className = `file-card file-status-${item.status}`;
      card.id = `card_${item.id}`;

      let statusBadgeHtml = '';
      if (item.status === 'pending') {
        statusBadgeHtml = `<span class="status-pill pending">En espera</span>`;
      } else if (item.status === 'converting') {
        statusBadgeHtml = `<span class="status-pill converting"><span class="spinner"></span> Convirtiendo...</span>`;
      } else if (item.status === 'done') {
        statusBadgeHtml = `<span class="status-pill done">✓ Listo (${formatBytes(item.convertedSize)})</span>`;
      } else if (item.status === 'error') {
        statusBadgeHtml = `<span class="status-pill error" title="${item.error || 'Error'}">✕ Error</span>`;
      }

      const availableFormats = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma'];
      const formatOptionsHtml = availableFormats.map(fmt => 
        `<option value="${fmt}" ${item.targetFormat === fmt ? 'selected' : ''}>${fmt.toUpperCase()}</option>`
      ).join('');

      card.innerHTML = `
        <div class="file-card-main">
          <div class="file-info-group">
            <div class="file-badge-ext">${item.ext || 'AUD'}</div>
            <div class="file-details">
              <div class="file-name" title="${escapeHtml(item.originalName)}">${escapeHtml(item.originalName)}</div>
              <div class="file-meta">
                <span>${formatBytes(item.size)}</span>
                <span>•</span>
                <span>${item.file.type || 'audio'}</span>
              </div>
            </div>
          </div>

          <div class="file-controls-group">
            <div class="target-select-wrap">
              <span>Convertir a:</span>
              <select class="item-target-format" ${item.status === 'converting' || item.status === 'done' ? 'disabled' : ''}>
                ${formatOptionsHtml}
              </select>
            </div>

            <div class="item-status-wrap">
              ${statusBadgeHtml}
            </div>

            <div class="file-actions">
              ${item.status === 'pending' || item.status === 'error' ? `
                <button type="button" class="btn btn-secondary btn-icon-sm item-convert-btn" title="Convertir individualmente">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </button>
              ` : ''}

              ${item.status === 'done' ? `
                <a href="${item.downloadUrl}" download="${item.convertedName}" class="btn-icon download" title="Descargar este archivo">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </a>
              ` : ''}

              <button type="button" class="btn-icon delete item-remove-btn" title="Eliminar de la cola" ${item.status === 'converting' ? 'disabled' : ''}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
        </div>

        <div class="file-preview-row">
          <audio controls class="audio-preview-player" src="${item.downloadUrl || item.previewUrl}" preload="none"></audio>
        </div>
      `;

      // Eventos individuales
      const selectFormat = card.querySelector('.item-target-format');
      selectFormat.addEventListener('change', (e) => {
        item.targetFormat = e.target.value;
      });

      const removeBtn = card.querySelector('.item-remove-btn');
      removeBtn.addEventListener('click', () => {
        removeItemFromQueue(item.id);
      });

      const convertBtn = card.querySelector('.item-convert-btn');
      if (convertBtn) {
        convertBtn.addEventListener('click', () => {
          convertSingleItem(item);
        });
      }

      fileCardsList.appendChild(card);
    });
  }

  // Eliminar un item de la cola
  function removeItemFromQueue(itemId) {
    const index = state.files.findIndex(f => f.id === itemId);
    if (index !== -1) {
      if (state.files[index].previewUrl) {
        URL.revokeObjectURL(state.files[index].previewUrl);
      }
      state.files.splice(index, 1);
      renderQueue();
    }
  }

  // Limpiar toda la cola
  clearAllBtn.addEventListener('click', () => {
    if (state.isConvertingBatch) return;
    state.files.forEach(f => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    state.files = [];
    overallProgressContainer.style.display = 'none';
    renderQueue();
    showToast('Cola vaciada.', 'info');
  });

  // 6. Conversión Individual de Archivo
  async function convertSingleItem(item) {
    item.status = 'converting';
    renderQueue();

    try {
      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('format', item.targetFormat);
      formData.append('bitrate', state.globalBitrate);
      formData.append('sampleRate', state.globalSampleRate);
      formData.append('channels', state.globalChannels);
      formData.append('normalize', state.globalNormalize);

      const response = await fetch('/api/convert', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status} en la conversión.`);
      }

      const result = await response.json();
      item.status = 'done';
      item.convertedFileId = result.file.id;
      item.downloadUrl = result.file.downloadUrl;
      item.convertedName = result.file.fileName;
      item.convertedSize = result.file.size;
      showToast(`¡${item.originalName} convertido con éxito!`, 'success');
    } catch (err) {
      console.error(err);
      item.status = 'error';
      item.error = err.message;
      showToast(`Error al convertir ${item.originalName}: ${err.message}`, 'error');
    } finally {
      renderQueue();
    }
  }

  // 7. Conversión Por Lotes (Batch)
  convertAllBtn.addEventListener('click', async () => {
    if (state.isConvertingBatch) return;

    const pendingItems = state.files.filter(f => f.status === 'pending' || f.status === 'error');
    if (pendingItems.length === 0) {
      showToast('No hay archivos pendientes para convertir.', 'info');
      return;
    }

    state.isConvertingBatch = true;
    convertAllBtn.disabled = true;
    convertAllBtnText.textContent = 'Convirtiendo lote...';
    overallProgressContainer.style.display = 'block';

    let completed = 0;
    const total = pendingItems.length;

    updateOverallProgress(0, total);

    for (const item of pendingItems) {
      item.status = 'converting';
      renderQueue();

      try {
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('format', item.targetFormat);
        formData.append('bitrate', state.globalBitrate);
        formData.append('sampleRate', state.globalSampleRate);
        formData.append('channels', state.globalChannels);
        formData.append('normalize', state.globalNormalize);

        const response = await fetch('/api/convert', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Error en la conversión.`);
        }

        const result = await response.json();
        item.status = 'done';
        item.convertedFileId = result.file.id;
        item.downloadUrl = result.file.downloadUrl;
        item.convertedName = result.file.fileName;
        item.convertedSize = result.file.size;
      } catch (err) {
        console.error(err);
        item.status = 'error';
        item.error = err.message;
      }

      completed++;
      updateOverallProgress(completed, total);
      renderQueue();
    }

    state.isConvertingBatch = false;
    convertAllBtn.disabled = false;
    convertAllBtnText.textContent = 'Convertir Todos';

    const successCount = pendingItems.filter(f => f.status === 'done').length;
    showToast(`Lote completado: ${successCount} de ${total} convertidos.`, 'success');
  });

  function updateOverallProgress(completed, total) {
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    overallProgressBar.style.width = `${percentage}%`;
    overallProgressLabel.textContent = `Progreso del lote: ${percentage}%`;
    overallProgressCount.textContent = `${completed} / ${total} procesados`;
  }

  // 8. Descarga de Archivos Agrupados en ZIP
  downloadZipBtn.addEventListener('click', async () => {
    const readyItems = state.files.filter(f => f.status === 'done' && f.convertedFileId);
    if (readyItems.length === 0) {
      showToast('No hay archivos convertidos listos para descargar.', 'error');
      return;
    }

    downloadZipBtn.disabled = true;
    showToast('Generando archivo ZIP...', 'info');

    try {
      const fileIds = readyItems.map(f => f.convertedFileId);
      const response = await fetch('/api/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds })
      });

      if (!response.ok) {
        throw new Error('No se pudo generar el archivo ZIP.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audios_convertidos_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showToast('¡Archivo ZIP descargado exitosamente!', 'success');
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      downloadZipBtn.disabled = false;
    }
  });

  // 9. Comprobar estado del servidor
  async function checkSystemStatus() {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        if (data.ffmpegAvailable) {
          systemStatusBadge.querySelector('.status-title').textContent = data.engine || 'FFmpeg 6.1 Nativo';
          systemStatusBadge.querySelector('.status-sub').textContent = '100% Local & Privado';
        }
      }
    } catch (e) {
      console.warn('Servidor offline o no alcanzable aún.', e);
    }
  }

  // Utilidades
  function getFileExtension(filename) {
    return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase();
  }

  function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '✕';

    toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
});
