import { createClient } from '@insforge/sdk';

const insforge = createClient({
  baseUrl: import.meta.env.NEXT_PUBLIC_INSFORGE_URL,
  anonKey: import.meta.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
});

const FALLBACK = 'No tengo información en mis documentos.';
const MAX_FILES = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const sidebar = document.querySelector('#sidebar');
const scrim = document.querySelector('#mobile-scrim');
const input = document.querySelector('#message-input');
const composer = document.querySelector('#composer');
const messages = document.querySelector('#messages');
const sendButton = document.querySelector('#send-button');
const conversationTitle = document.querySelector('#conversation-title');
const fileInput = document.querySelector('#file-input');
const fileStatus = document.querySelector('#file-status');

function toggleSidebar(open) {
  sidebar.classList.toggle('open', open);
  scrim.classList.toggle('visible', open);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));
}

function formatInline(value) {
  const backtick = String.fromCharCode(96);
  return value
    .replace(new RegExp(backtick + '([^' + backtick + ']+)' + backtick, 'g'), '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function renderMarkdown(markdown = '') {
  const lines = escapeHtml(markdown).split(/\r?\n/);
  const output = [];
  let listType = null;
  const closeList = () => {
    if (listType) output.push('</' + listType + '>');
    listType = null;
  };
  for (const line of lines) {
    const unordered = line.match(/^\s*[-*]\s+(.+)/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)/);
    if (unordered || ordered) {
      const nextType = ordered ? 'ol' : 'ul';
      if (listType !== nextType) { closeList(); output.push('<' + nextType + '>'); listType = nextType; }
      output.push('<li>' + formatInline((unordered || ordered)[1]) + '</li>');
    } else if (line.trim()) {
      closeList();
      output.push('<p>' + formatInline(line) + '</p>');
    }
  }
  closeList();
  return output.join('');
}

function sourceMarkup(sources = []) {
  if (!sources.length) return '';
  return '<div class="source-list">' + sources.map((source) => {
    const score = typeof source.score === 'number' ? Math.round(source.score * 100) + '%' : '100%';
    const label = escapeHtml(source.label || (source.type === 'sql' ? 'Datos estructurados' : source.type === 'product' ? 'Producto' : 'Documento'));
    const type = source.type === 'sql' ? 'Consulta SQL segura' : source.type === 'product' ? 'Producto relacionado' : 'Archivo indexado';
    return '<div class="source-card"><div class="source-icon">↗</div><div><strong>' + label + '</strong><span>' + type + ' · fiabilidad ' + score + '</span></div><span class="source-arrow">↗</span></div>';
  }).join('') + '</div>';
}

function emptyStateMarkup() {
  return '<div class="empty-state" aria-live="polite"><div class="empty-mark">✦</div><h1>¿En qué trabajamos hoy?</h1><p>Carga documentos operativos o escribe una pregunta para comenzar.</p></div>';
}

function appendUserMessage(text) {
  document.querySelector('.empty-state')?.remove();
  const userMessage = document.createElement('article');
  userMessage.className = 'message user-message';
  userMessage.innerHTML = '<div class="message-avatar user-avatar">Tú</div><div class="message-body"><p></p></div>';
  userMessage.querySelector('p').textContent = text;
  messages.appendChild(userMessage);
}

function appendAssistantMessage(text, sources = [], mode = '') {
  document.querySelector('.empty-state')?.remove();
  const assistantMessage = document.createElement('article');
  assistantMessage.className = 'message assistant-message';
  const modeLabel = mode ? '<div class="answer-mode">Modo: ' + escapeHtml(String(mode).toUpperCase()) + '</div>' : '';
  assistantMessage.innerHTML = '<div class="message-avatar assistant-avatar">✦</div><div class="message-body">' + modeLabel + '<div class="answer-content">' + renderMarkdown(text) + '</div>' + sourceMarkup(sources) + '<div class="message-actions"><button type="button" aria-label="Copiar respuesta">▣</button><button type="button" aria-label="Respuesta útil">♧</button><button type="button" aria-label="Respuesta no útil">♤</button><button type="button" aria-label="Regenerar respuesta">↻</button></div></div>';
  messages.appendChild(assistantMessage);
}

function resetConversation() {
  messages.innerHTML = emptyStateMarkup();
  conversationTitle.textContent = 'Nuevo chat';
  input.value = '';
  resizeInput();
}

function setImportStatus(text = '', state = '') {
  fileStatus.textContent = text;
  fileStatus.dataset.state = state;
}

function resizeInput() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  sendButton.disabled = !input.value.trim();
}

function base64FromBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function isBinaryDocument(file) {
  const name = file.name.toLowerCase();
  return file.type === 'application/pdf' || file.type.includes('wordprocessingml') || name.endsWith('.pdf') || name.endsWith('.docx');
}

function isSupportedDocument(file) {
  return /\.(pdf|docx|csv|md|markdown|txt|json|html?)$/i.test(file.name);
}

async function createFilePayload(file) {
  if (isBinaryDocument(file)) {
    return {
      file_name: file.name,
      mime_type: file.type || 'application/octet-stream',
      file_base64: base64FromBuffer(await file.arrayBuffer()),
    };
  }
  return {
    file_name: file.name,
    mime_type: file.type || 'text/plain',
    content: await file.text(),
  };
}

