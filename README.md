# GCMS — Versión 0.2

Prototipo local de interfaz para la futura aplicación GCMS. Esta versión se centra en la navegación, la apariencia y un flujo inicial de importación de datos.

## Cómo abrirla
1. Descarga y descomprime `GCMS_V1.zip`.
2. Abre la carpeta `GCMS_V1`.
3. Haz doble clic en `index.html` para abrirla en un navegador moderno.
4. En **Configuración**, prueba el tema claro/oscuro y los colores.
5. En **Importar archivos**, carga un CSV o un libro Excel (.xlsx/.xls). Si contiene varias hojas, elige la que deseas importar.

No necesita instalación. Para importar Excel, la aplicación carga la biblioteca SheetJS desde internet; los datos del archivo se procesan localmente en el navegador y no se envían a un servidor.

## Novedades 0.2
- Importa Word (.docx), Excel (.xlsx/.xls/.xlsm/.ods), CSV/TSV y HTML; si hay varias tablas u hojas, eliges cuál.
- Cada tabla lleva un **tema** (título) editable y se guarda en el navegador.
- Tabla interactiva: orden, búsqueda, filtros, columnas visibles, paginación (miles de filas), edición de celdas, filas/columnas nuevas, pantalla completa, exportar CSV/Excel.
- Usuarios: primer uso crea al administrador. Admin importa, edita y gestiona cuentas; usuario normal solo consulta y exporta.
- Aviso: las cuentas son solo locales (sin servidor); no sirven como seguridad real ni para datos confidenciales.

## Funciones implementadas (0.1)
- Navegación entre Panel, Importar, Explorador, Procesos, Inventario, Reportes y Configuración.
- Diseño adaptable a escritorio, tabletas y móviles.
- Tema claro y oscuro.
- Colores de acento predefinidos y selector de color personalizado.
- Preferencias de apariencia guardadas en el navegador.
- Lectura local de CSV y Excel (.xlsx/.xls), vista previa, confirmación e historial de sesión.
- Selector de hoja para libros Excel con varias hojas.
- Límite de 15 MB por archivo en esta versión.
- Filtros construidos desde las columnas detectadas.
- Explorador rediseñado con resumen de registros/columnas, tabla con encabezado fijo, filas alternadas, numeración, búsqueda global y filtros.
- Botón de exportación destacado y descarga CSV compatible con Excel; exporta todos los registros importados, aunque la vista esté filtrada.

## Límites conocidos
- La biblioteca lectora de Excel se carga desde CDN; sin conexión a internet, la importación Excel no estará disponible. CSV sigue funcionando sin esa biblioteca.
- Los registros viven solo en memoria durante la sesión; al recargar, desaparecen.
- Los módulos de Procesos, Inventario y Reportes son estructuras visuales pendientes de definición.
- No hay cuentas, permisos, auditoría, base de datos ni servidor.
- No introducir información confidencial o datos reales de la empresa en este prototipo.

## Siguiente etapa sugerida
Añadir mapeo configurable de columnas, reglas para clasificar campos principales/secundarios y validación de datos antes de guardar.

## Novedades 0.5
- **Centro de ayuda renovado**: asistente con búsqueda inteligente (sinónimos, resaltado, efecto de escritura), categorías y 40+ respuestas con todas las reglas de la app. Atajo `?` para abrirla y `Esc` para cerrarla.
- **Más animaciones**: confeti, ondas en botones, brillo que sigue al cursor, fondo animado, iconos que se mueven y barra de tiempo en avisos. Se apagan en Configuración → Animaciones.
- **Usuarios en tarjetas**: estadísticas, búsqueda, filtro por rol, interruptor Usuario | Admin y diálogos propios.
- **Rol propio protegido**: un administrador no puede cambiar su propio rol ni eliminarse (interfaz, modo local y servidor). Otro administrador sí puede.
- **mkcert incluido** en `herramientas/mkcert-master` para HTTPS local; `CREAR_CERTIFICADO.bat` lo usa automáticamente.
- El servidor ya no entrega `certs/`, `herramientas/` ni `servidor.config.json` por la web.
