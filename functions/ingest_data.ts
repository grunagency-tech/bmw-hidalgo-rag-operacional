import { createAdminClient } from "npm:@insforge/sdk";
import OpenAI from "npm:openai";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// This function talks directly to OpenAI; it does not use the InsForge Model
// Gateway or OpenRouter.
const EMBEDDING_MODEL = Deno.env.get("OPENAI_EMBEDDING_MODEL") ?? "text-embedding-3-small";
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_CHARS = 5_000_000;
const EXTRACTION_TIMEOUT_MS = 12_000;

type InputFile = {
  file_name?: unknown;
  mime_type?: unknown;
  file_base64?: unknown;
  content?: unknown;
  text?: unknown;
};

type ExtractedFile = {
  fileName: string;
  mimeType: string;
  parser: string;
  text: string;
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function getOpenAI() {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY no está configurada en los secretos del proyecto");
  return new OpenAI({ apiKey });
}

function getAdminClient() {
  const baseUrl = Deno.env.get("INSFORGE_BASE_URL");
  const apiKey = Deno.env.get("API_KEY") ?? Deno.env.get("INSFORGE_API_KEY");
  if (!baseUrl || !apiKey) throw new Error("Faltan INSFORGE_BASE_URL o API_KEY en los secretos");
  return createAdminClient({ baseUrl, apiKey });
}

function decodeBase64(value: string) {
  const encoded = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.byteLength > MAX_FILE_BYTES) {
    throw new Error(`El archivo supera el límite de ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB`);
  }
  return bytes;
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function normalizeCsv(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return text.trim();
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    return values.map((value, index) => `${headers[index] ?? `columna_${index + 1}`}: ${value}`).join(" | ") + ` (fila ${rowIndex + 1})`;
  }).join("\n").trim();
}

function normalizeText(text: string, fileName: string) {
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  if (extension === "csv") return normalizeCsv(text);
  if (extension === "json") {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text.trim();
    }
  }
  return text.trim();
}

async function extractFile(file: InputFile): Promise<ExtractedFile> {
  const fileName = String(file.file_name ?? "archivo");
  const mimeType = String(file.mime_type ?? "application/octet-stream").toLowerCase();
  const lowerName = fileName.toLowerCase();

  if (typeof file.content === "string" || typeof file.text === "string") {
    const rawText = String(file.content ?? file.text ?? "").trim();
    if (rawText.length > MAX_TEXT_CHARS) throw new Error(`El archivo supera el límite de ${MAX_TEXT_CHARS.toLocaleString()} caracteres`);
    return { fileName, mimeType, parser: lowerName.endsWith(".csv") ? "csv" : "text", text: normalizeText(rawText, fileName) };
  }

  if (typeof file.file_base64 !== "string") throw new Error("Cada archivo debe incluir content o file_base64");
  const bytes = decodeBase64(file.file_base64);

  if (mimeType.includes("pdf") || lowerName.endsWith(".pdf")) {
    const text = await withTimeout((async () => {
      const { PDFParse } = await import("npm:pdf-parse");
      const parser = new PDFParse({ data: bytes });
      try {
        const parsed = await parser.getText();
        return String(parsed.text ?? "").trim();
      } finally {
        await parser.destroy();
      }
    })(), EXTRACTION_TIMEOUT_MS, "La extracción del PDF tardó demasiado; puede ser un PDF escaneado o demasiado grande");
    return { fileName, mimeType, parser: "pdf", text };
  }

  if (mimeType.includes("wordprocessingml") || lowerName.endsWith(".docx")) {
    const text = await withTimeout((async () => {
      const { default: mammoth } = await import("npm:mammoth");
      const { Buffer } = await import("node:buffer");
      const parsed = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return String(parsed.value ?? "").trim();
    })(), EXTRACTION_TIMEOUT_MS, "La extracción del DOCX tardó demasiado; revisa que el archivo no esté dañado");
    return { fileName, mimeType, parser: "docx", text };
  }

  const text = new TextDecoder().decode(bytes).trim();
  return { fileName, mimeType, parser: lowerName.endsWith(".csv") ? "csv" : "text", text: normalizeText(text, fileName) };
}

