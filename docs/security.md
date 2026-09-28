# Seguridad y configuración de secretos

## Principios

Las claves nunca se suben a GitHub. Los archivos `.env`, `.insforge/` y las instrucciones locales de agente están excluidos por `.gitignore`.

La aplicación usa dos clases de credenciales:

| Credencial | Dónde vive | Uso |
| --- | --- | --- |
| URL y clave anónima de InsForge | `.env.local` local | El navegador invoca Edge Functions. |
| `OPENAI_API_KEY` | Secretos de InsForge | Las Edge Functions generan respuestas y embeddings. |
| Clave administrativa de InsForge | Secretos internos de la plataforma | Acceso privilegiado de las funciones; jamás en el navegador. |

## Controles implementados

- RLS activo sobre las tablas de documentos, productos y facturas.
- Revocación de acceso directo desde los roles anónimo y autenticado para las tablas protegidas.
- Validación doble del SQL: en `ask.ts` y en el RPC `run_safe_readonly_query`.
- Solo se permite una sentencia `SELECT` sin comentarios y con `LIMIT 50`.
- Se bloquean operaciones destructivas, de escritura o administrativas.
- Las columnas con nombres de secreto, token, clave privada o embedding no se exponen al planificador SQL.
- El contenido de los documentos se considera evidencia no confiable; no puede sustituir instrucciones de sistema.

## Antes de publicar o desplegar

1. Confirma que `git status --ignored` no muestra un `.env` listo para agregar.
2. Ejecuta una búsqueda de secretos antes de cada publicación.
3. Configura `OPENAI_API_KEY` mediante secretos de InsForge, nunca como variable pública.
4. Usa un proyecto o rama de backend independiente para demostraciones públicas.
5. Elimina o anonimiza documentos reales antes de indexarlos.

## Reporte responsable

No abras incidencias públicas que incluyan claves, URLs privadas, datos personales o una prueba de explotación. Usa una asesoría de seguridad privada de GitHub para describir el problema de forma responsable.
