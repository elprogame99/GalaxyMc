# GCMS — Gestión integral

Versión preparada para Render con PostgreSQL (Neon) para conservar cuentas, roles y datos de la aplicación entre despliegues.

## Publicación
Consulta [`DEPLOY_RENDER.md`](DEPLOY_RENDER.md). En resumen:
- Render: `npm install` / `npm start`
- Variable `DATABASE_URL`: cadena PostgreSQL de Neon
- Variable `GCMS_ADMIN_PASSWORD`: contraseña inicial segura del administrador

El servidor crea automáticamente las tablas necesarias en PostgreSQL. No subas claves ni credenciales a GitHub.

## Datos persistentes
Las cuentas, roles, tablas importadas y el banner se almacenan en Neon. Los archivos importados se guardan como datos tabulares; el archivo original no se conserva en esta versión. Para almacenar archivos originales (PDF, Excel, imágenes, etc.) se necesita añadir almacenamiento de archivos independiente.

## Archivos del proyecto
- `index.html`: interfaz
- `css/` y `js/`: estilos y lógica de la aplicación
- `servidor.js`: API y servidor
- `package.json`: dependencia de PostgreSQL
- `render.yaml`: configuración de Render