function chunkText(text: string, size = 420, overlap = 60) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let start = 0; start < tokens.length; start += size - overlap) {
    const chunk = tokens.slice(start, start + size).join(" ").trim();
    if (chunk) chunks.push(chunk);
    if (start + size >= tokens.length) break;
  }
  return chunks;
}

async function embedInBatches(openai: OpenAI, inputs: string[]) {
  const embeddings: number[][] = [];
  for (let start = 0; start < inputs.length; start += 64) {
    const batch = inputs.slice(start, start + 64);
    const result = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: batch });
    const ordered = [...result.data].sort((a, b) => a.index - b.index);
    embeddings.push(...ordered.map((item) => item.embedding));
  }
  return embeddings;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return response({ error: "Método no permitido" }, 405);

  try {
    const body = await req.json() as Record<string, unknown>;
    const files = Array.isArray(body.files) && body.files.length
      ? body.files as InputFile[]
      : [body as InputFile];
    const reports: Array<Record<string, unknown>> = [];
    const chunkRecords: Array<{ chunk: string; file: ExtractedFile; index: number; count: number }> = [];

    for (const file of files) {
      const fileName = String(file.file_name ?? "archivo");
      try {
        const extracted = await extractFile(file);
        if (!extracted.text) throw new Error("El archivo no contiene texto extraíble; si es un PDF escaneado necesita OCR");
        const chunks = chunkText(extracted.text);
        if (!chunks.length) throw new Error("No se pudieron crear fragmentos de texto");
        chunks.forEach((chunk, index) => chunkRecords.push({ chunk, file: extracted, index, count: chunks.length }));
        reports.push({ file_name: extracted.fileName, parser: extracted.parser, characters: extracted.text.length, documents_inserted: chunks.length });
      } catch (error) {
        reports.push({ file_name: fileName, error: error instanceof Error ? error.message : "No se pudo leer el archivo" });
      }
    }

    if (!chunkRecords.length) {
      return response({ error: "No se pudo extraer texto de los archivos", files: reports }, 400);
    }

    const openai = getOpenAI();
    const admin = getAdminClient();
    const vectors = await embedInBatches(openai, chunkRecords.map((record) => record.chunk));
    const rows = chunkRecords.map((record, index) => ({
      content: record.chunk,
      embedding: vectors[index],
      metadata: {
        source: String(body.source ?? record.file.fileName),
        file_name: record.file.fileName,
        mime_type: record.file.mimeType,
        parser: record.file.parser,
        chunk_index: record.index,
        chunk_count: record.count,
        embedding_model: EMBEDDING_MODEL,
      },
    }));

    for (let start = 0; start < rows.length; start += 64) {
      const { error } = await admin.database.from("documents").insert(rows.slice(start, start + 64));
      if (error) throw error;
    }

    let productsInserted = 0;
    const products = Array.isArray(body.products) ? body.products as Array<Record<string, unknown>> : [];
    if (products.length) {
      const productText = products.map((product) => `${product.name ?? "Producto"}. ${product.description ?? ""}`);
      const productVectors = await embedInBatches(openai, productText);
      const productRows = products.map((product, index) => ({
        name: String(product.name ?? "Producto"),
        description: String(product.description ?? ""),
        price: typeof product.price === "number" ? product.price : null,
        stock: typeof product.stock === "number" ? product.stock : 0,
        metadata: product.metadata ?? {},
        embedding: productVectors[index],
      }));
      const { error } = await admin.database.from("products").insert(productRows);
      if (error) throw error;
      productsInserted = productRows.length;
    }

    return response({ ok: true, documents_inserted: rows.length, products_inserted: productsInserted, files: reports });
  } catch (error) {
    console.error("ingest_data error", error);
    return response({ error: error instanceof Error ? error.message : "No se pudo procesar la entrada" }, 500);
  }
}
