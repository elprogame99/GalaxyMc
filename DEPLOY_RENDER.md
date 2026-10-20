# Publicar GCMS en Render con PostgreSQL de Neon

## 1. Subir los archivos a GitHub
Sube el contenido de esta carpeta a la raíz del repositorio (donde ya están `index.html`, `js/`, `css/`, `servidor.js` y `package.json`). No subas contraseñas, `.env`, certificados ni `datos/db.json`.

## 2. Preparar Neon
1. Entra a tu proyecto de Neon.
2. En **Computes**, si aparece **SUSPENDED**, intenta reanudar/activar el compute desde el menú de tres puntos o desde la opción de conexión. Si Neon no permite reanudarlo, revisa el estado del proyecto y crea/activa un compute disponible.
3. En **Connect**, copia la cadena de conexión PostgreSQL para Node.js. Usa la URL completa que Neon proporciona; no la publiques en GitHub.
4. Las tablas `gcms_users` y `gcms_state` se crean automáticamente al arrancar el servidor. No tienes que ejecutar SQL manualmente.

## 3. Variables de entorno en Render
En el servicio web `zzz`, abre **Environment → Edit** y agrega estas variables:

- `DATABASE_URL` = la cadena de conexión completa de Neon.
- `GCMS_ADMIN_PASSWORD` = una contraseña nueva y segura de al menos 12 caracteres para la cuenta inicial `admin`.

No pongas la URL ni la contraseña en archivos del repositorio. Si ya existe `DATABASE_URL`, comprueba que corresponde al proyecto de Neon correcto.

## 4. Configuración del servicio Render
- Runtime: Node
- Root Directory: vacío si estos archivos están en la raíz del repositorio
- Build Command: `npm install`
- Start Command: `npm start`
- Luego pulsa **Manual Deploy → Deploy latest commit**.

## 5. Primer inicio de sesión
Si la base de datos está vacía, se crea el usuario `admin` con el valor de `GCMS_ADMIN_PASSWORD`. Si ya hay usuarios en Neon, no se reemplazan ni se cambia su contraseña automáticamente. Inicia sesión y cambia la contraseña desde la aplicación si corresponde.

## Qué se guarda
- Las cuentas y roles se guardan en PostgreSQL/Neon.
- Las tablas/datasets importados y el banner se guardan en PostgreSQL/Neon cuando la app muestra “Guardado en servidor”.
- Los archivos importados se convierten en datos tabulares en el navegador; esta versión no conserva una copia binaria del archivo original. Si necesitas guardar los archivos originales, hace falta añadir un servicio de almacenamiento de objetos y una función de subida.
- Los datos persisten al reiniciar o volver a desplegar Render porque se guardan en Neon, no en el disco temporal de Render.

## Si no funciona
- Revisa **Render → Logs**. `Falta DATABASE_URL` significa que la variable no se configuró correctamente.
- Un error de conexión suele indicar que el compute de Neon sigue suspendido, la URL está mal copiada o la conexión fue revocada.
- Si Render no ve el cambio, confirma que GitHub recibió el commit correcto y vuelve a desplegar.
- No compartas capturas que muestren el valor completo de `DATABASE_URL` o contraseñas.
