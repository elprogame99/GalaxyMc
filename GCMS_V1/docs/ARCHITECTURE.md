# Arquitectura inicial de GCMS

## Objetivo de la versión 0.1
Crear una interfaz navegable y adaptable sin inventar procesos internos de General Cigar. La versión sirve para validar la estructura visual y el flujo inicial de importación.

## Archivos y responsabilidades

### `index.html`
- Contiene la estructura semántica de la aplicación.
- Declara menú, encabezado, páginas, tablas, formularios y controles.
- Depende de `css/styles.css` y `js/app.js`.
- Entradas: interacción del usuario.
- Salidas: estructura visible de GCMS.
- Errores posibles: si se cambia un `id` utilizado por JavaScript, la función asociada puede dejar de funcionar.
- Prueba: abrir el archivo y comprobar que aparecen menú, panel y pie de página.

### `css/styles.css`
- Define los colores, superficies, tipografía, botones, tablas, paneles y distribución responsive.
- Incluye estilos específicos para el Explorador: indicadores superiores, botón de exportación, tabla rayada, encabezado fijo y primera columna numerada.
- Utiliza variables CSS como `--accent`, `--bg`, `--surface` y `--text`.
- Entradas: tema `data-theme` y variables de color definidas por JavaScript.
- Salidas: presentación visual.
- Errores posibles: un nombre de variable mal escrito puede hacer que un componente no adopte el color.
- Prueba: probar ambos temas, cinco colores predefinidos, color personalizado y anchura móvil.

### `js/app.js`
- Gestiona navegación, preferencias, lectura CSV/Excel, selección de hoja, vista previa, confirmación, filtros, historial y exportación. La exportación descarga todos los registros de la sesión; la búsqueda y los filtros solo afectan la vista.
- Usa SheetJS (`xlsx.full.min.js`) desde CDN para leer `.xlsx` y `.xls`; por eso se necesita internet para cargar esa biblioteca. Los datos del archivo se procesan en el navegador.
- Entradas: clics, búsquedas, selecciones de archivos CSV/Excel, selección de hoja y preferencias de apariencia.
- Salidas: navegación activa, tablas y registros de sesión.
- Errores posibles: CSV mal formado, archivo demasiado grande o bloqueo de almacenamiento local.
- Prueba: importar CSV y Excel válidos/inválidos, cambiar hojas, filtrar, buscar, exportar y cambiar tema.

## Datos y seguridad
- La lectura de CSV ocurre localmente en el navegador.
- Los registros no se guardan de forma permanente.
- No se envían datos a servidores.
- No se ha implementado autenticación ni control de permisos.
- No usar archivos confidenciales de la empresa hasta disponer de autorización y arquitectura de seguridad aprobada.

## Fases siguientes
1. Mapeo de encabezados y normalización flexible de campos.
2. Filtros dinámicos configurables y reglas de clasificación de campos.
3. Persistencia local opcional para prototipo.
4. Backend Java, base de datos, usuarios, roles, auditoría y despliegue empresarial.
