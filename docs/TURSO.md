# Base de datos Turso (MarvePack / Movipack)

La “base de datos” en Vercel era **Vercel Blob** (archivos JSON: `productos.json`, `rubros.json`, etc.).
Ahora esos datos viven en **Turso** (`libsql://marvepack-lerodis…`).

## Qué se migró

Desde `data/` local (catálogo actual del repo):

| Documento        | Destino Turso                          |
|------------------|----------------------------------------|
| `productos.json` | `data_docs` + tabla `productos` (726) |
| `rubros.json`    | `data_docs` + tabla `rubros` (16)     |
| `usuarios.json`  | `data_docs`                            |
| `ajustes.json`   | `data_docs` + tabla `ajustes`          |

## Local

En `.env.local`:

```env
TURSO_DATABASE_URL=libsql://marvepack-lerodis.aws-us-east-2.turso.io
TURSO_AUTH_TOKEN=...
```

Reimportar desde los JSON del repo:

```bash
npm run db:import
```

Con Turso configurado, `lib/data-fs.ts` **lee y escribe en Turso** y ya no usa Blob para esos JSON.

## Vercel (producción)

1. En el proyecto de Vercel → **Settings → Environment Variables**, agregá:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
2. Redesplegá.
3. Opcional: desconectá / dejá de usar el store Blob **solo para datos JSON**.  
   Las fotos pueden seguir en Cloudinary o Blob (`marveBlob2_*`).

## Quitar Blob como base de datos

Cuando Turso esté en producción y verifiques el catálogo:

- Podés borrar del Blob los paths `datos/*.json` (ya no se leen si Turso está activo).
- No hace falta borrar el store entero si todavía sirve para fotos.

## Nota

Si en Vercel Blob había cambios más nuevos que los de `data/` local, exportá esos JSON antes o pedí reimportar desde ahí. Esta migración usó el `data/` del repo (`Developer/movipack`).
