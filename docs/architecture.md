# Arquitectura

## Propósito

Este proyecto presenta un RAG (Retrieval-Augmented Generation) para una operación ficticia de BMW Hidalgo. Su objetivo es responder preguntas usando documentos y datos de negocio recuperados en tiempo real, no conocimiento inventado por un modelo de IA.

## Flujo de ingestión

```text
Archivo → extracción de texto → fragmentos → embeddings → PostgreSQL/pgvector
```

`ingest_data` acepta PDF, DOCX, CSV, Markdown, TXT, JSON y HTML. Extrae texto, normaliza CSV y JSON, lo divide en fragmentos de aproximadamente 420 palabras con solapamiento y crea embeddings con `text-embedding-3-small`. Cada fragmento conserva metadatos como archivo, tipo MIME, parser e índice.

Los PDFs escaneados sin texto seleccionable requieren OCR previo. Para proteger el servicio, los límites actuales son 10 MB por archivo en el navegador, 25 MB por lote y 25 MB por archivo en la función.

## Flujo de consulta

```text
Pregunta
  ├─→ catálogo dinámico → SQL SELECT controlado → filas operativas
  └─→ embedding → similitud coseno → documentos y productos relevantes
                                             ↓
                              respuesta basada en evidencia + fuentes
```

La función `ask` trata saludos simples como conversación. Para preguntas operativas, obtiene el catálogo de tablas autorizado y solicita una consulta PostgreSQL. La consulta pasa una validación en TypeScript y una segunda barrera en `run_safe_readonly_query` antes de ejecutarse.

En paralelo, genera un embedding de la pregunta y llama a `match_documents` y `match_products`. Si existe evidencia, `gpt-4o-mini` redacta una respuesta corta en español utilizando únicamente las filas y fragmentos recuperados. Si no existe, se entrega el mensaje de falta de información configurado por el proyecto.

## Componentes de datos

| Componente | Responsabilidad |
| --- | --- |
| `documents` | Fragmentos de archivos, metadatos y embeddings de 1536 dimensiones. |
| `products` | Inventario demo, descripción y embeddings para recomendaciones semánticas. |
| `invoices` / `invoice_items` | Datos cuantitativos demostrativos. |
| `match_documents` / `match_products` | RPCs de similitud coseno con umbral y límite. |
| `get_queryable_schema` | Catálogo de tablas y columnas seguras para el planificador. |
| `run_safe_readonly_query` | Ejecutor de consultas `SELECT` con límite de 50 filas. |

## Consideraciones de producción

- Añadir autenticación y políticas RLS específicas por organización/usuario.
- Mantener documentos privados en un bucket con control de acceso y registrar el propietario de cada archivo.
- Implementar OCR para documentos escaneados.
- Añadir observabilidad de latencia, errores y coste de embeddings.
- Revisar periódicamente índices vectoriales y umbrales conforme crezca el corpus.
