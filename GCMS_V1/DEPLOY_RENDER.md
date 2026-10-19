# Desplegar GCMS en Render

## Configuración
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Usuario inicial: `admin`
- Contraseña inicial: la variable `GCMS_ADMIN_PASSWORD` configurada en Render. Si no se configura, el código usa `1234`; no dejes esa contraseña en producción.

## Importante sobre datos y seguridad
- El plan gratuito de Render no garantiza almacenamiento persistente para `datos/db.json`. Los datos pueden perderse al reiniciar o desplegar. No uses información importante hasta configurar una base de datos o almacenamiento persistente adecuado.
- La aplicación guarda los datos en un archivo JSON local y no está diseñada como sistema de producción endurecido. Usa una contraseña fuerte y no subas certificados, claves, credenciales ni datos privados a GitHub.
- La contraseña inicial solo se aplica cuando el archivo `datos/db.json` no contiene usuarios. Si ya existe una cuenta, cambiar la variable no restablece su contraseña.
- El servicio local no requiere dependencias npm externas.