async function ingestFile(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} supera el límite de 10 MB por archivo`);
  const payload = await createFilePayload(file);
  const result = await insforge.functions.invoke('ingest_data', { body: { files: [payload] } });
  if (result.error) throw new Error(result.error.message || 'No se pudo invocar ingest_data');
  if (result.data?.error) {
    const detail = result.data.files?.find((item) => item.error)?.error;
    throw new Error(detail ? `${result.data.error}: ${detail}` : result.data.error);
  }
  return result.data;
}

async function validateFiles(files) {
  if (!files.length) return null;
  if (files.length > MAX_FILES) throw new Error(`Puedes cargar hasta ${MAX_FILES} archivos por lote`);
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) throw new Error('El lote supera el límite de 25 MB');
  const oversized = files.find((file) => file.size > MAX_FILE_BYTES);
  if (oversized) throw new Error(`${oversized.name} supera el límite de 10 MB por archivo`);
  const unsupported = files.find((file) => !isSupportedDocument(file));
  if (unsupported) throw new Error(`Formato no compatible: ${unsupported.name}`);
  return files;
}

function ingestionSummary(result) {
  const reports = Array.isArray(result?.files) ? result.files : [];
  const indexed = reports.filter((file) => !file.error);
  const failed = reports.filter((file) => file.error);
  const names = indexed.map((file) => `- **${file.file_name}**: ${file.documents_inserted} fragmento${file.documents_inserted === 1 ? '' : 's'}`).join('\n');
  const errors = failed.map((file) => `- **${file.file_name}**: ${file.error}`).join('\n');
  let summary = `**${indexed.length} archivo${indexed.length === 1 ? '' : 's'} indexado${indexed.length === 1 ? '' : 's'}** con ${result?.documents_inserted ?? 0} fragmento${result?.documents_inserted === 1 ? '' : 's'}.`;
  if (names) summary += `\n\n${names}`;
  if (errors) summary += `\n\n**No se pudieron procesar:**\n${errors}`;
  return { summary, sources: indexed.map((file) => ({ type: 'document', label: file.file_name, score: 1 })) };
}

async function askRag(question) {
  const history = [...messages.querySelectorAll('.message')].slice(-8).map((message) => ({
    role: message.classList.contains('user-message') ? 'user' : 'assistant',
    content: message.querySelector('.message-body')?.textContent?.trim() || '',
  }));
  const result = await insforge.functions.invoke('ask', { body: { question, history } });
  if (result.error) throw new Error(result.error.message || 'No se pudo invocar ask');
  if (result.data?.error) throw new Error(result.data.error);
  return result.data || { answer: FALLBACK, sources: [] };
}

async function processSelectedFiles(files) {
  if (!files.length || fileInput.disabled) return;
  fileInput.disabled = true;
  try {
    await validateFiles(files);
    const reports = [];
    let documentsInserted = 0;
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setImportStatus(`Procesando ${index + 1} de ${files.length}: ${file.name}`, 'loading');
      try {
        const result = await ingestFile(file);
        const report = result?.files?.[0] ?? { file_name: file.name, documents_inserted: result?.documents_inserted ?? 0 };
        reports.push(report);
        documentsInserted += Number(result?.documents_inserted ?? report.documents_inserted ?? 0);
      } catch (error) {
        reports.push({ file_name: file.name, error: error.message });
      }
    }
    const { summary, sources } = ingestionSummary({ files: reports, documents_inserted: documentsInserted });
    appendAssistantMessage(summary, sources);
    setImportStatus(`${documentsInserted} fragmentos indexados`, reports.some((report) => report.error) ? 'error' : 'success');
  } catch (error) {
    setImportStatus(error.message, 'error');
  } finally {
    fileInput.disabled = false;
    fileInput.value = '';
    setTimeout(() => messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' }), 30);
  }
}

document.querySelector('#open-sidebar').addEventListener('click', () => toggleSidebar(true));
document.querySelector('#close-sidebar').addEventListener('click', () => toggleSidebar(false));
scrim.addEventListener('click', () => toggleSidebar(false));

document.querySelectorAll('.chat-row').forEach((row) => {
  row.addEventListener('click', () => {
    document.querySelectorAll('.chat-row').forEach((item) => item.classList.remove('selected'));
    row.classList.add('selected');
    conversationTitle.textContent = row.dataset.title;
    toggleSidebar(false);
  });
});

document.querySelector('#new-chat').addEventListener('click', () => {
  document.querySelectorAll('.chat-row').forEach((item) => item.classList.remove('selected'));
  resetConversation();
  input.focus();
  toggleSidebar(false);
});

document.querySelector('#attach-file').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => processSelectedFiles([...fileInput.files]));

composer.addEventListener('dragover', (event) => {
  event.preventDefault();
  composer.classList.add('dragging');
});
composer.addEventListener('dragleave', () => composer.classList.remove('dragging'));
composer.addEventListener('drop', (event) => {
  event.preventDefault();
  composer.classList.remove('dragging');
  processSelectedFiles([...event.dataTransfer.files]);
});

input.addEventListener('input', resizeInput);
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    if (input.value.trim()) composer.requestSubmit();
  }
});

composer.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text || composer.dataset.loading === 'true') return;
  appendUserMessage(text);
  input.value = '';
  resizeInput();
  composer.dataset.loading = 'true';
  sendButton.disabled = true;
  setImportStatus('Consultando documentos y datos…', 'loading');
  try {
    const result = await askRag(text);
    appendAssistantMessage(result.answer || FALLBACK, result.sources || [], result.mode || '');
    setImportStatus('', '');
  } catch (error) {
    appendAssistantMessage('No se pudo completar la consulta. ' + error.message, []);
    setImportStatus('La consulta requiere configurar OPENAI_API_KEY en los secretos del backend.', 'error');
  } finally {
    composer.dataset.loading = 'false';
    resizeInput();
    setTimeout(() => messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' }), 30);
  }
});

resizeInput();
