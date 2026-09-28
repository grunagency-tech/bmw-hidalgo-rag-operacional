# BMW Hidalgo — RAG Operacional

> Caso demostrativo creado por **Grun Tech**. Todos los nombres, contratos, facturas, inventario y documentos incluidos son ficticios.

Una interfaz de chat que convierte documentos operativos en una base de conocimiento consultable. El asistente encuentra evidencia relevante en archivos y datos estructurados, y redacta respuestas trazables en español.

## Qué demuestra

- Carga e indexación de PDF, DOCX, CSV, Markdown, TXT, JSON y HTML.
- Búsqueda semántica de contratos, procedimientos y documentos internos.
- Consultas de datos operativos: inventario, precios, facturas y proveedores.
- Respuestas con fuentes y puntaje de relevancia.
- SQL de solo lectura, validado tanto en la función como en la base de datos.
- Interfaz web responsiva, con carga múltiple de archivos y renderizado Markdown.

## Arquitectura

```text
Navegador (Vite + JavaScript)
        |
        |  invoke: ingest_data / ask
        v
InsForge Edge Functions
        |---------------------> OpenAI API
        |                       gpt-4o-mini + text-embedding-3-small
        v
PostgreSQL + pgvector
  documents · products · invoices · invoice_items
```

1. Al cargar un archivo, `ingest_data` extrae su texto, lo divide en fragmentos y genera un embedding por fragmento.
2. Los fragmentos se guardan en `documents` junto con el nombre del archivo y metadatos de origen.
3. Al hacer una pregunta, `ask` consulta en paralelo datos estructurados y coincidencias semánticas.
4. La respuesta se genera exclusivamente a partir de la evidencia recuperada. Si no existe evidencia, devuelve: `No tengo información en mis documentos.`

## Tecnologías

| Área | Tecnología |
| --- | --- |
| Interfaz | Vite, JavaScript, CSS responsivo |
| Backend | InsForge Edge Functions (TypeScript/Deno) |
| Datos | PostgreSQL, pgvector, JSONB |
| IA | OpenAI `gpt-4o-mini` y `text-embedding-3-small` |
| Seguridad | RLS, RPCs controlados, validación SQL de solo lectura |

## Inicio local

### Requisitos

- Node.js 20 o superior y pnpm.
- Un proyecto de InsForge enlazado localmente.
- Una clave de OpenAI configurada **solo** como secreto del backend.

### Frontend

```bash
pnpm install
pnpm dev
```

Crea un archivo local `.env.local` (no se versiona) con los valores públicos del proyecto InsForge:

```env
NEXT_PUBLIC_INSFORGE_URL=
NEXT_PUBLIC_INSFORGE_ANON_KEY=
```

La clave anónima permite invocar las funciones públicas con sus políticas activas. Nunca uses aquí una clave administrativa.

### Backend

En el panel o CLI de InsForge, configura estos secretos del lado servidor:

```text
OPENAI_API_KEY
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

Después aplica las migraciones de `migrations/` y despliega las funciones:

```bash
npx -y @insforge/cli functions deploy ingest_data --file functions/ingest_data.ts
npx -y @insforge/cli functions deploy ask --file functions/ask.ts
```

Consulta la [guía de arquitectura](docs/architecture.md), la [especificación técnica](docs/technical-specification.md), la [guía de seguridad](docs/security.md) y el detalle de los [datos de demostración](docs/demo-data.md) antes de usarlo fuera de un entorno de muestra.

## Estructura

```text
.
├── app.js                    # Cliente web y flujo de carga/chat
├── functions/                # Edge Functions de ingestión y consulta
├── migrations/               # Esquema, vectores, RPCs y datos demo
├── demo-data/                # Archivos y SQL totalmente ficticios
├── docs/                     # Arquitectura, seguridad y operación
└── styles.css                # Interfaz azul del caso de estudio
```

## Datos de demostración

La carpeta `demo-data/` contiene contratos, facturas e inventario ficticios para mostrar el RAG. No contiene datos personales, contratos, facturas, inventario ni información operativa real de BMW Hidalgo.

## Seguridad

- Las claves y archivos `.env` están excluidos del repositorio.
- Las tablas RAG tienen RLS activo; el navegador no accede directamente a los datos.
- Las consultas operativas se restringen a `SELECT`, sin comentarios, sin `SELECT *` y con un máximo de 50 filas.
- Las funciones bloquean operaciones de escritura o administración como `INSERT`, `UPDATE`, `DELETE`, `DROP` y `ALTER`.
- Los documentos recuperados se tratan como contexto, nunca como instrucciones del sistema.

Para reportar una vulnerabilidad, consulta [SECURITY.md](SECURITY.md).

## Licencia

[MIT](LICENSE) © 2026 Grun Agency Tech.
