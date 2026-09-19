-- MarvePack / Movipack — almacenamiento de datos (reemplazo de Vercel Blob JSON)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS data_docs (
  name TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tablas normalizadas (espejo del catálogo para consultas SQL)
CREATE TABLE IF NOT EXISTS rubros (
  clave TEXT PRIMARY KEY,
  etiqueta TEXT NOT NULL,
  imagen TEXT
);

CREATE TABLE IF NOT EXISTS productos (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  seccion TEXT NOT NULL,
  precio REAL NOT NULL DEFAULT 0,
  precio_mayorista REAL,
  imagen TEXT NOT NULL DEFAULT '',
  descripcion TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_productos_seccion ON productos(seccion);
CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos(codigo);

CREATE TABLE IF NOT EXISTS ajustes (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  body TEXT NOT NULL
);
