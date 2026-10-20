# Publicar GCMS en Render

Este repositorio debe tener `package.json`, `servidor.js` e `index.html` en la raíz.

## Render Web Service
- Runtime: Node
- Root Directory: dejar vacío
- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variable: `GCMS_ADMIN_PASSWORD` = una contraseña segura de al menos 6 caracteres.

La app crea `datos/db.json` al iniciar. En el plan gratuito de Render, el sistema de archivos local es efímero: los datos guardados pueden perderse al reiniciar o volver a desplegar. Para conservar datos permanentemente, configura una base de datos externa o almacenamiento persistente.

Usuario inicial: `admin`.
Contraseña inicial: el valor de `GCMS_ADMIN_PASSWORD`. Si no se define, la aplicación usa `1234`; no uses esa contraseña en producción.
