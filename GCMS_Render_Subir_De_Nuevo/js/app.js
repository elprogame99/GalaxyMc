/** GCMS v0.5 — importación (Word/Excel/CSV/HTML), tablas interactivas editables, pantalla completa y usuarios admin/normal.
 *  Todo local en el navegador (localStorage). La seguridad de cuentas es solo de interfaz: para producción se necesita backend. */
(() => {
  "use strict";
  const K = { theme: "gcms.v1.theme", accent: "gcms.v1.accent", users: "gcms.users", prefs: "gcms.prefs", data: "gcms.datasets", session: "gcms.session" };
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); queueFolder(); return true; } catch { toast("No se pudo guardar en el navegador (almacenamiento lleno).", "error"); return false; } };
  const S = { theme: load(K.theme, "light"), accent: load(K.accent, "#2f8f68"), datasets: load(K.data, []), active: null, preview: null, user: null, sort: null, page: 0, hidden: {}, filters: {}, dense: false, prefs: { anim: true, font: 14, perPage: 100, side: false, ...load(K.prefs, {}) } };
  let PAGE = S.prefs.perPage;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function toast(m, k = "info") { const n = document.createElement("div"); n.className = "toast " + k; n.textContent = m; $("#toastRegion").appendChild(n); setTimeout(() => n.remove(), 4000); }
  const isAdmin = () => S.user?.role === "admin";
  const persist = () => { save(K.data, S.datasets); push(); if (!S.server) setSave("Guardado ✓"); };


  /* ---------- Preferencias ---------- */
  function applyPrefs() {
    const p = S.prefs; PAGE = +p.perPage || 100;
    document.body.classList.toggle("no-anim", !p.anim); document.body.classList.toggle("side-compact", !!p.side);
    document.documentElement.style.fontSize = ""; document.body.style.fontSize = p.font + "px";
    $("#animToggle").checked = p.anim; $("#sideToggle").checked = p.side; $("#perPage").value = String(PAGE);
    $$("[data-font]").forEach(b => b.classList.toggle("selected", +b.dataset.font === +p.font));
  }
  const setPref = (k, v) => { S.prefs[k] = v; save(K.prefs, S.prefs); applyPrefs(); if (S.user) renderExplorer(); };

  /* ---------- Carpeta de datos (File System Access API: Chrome/Edge) ---------- */
  const FILE = "gcms-datos.json", KEYS = [K.users, K.data, K.theme, K.accent, K.prefs, "gcms.banner"];
  let dir = null, granted = false, timer = null;
  const idb = (m, v) => new Promise(res => { const r = indexedDB.open("gcms-fs", 1); r.onupgradeneeded = () => r.result.createObjectStore("h"); r.onerror = () => res(null);
    r.onsuccess = () => { const st = r.result.transaction("h", m === "get" ? "readonly" : "readwrite").objectStore("h"), q = m === "get" ? st.get("dir") : st.put(v, "dir"); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }; });
  function folderUI() { const t = $("#folderTag"); if (!t) return; t.textContent = granted ? "Carpeta conectada ✓" : dir ? "Carpeta pendiente" : "Sin carpeta"; $("#folderBtn").textContent = dir && !granted ? "📁 Reconectar carpeta" : "📁 Conectar carpeta"; $("#lgFolder").textContent = dir && !granted ? "📁 Reconectar carpeta de datos" : "📁 Conectar carpeta de datos"; }
  function queueFolder() { if (!granted) return; clearTimeout(timer); timer = setTimeout(writeFolder, 400); }
  const acctFile = u => `// Cuenta GCMS. Cambia "rol" a "admin" o "user", guarda el archivo y abre la app.\nwindow.GCMS_ACCOUNTS = window.GCMS_ACCOUNTS || [];\nwindow.GCMS_ACCOUNTS.push({\n  nombre: ${JSON.stringify(u.name)},\n  usuario: ${JSON.stringify(u.username)},\n  rol: ${JSON.stringify(u.role)},\n  salt: ${JSON.stringify(u.salt)},\n  hash: ${JSON.stringify(u.hash)} // contraseña cifrada, no editar\n});\n`;
  async function writeFolder() { try { const o = {}; KEYS.filter(k => k !== K.users).forEach(k => o[k] = localStorage.getItem(k)); const d = await dir.getDirectoryHandle("datos", { create: true }), c = await d.getDirectoryHandle("cuentas", { create: true }); const put = async (h, n, t) => { const w = await (await h.getFileHandle(n, { create: true })).createWritable(); await w.write(t); await w.close(); }; const us = users(); await put(d, FILE, JSON.stringify(o)); for (const u of us) await put(c, u.username + ".js", acctFile(u)); for await (const [n] of c.entries()) if (n.endsWith(".js") && !us.some(u => u.username + ".js" === n)) await c.removeEntry(n); await put(d, "cuentas.js", JSON.stringify(us.map(u => u.username)) + ".forEach(n=>document.write('<script src=\"datos/cuentas/'+n+'.js\"><\\/script>'));"); } catch { granted = false; folderUI(); } }
  async function readFolder() { try { const d = await dir.getDirectoryHandle("datos"); const o = JSON.parse(await (await (await d.getFileHandle(FILE)).getFile()).text()); Object.entries(o).forEach(([k, v]) => k !== K.users && v != null && localStorage.setItem(k, v)); return true; } catch { return false; } }
  function reloadState() { S.datasets = load(K.data, []); S.theme = load(K.theme, "light"); S.accent = load(K.accent, "#2f8f68"); Object.assign(S.prefs, load(K.prefs, {})); S.active = null; applyAppearance(); applyPrefs(); setupLogin(); folderUI(); if (S.user) { const u = users().find(x => x.username === S.user.username); u ? enter(u) : logout(); } }
  async function connectFolder() {
    try {
      if (dir && !granted) granted = (await dir.requestPermission({ mode: "readwrite" })) === "granted";
      else { if (!window.showDirectoryPicker) return toast("Este navegador no permite elegir carpeta. Usa Chrome o Edge, o las copias de seguridad.", "error"); dir = await showDirectoryPicker({ mode: "readwrite" }); await idb("put", dir); granted = true; }
      if (!granted) return folderUI();
      if (!await readFolder()) await writeFolder();
      reloadState(); toast("Carpeta conectada: los datos se guardan en " + FILE, "success");
    } catch { /* cancelado */ }
  }
  async function restoreFolder() { try { const h = await idb("get"); if (!h) return; dir = h; if (await h.queryPermission({ mode: "readwrite" }) === "granted") { granted = true; await readFolder(); reloadState(); } else folderUI(); } catch {} }
  function exportBackup() { const o = {}; KEYS.forEach(k => o[k] = localStorage.getItem(k)); download("gcms-copia.json", new Blob([JSON.stringify(o)], { type: "application/json" })); }
  async function importBackup(f) { try { const o = JSON.parse(await f.text()); if (!o[K.users] && !o[K.data]) throw 0; Object.entries(o).forEach(([k, v]) => KEYS.includes(k) && v != null && localStorage.setItem(k, v)); queueFolder(); reloadState(); toast("Copia restaurada.", "success"); } catch { toast("Archivo de copia no válido.", "error"); } }
  async function saveAcc() {
    if (S.server) { try { const d = await api("users", "POST", { action: "self", name: $("#eName").value.trim(), username: $("#eUser").value.trim().toLowerCase(), old: $("#ePassOld").value, value: $("#ePassNew").value }); $("#ePassOld").value = $("#ePassNew").value = ""; enter(d.user); toast("Cuenta actualizada.", "success"); } catch (e) { toast(e.message, "error"); } return; }
    const list = users(), me = list.find(x => x.username === S.user.username); if (!me) return;
    const name = $("#eName").value.trim(), un = $("#eUser").value.trim().toLowerCase(), old = $("#ePassOld").value, np = $("#ePassNew").value;
    if (me.hash !== await hash(old, me.salt)) return toast("La contraseña actual no es correcta.", "error");
    if (!name || !/^[a-z0-9._-]{3,}$/.test(un)) return toast("Escribe tu nombre y un usuario de 3+ caracteres (letras, números . _ -).", "error");
    if (un !== me.username && list.some(x => x.username === un)) return toast("Ese usuario ya existe.", "error");
    if (np && np.length < 6) return toast("La nueva contraseña debe tener al menos 6 caracteres.", "error");
    me.name = name; me.username = un; if (np) me.hash = await hash(np, me.salt);
    save(K.users, list); try { sessionStorage.setItem(K.session, un); } catch {}
    $("#ePassOld").value = $("#ePassNew").value = ""; enter(me); toast("Cuenta actualizada.", "success");
  }
  const fmtSize = b => !b ? "—" : b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(1) + " MB";
  function countUp(el, to) { const end = +String(to).replace(/\D/g, "") || 0; if (!S.prefs.anim || end < 2) { el.textContent = to; return; } const t0 = performance.now(); (function f(t) { const k = Math.min(1, (t - t0) / 600); el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))).toLocaleString("es"); if (k < 1) requestAnimationFrame(f); })(t0); }


  /* ---------- Servidor local, banner en vivo y ayuda ---------- */
  const VERSION = "0.5.0", FAQ = [
    /* [categoría, pregunta, respuesta, palabras clave] */
    ["Empezar", "¿Qué es GCMS?", "Una aplicación para importar tablas (Word, Excel, CSV, HTML), verlas, filtrarlas, editarlas y exportarlas, con cuentas de administrador y usuario normal. Puede funcionar solo en el navegador o con el servidor local.", "gcms aplicacion programa para que sirve"],
    ["Empezar", "¿Cómo me muevo por la aplicación?", "Con el menú de la izquierda: Panel principal, Importar archivos, Explorador de datos, Procesos, Inventario, Reportes y Configuración (los administradores ven además Usuarios). En el móvil se abre con el botón ☰. El botón ❓ Ayuda siempre está abajo del menú.", "menu navegacion paginas moverme secciones"],
    ["Empezar", "¿Qué hacen Procesos, Inventario y Reportes?", "Todavía están en preparación. Se definirán cuando haya archivos y procesos autorizados; no inventan datos. Lo que ya funciona es Importar, el Explorador, Usuarios y Configuración.", "procesos inventario reportes modulos pendientes"],
    ["Empezar", "¿Qué atajos de teclado hay?", "Pulsa ? para abrir la ayuda y Esc para cerrarla (también cierra ventanas y la pantalla completa). En una celda en edición: Enter guarda y Esc cancela.", "atajos teclado tecla rapido"],
    ["Empezar", "¿Qué es el panel principal?", "Un resumen con las tablas importadas, filas, campos únicos y accesos rápidos. Los números se animan al cargar. Arriba aparece la fecha o el aviso en vivo si un administrador lo publicó.", "panel dashboard resumen inicio metricas"],

    ["Cuentas", "¿Cómo inicio sesión?", "En la pestaña 👤 Entrar escribe usuario y contraseña. La cuenta inicial es admin / 1234; cámbiala cuanto antes en Configuración → Mi cuenta. Verás confeti al entrar 🎉.", "login entrar acceder iniciar sesion ingresar"],
    ["Cuentas", "¿Cómo creo una cuenta?", "En la pestaña ✨ Crear cuenta escribe nombre, usuario (3+ caracteres: letras, números . _ -) y contraseña de 6+. Siempre se crea como usuario normal; solo un administrador puede subirla a administrador.", "registrar registro nueva cuenta usuario crear"],
    ["Cuentas", "¿Cómo cambio mi nombre, usuario o contraseña?", "Configuración → Mi cuenta: edita los campos y escribe tu contraseña actual (obligatoria) para guardar. La nueva contraseña es opcional y necesita 6+ caracteres.", "cambiar nombre usuario contrasena clave perfil"],
    ["Cuentas", "Olvidé mi contraseña", "Pide a un administrador que entre a Usuarios y pulse 🔑 Contraseña en tu cuenta. Si eres el único administrador: con el servidor apagado abre datos/db.json y borra tu usuario de la lista users; si la lista queda vacía, GCMS recrea admin / 1234.", "olvide recuperar restablecer perdi contrasena clave"],
    ["Cuentas", "¿Cómo cierro sesión?", "Pulsa tu círculo de perfil (arriba a la derecha) y confirma, o usa Configuración → Mi cuenta → Cerrar sesión. Con el servidor, la sesión también caduca si se reinicia el servidor.", "cerrar sesion salir logout"],

    ["Roles", "¿Qué puede hacer un administrador?", "Todo: importar, editar celdas, filas, columnas y temas, eliminar tablas, gestionar usuarios (crear, cambiar rol, poner contraseña, eliminar) y publicar la fecha y el aviso en vivo.", "administrador admin permisos poder todo"],
    ["Roles", "¿Qué puede hacer un usuario normal?", "Importar tablas nuevas, ver, buscar, filtrar, ordenar y exportar. No puede editar ni eliminar datos existentes, ni ver la página Usuarios.", "usuario normal permisos limitado user"],
    ["Roles", "¿Cómo cambio el rol de otra cuenta?", "Entra a Usuarios y usa el interruptor Usuario | Admin de la tarjeta de esa persona. El cambio se guarda al instante. Sin servidor también se puede editar la línea rol de datos/cuentas/usuario.js.", "cambiar rol permisos admin usuario promover degradar"],
    ["Roles", "¿Por qué no puedo cambiar mi propio rol?", "Por seguridad: si un administrador se pasara a usuario por error, nadie podría volver a gestionar cuentas. Tu tarjeta aparece con el candado 🔒 y marcada «Tú». Otro administrador sí puede cambiarlo. El servidor también lo rechaza, no es solo visual.", "propio rol mismo candado bloqueado no puedo cambiarme proteger"],
    ["Roles", "¿Puedo eliminar cuentas?", "Sí, con 🗑 en Usuarios. No puedes eliminar tu propia cuenta ni al último administrador: siempre debe quedar al menos uno.", "eliminar borrar cuenta usuario ultimo administrador"],
    ["Roles", "¿Cómo entro a Administración?", "En el login elige la pestaña 🛡 Administración e inicia con una cuenta de rol admin. Te lleva directo a la página Usuarios.", "administracion entrar admin panel"],

    ["Importar", "¿Cómo importo un archivo?", "Menú Importar archivos: arrastra o elige un Word (.docx), Excel (.xlsx .xls .xlsm .ods), CSV/TSV o HTML. Revisa la vista previa, escribe el tema y pulsa Confirmar importación. Hay confeti si sale bien 🎊.", "importar subir cargar archivo word excel csv html"],
    ["Importar", "¿Qué formatos y tamaño admite?", "Word (.docx), Excel (.xlsx, .xls, .xlsm, .ods), CSV/TSV/TXT y HTML con tablas. Máximo 25 MB por archivo.", "formatos tamano limite mb peso extension"],
    ["Importar", "¿Necesito internet para importar?", "CSV, TSV y TXT funcionan sin internet. Excel y Word cargan sus lectores (SheetJS y Mammoth) desde internet la primera vez; sin conexión esos formatos no se leen y el exportador Excel tampoco.", "internet conexion offline sin red cdn"],
    ["Importar", "¿Qué es el tema de una tabla?", "El título grande que aparece arriba de la tabla. Lo escribes al importar y un administrador puede cambiarlo luego haciendo clic en el título.", "tema titulo nombre tabla"],
    ["Importar", "El archivo tiene varias hojas o tablas, ¿qué hago?", "En la vista previa aparece el selector de hoja: elige una y confirma. Repite el proceso para importar las demás como tablas separadas.", "hojas varias tablas selector sheet"],

    ["Tablas", "¿Cómo busco y filtro?", "La barra de búsqueda mira todo el texto. Los botones redondos filtran por columna (aparecen cuando la columna tiene entre 2 y 40 valores distintos). «✕ Quitar filtros» los limpia.", "buscar filtrar filtro busqueda columna"],
    ["Tablas", "¿Cómo ordeno una columna?", "Haz clic en su encabezado: primero ascendente ▲, luego descendente ▼ y el tercer clic quita el orden. Los números se ordenan como números.", "ordenar orden ascendente descendente encabezado"],
    ["Tablas", "¿Cómo edito una celda?", "Solo administradores: doble clic en la celda, escribe y pulsa Enter para guardar o Esc para cancelar.", "editar celda modificar cambiar dato"],
    ["Tablas", "¿Cómo añado o borro filas y columnas?", "Solo administradores: botones ＋ Fila y ＋ Columna sobre la tabla, y la ✕ al final de cada fila para borrarla. Una tabla completa se borra con «Eliminar tabla».", "agregar anadir fila columna borrar eliminar"],
    ["Tablas", "¿Cómo oculto columnas o veo más filas?", "Botón «Columnas ▾» para mostrar u ocultar, «Compacta/Cómoda» para la densidad y, en Configuración, «Filas por página» (25 a 500).", "ocultar columnas densidad compacta paginas filas por pagina"],
    ["Tablas", "¿Cómo uso la pantalla completa?", "Botón ⛶ Pantalla completa del Explorador. Dentro puedes seguir filtrando y editando; sal con ✕ Salir o Esc.", "pantalla completa grande ampliar fullscreen"],
    ["Tablas", "¿Cómo exporto los datos?", "Botones ↓ CSV y ↓ Excel del Explorador. Descargan la tabla completa aunque haya filtros activos. El CSV abre bien en Excel con acentos.", "exportar descargar csv excel guardar"],

    ["Administración", "¿Cómo publico la fecha o un aviso en vivo?", "Solo administradores: Configuración → Aviso y fecha en vivo, elige la fecha, escribe el texto (opcional) y pulsa Publicar. Aparece arriba para todos; con el servidor se actualiza solo cada pocos segundos.", "aviso fecha en vivo banner publicar anuncio"],
    ["Administración", "¿Cómo creo un usuario como administrador?", "Página Usuarios → ➕ Nuevo usuario: nombre, usuario, contraseña (6+) y rol, y pulsa Crear. Puedes buscarlo y filtrar por rol en la lista.", "crear nuevo usuario administrador alta"],
    ["Administración", "¿Cómo pongo una nueva contraseña a alguien?", "En su tarjeta de Usuarios pulsa 🔑 Contraseña, escribe la nueva (6+) y acepta. Esa persona deberá usarla en su próximo inicio de sesión.", "nueva contrasena resetear cambiar clave otro usuario"],

    ["Servidor y HTTPS", "¿Cómo funciona el servidor local?", "Ejecuta INICIAR_SERVIDOR.bat (requiere Node.js) y abre la dirección que muestra. Otras personas de tu red entran con la dirección «Red local». Los datos quedan en datos/db.json.", "servidor node iniciar bat red local compartir"],
    ["Servidor y HTTPS", "¿Cómo cambio la IP o el puerto?", "Edita servidor.config.json. «host»: «0.0.0.0» sirve en todas las IP de tu PC (recomendado) o pon una IP concreta de tu equipo. «port»: cambia el número si el 3000 está ocupado.", "ip puerto port host config configuracion ocupado"],
    ["Servidor y HTTPS", "¿Cómo activo HTTPS y quito el aviso de «sitio no seguro»?", "Ejecuta CREAR_CERTIFICADO.bat seguido de tu IP (ej.: CREAR_CERTIFICADO.bat 192.168.1.50). Usa mkcert, que viene en la carpeta herramientas. Después reinicia INICIAR_SERVIDOR.bat: usa https solo si existe la carpeta certs.", "https certificado mkcert seguro candado ssl no seguro"],
    ["Servidor y HTTPS", "¿Qué es mkcert y cómo se usa aquí?", "Es una herramienta que crea certificados HTTPS de confianza local. El script busca mkcert instalado, luego herramientas\\mkcert.exe y, si tienes Go, lo compila desde herramientas\\mkcert-master. Si no hay nada, crea un certificado autofirmado con openssl.", "mkcert herramientas go compilar ca raiz"],
    ["Servidor y HTTPS", "Otro equipo sigue mostrando aviso de seguridad", "Cada equipo debe confiar en la CA de mkcert: copia rootCA.pem (carpeta que muestra «mkcert -CAROOT») y ejecuta mkcert -install allí. Nunca compartas rootCA-key.pem. La carpeta certs no se sirve por la web.", "otro equipo aviso ca rootca confiar telefono celular"],
    ["Servidor y HTTPS", "El servidor dice «puerto en uso» o «IP no pertenece a este equipo»", "Puerto en uso: cambia «port» en servidor.config.json. IP incorrecta: pon «0.0.0.0» en «host» o una IP que sea de tu PC.", "error puerto en uso eaddrinuse ip equipo"],
    ["Servidor y HTTPS", "¿Cómo acceden personas fuera de mi red?", "Con un túnel HTTPS real sin configurar nada: cloudflared tunnel --url http://localhost:3000 (usa http en el comando aunque tengas certificado).", "internet fuera afuera tunel cloudflared publico remoto"],

    ["Datos y copias", "¿Dónde se guardan mis datos?", "Con servidor: en datos/db.json. Sin servidor: en el navegador y, si conectas la carpeta (Chrome o Edge), también en datos/gcms-datos.json y datos/cuentas/.", "guardar datos donde almacenamiento base de datos json"],
    ["Datos y copias", "¿Cómo hago una copia de seguridad?", "Configuración → Datos y carpeta → ↓ Copia de seguridad descarga gcms-copia.json. Para recuperarla usa ↑ Restaurar copia.", "copia seguridad backup respaldo restaurar"],
    ["Datos y copias", "¿Qué es «Conectar carpeta»?", "Permite que la app (en Chrome o Edge, sin servidor) guarde cuentas y tablas en la carpeta GCMS_V1/datos. Si el navegador pide permiso otra vez, usa «Reconectar carpeta».", "conectar carpeta directorio chrome edge permiso"],
    ["Datos y copias", "Mis datos desaparecieron al recargar", "Sin servidor ni carpeta conectada, todo vive en el almacenamiento del navegador; limpiar datos del sitio o usar otro navegador los borra. Conecta la carpeta, usa el servidor o haz copias.", "perdi desaparecieron borraron recargar datos perdidos"],

    ["Apariencia", "¿Cómo cambio el tema y los colores?", "Configuración → Apariencia: tema claro u oscuro (también con el botón ◐ de arriba), cinco colores y un selector libre. Se guardan en tu navegador.", "tema oscuro claro color apariencia accent"],
    ["Apariencia", "¿Cómo quito o pongo las animaciones?", "Configuración → Animaciones y tablas → interruptor Animaciones. Si tu equipo va lento o te distraen, apágalas; también se desactivan solas si tu sistema pide menos movimiento.", "animaciones movimiento lento rendimiento confeti efectos"],
    ["Apariencia", "¿Cómo agrando el texto o el menú?", "Configuración → Tamaño del texto (Pequeño, Normal, Grande) y el interruptor Menú lateral compacto, que deja solo los iconos.", "texto tamano letra grande menu compacto"]
  ];
  let token = null; try { token = sessionStorage.getItem("gcms.token"); } catch {}
  S.server = false; S.srvUsers = []; S.banner = load("gcms.banner", { text: "", date: "" });
  async function api(p, m = "GET", b) {
    const r = await fetch("api/" + p, { method: m, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: b ? JSON.stringify(b) : undefined });
    const d = await r.json().catch(() => ({})); if (r.status === 401 && token) { token = null; logout(); }
    if (!r.ok) throw new Error(d.error || "Error del servidor"); return d;
  }
  async function detect() { const was = S.server; try { S.server = !!(await (await fetch("api/ping")).json()).ok; } catch { S.server = false; } if (was !== S.server) renderSystem(); }
  async function pull() { const d = await api("db"); S.datasets = d.datasets; S.banner = d.banner; S.srvUsers = d.users; S.active = null; return d; }
  let pushT; function push() { if (!S.server || !token) return; setSave("Guardando…"); clearTimeout(pushT); pushT = setTimeout(async () => { try { const d = await api("db", "PUT", { datasets: S.datasets, banner: S.banner }); S.datasets = d.datasets; setSave("Guardado en servidor ✓"); } catch (e) { setSave("⚠ " + e.message); } }, 300); }
  function setSave(t) { const n = $("#saveState"); if (!n) return; n.textContent = t; n.classList.remove("flash"); void n.offsetWidth; n.classList.add("flash"); }
  function renderBanner() { const b = S.banner || {}; $("#liveDate").textContent = [b.date ? "📅 " + b.date.split("-").reverse().join("/") : "", b.text || ""].filter(Boolean).join(" · "); $("#bnText").value = b.text || ""; $("#bnDate").value = b.date || ""; }
  function renderSystem() {
    $("#sysVer").textContent = VERSION; $("#sysRun").textContent = S.server ? "Servidor local (" + location.host + ")" : "Local en navegador"; $("#sysSrv").textContent = S.server ? "Conectado ✓" : "No conectado";
    $("#sysStore").textContent = S.server ? "Servidor · datos/db.json" : granted ? "Carpeta datos/ conectada" : "Navegador"; $("#sideStatus").textContent = S.server ? "Servidor local" : "Prototipo local"; $("#sideStatusSub").textContent = S.server ? "Conectado · " + location.host : "Sin servidor conectado";
  }
  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const CAT_ICON = { "Todas": "✨", "Empezar": "🚀", "Cuentas": "👤", "Roles": "🛡", "Importar": "📥", "Tablas": "📊", "Administración": "🧑‍💼", "Servidor y HTTPS": "🔒", "Datos y copias": "💾", "Apariencia": "🎨" };
  const STOP = new Set("como que del los las una uno por para con puedo hago hacer donde cual cuales es el la de en mi se un si no al lo y o a me mis tu tus hay son era hacerlo quiero necesito saber".split(" "));
  const SYN = { borrar: "eliminar", quitar: "eliminar", suprimir: "eliminar", clave: "contrasena", password: "contrasena", pass: "contrasena", subir: "importar", cargar: "importar", abrir: "importar", xls: "excel", xlsx: "excel", doc: "word", docx: "word", registrarme: "cuenta registrar", registro: "cuenta", ip: "red puerto", lan: "red", ssl: "https", certificado: "https mkcert", seguro: "https", candado: "https bloqueado", oscuro: "tema", respaldo: "copia", backup: "copia", permisos: "rol", promover: "rol", degradar: "rol", propio: "rol", celular: "movil red", telefono: "movil red", fiesta: "animaciones", confeti: "animaciones", efectos: "animaciones" };
  const stem = w => w.length > 5 ? w.slice(0, -2) : w.length > 4 ? w.slice(0, -1) : w;
  const tokens = q => { const n = norm(q), out = new Set(); n.split(/[^a-z0-9]+/).filter(w => w.length > 1 && !STOP.has(w)).forEach(w => { out.add(w); (SYN[w] || "").split(" ").filter(Boolean).forEach(x => out.add(x)); }); if (/\b(no puedo|no me deja|no deja|bloquead)/.test(n) && out.has("rol")) ["propio", "bloqueado", "candado"].forEach(x => out.add(x)); return [...out]; };
  let helpCat = "Todas", helpLast = -1, typeId = 0;
  function typeInto(el, text) {
    const id = ++typeId; if (!el) return; if (!S.prefs.anim) { el.textContent = text; return; }
    el.textContent = ""; el.classList.add("typing"); let i = 0;
    (function step() { if (id !== typeId) return; i += 2; el.textContent = text.slice(0, i); if (i < text.length) setTimeout(step, 14); else el.classList.remove("typing"); })();
  }
  function hl(text, ws) {
    const n = norm(text), rg = [];
    ws.forEach(w => { const s = stem(w); if (s.length < 3) return; let i = n.indexOf(s); while (i >= 0) { rg.push([i, i + s.length]); i = n.indexOf(s, i + s.length); } });
    if (!rg.length) return esc(text);
    rg.sort((a, b) => a[0] - b[0]); const m = [];
    rg.forEach(r => { const l = m[m.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else m.push([...r]); });
    let o = "", p = 0; m.forEach(([a, b]) => { o += esc(text.slice(p, a)) + "<mark>" + esc(text.slice(a, b)) + "</mark>"; p = b; }); return o + esc(text.slice(p));
  }
  function renderHelp() {
    const ws = tokens($("#helpQ").value), cats = ["Todas", ...new Set(FAQ.map(f => f[0]))];
    const scored = FAQ.map((f, i) => { const q = norm(f[1]), k = norm(f[3] || ""), a = norm(f[2]); let s = 0; ws.forEach(w => { const t = stem(w); if (q.includes(t)) s += 5; if (k.includes(t)) s += 3; if (a.includes(t)) s += 1; }); return { f, i, s }; });
    const pool = scored.filter(x => helpCat === "Todas" || x.f[0] === helpCat), list = ws.length ? pool.filter(x => x.s > 0).sort((a, b) => b.s - a.s) : pool;
    $("#helpCats").innerHTML = cats.map(c => `<button type="button" class="help-cat ${c === helpCat ? "on" : ""}" data-cat="${esc(c)}">${CAT_ICON[c] || "✨"} ${esc(c)}</button>`).join("");
    const bestEl = $("#helpBest"), top = ws.length && list.length && list[0].s >= 3 ? list[0] : null;
    bestEl.classList.toggle("hidden", !top);
    if (top) { if (helpLast !== top.i) { bestEl.innerHTML = `<div class="bot-face">🤖</div><div class="bubble"><b>${esc(top.f[1])}</b><span id="helpAns"></span></div>`; typeInto($("#helpAns"), top.f[2]); helpLast = top.i; } }
    else { helpLast = -1; typeId++; }
    const chips = [["Importar un archivo", "importar"], ["Cambiar rol", "cambiar rol"], ["Activar HTTPS", "https"], ["Olvidé mi contraseña", "olvide contraseña"], ["Copia de seguridad", "copia"]];
    $("#helpChips").innerHTML = ws.length ? "" : '<span class="chips-label">Prueba con:</span>' + chips.map(([t, q]) => `<button type="button" class="help-chip" data-q="${esc(q)}">${esc(t)}</button>`).join("");
    $("#helpMeta").textContent = ws.length ? `${list.length} resultado${list.length === 1 ? "" : "s"}` : `${pool.length} preguntas${helpCat === "Todas" ? "" : " en " + helpCat}`;
    $("#helpList").innerHTML = list.length ? list.map((x, n) => `<details style="--i:${Math.min(n, 12)}"><summary><span class="hq-ic">${CAT_ICON[x.f[0]] || "✨"}</span><span class="hq-t">${hl(x.f[1], ws)}</span><em>${esc(x.f[0])}</em></summary><p>${hl(x.f[2], ws)}</p></details>`).join("") : '<div class="help-empty"><div>🔎</div><b>No encontré nada con eso</b><p>Prueba con otras palabras (por ejemplo «rol», «importar», «https») o elige una categoría.</p></div>';
  }
  function openHelp() { helpCat = "Todas"; helpLast = -1; $("#helpModal").classList.remove("hidden"); $("#helpQ").value = ""; renderHelp(); setTimeout(() => $("#helpQ").focus(), 60); }
  const closeHelp = () => { $("#helpModal").classList.add("hidden"); typeId++; };

  /* ---------- Usuarios ---------- */
  async function hash(p, salt) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + p)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }
  const users = () => load(K.users, []);
  async function makeUser(name, username, pass, role) {
    const salt = crypto.getRandomValues(new Uint32Array(2)).join("-");
    return { name, username: username.toLowerCase(), role, salt, hash: await hash(pass, salt) };
  }
  let mode = "user";
  function setMode(m) { mode = m; $$(".lg-tab").forEach(b => b.classList.toggle("selected", b.dataset.m === m)); $("#lgErr").classList.add("hidden"); setupLogin(); }
  function setupLogin() {
    const T = { user: ["Iniciar sesión", "Accede a GCMS con tu cuenta.", "Entrar"], signup: ["Crear cuenta", "Crea tu cuenta de usuario normal.", "Crear cuenta"], admin: ["Administración", "Solo el administrador puede entrar aquí para gestionar cuentas.", "Entrar a administración"] }[mode];
    $("#loginTitle").textContent = T[0]; $("#loginSub").textContent = T[1]; $("#lgBtn").textContent = T[2]; $("#lgBtn").disabled = false; $("#lgName").classList.toggle("hidden", mode !== "signup");
  }
  async function submitLogin(e) {
    e.preventDefault();
    const err = m => { $("#lgErr").textContent = m; $("#lgErr").classList.remove("hidden"); };
    const u = $("#lgUser").value.trim().toLowerCase(), p = $("#lgPass").value;
    if (S.server) { try { if (mode === "signup") await api("signup", "POST", { name: $("#lgName").value.trim(), username: u, password: p }); const d = await api("login", "POST", { username: u, password: p }); if (mode === "admin" && d.user.role !== "admin") return err("Esta cuenta no es de administración."); token = d.token; try { sessionStorage.setItem("gcms.token", token); } catch {} await pull(); enter(d.user); if (mode === "admin") navigate("users"); if (p === "1234" && d.user.role === "admin") toast("Usas la contraseña predeterminada. Cámbiala en Configuración → Mi cuenta.", "error"); } catch (x) { err(x.message); } return; }
    if (mode === "signup") {
      const name = $("#lgName").value.trim();
      if (!name || !/^[a-z0-9._-]{3,}$/.test(u) || p.length < 6) return err("Escribe tu nombre, un usuario de 3+ caracteres (letras, números . _ -) y una contraseña de 6+.");
      if (users().some(x => x.username === u)) return err("Ese usuario ya existe.");
      save(K.users, [...users(), await makeUser(name, u, p, "user")]);
      toast(granted ? "Cuenta creada y guardada en la carpeta datos." : "Cuenta creada. Conecta la carpeta (Configuración) para guardarla en el archivo.", "success");
    }
    if (!users().length && mode === "admin") {
      if (!$("#lgName").value.trim() || p.length < 6) return err("Escribe tu nombre y una contraseña de al menos 6 caracteres.");
      save(K.users, [await makeUser($("#lgName").value.trim(), u, p, "admin")]);
    }
    const acc = users().find(x => x.username === u);
    if (!acc || acc.hash !== await hash(p, acc.salt)) return err("Usuario o contraseña incorrectos.");
    if (mode === "admin" && acc.role !== "admin") return err("Esta cuenta no es de administración.");
    try { sessionStorage.setItem(K.session, acc.username); } catch {}
    enter(acc); if (mode === "admin") navigate("users");
    if (acc.role === "admin" && p === "1234") toast("Usas la contraseña predeterminada. Cámbiala en Configuración → Mi cuenta.", "error");
  }
  function enter(acc) {
    const fromLogin = !$("#loginScreen").classList.contains("hidden"); S.user = acc; $("#loginScreen").classList.add("hidden"); $("#lgPass").value = ""; $("#lgErr").classList.add("hidden");
    document.body.classList.toggle("role-user", !isAdmin());
    $$(".admin-only").forEach(n => n.classList.toggle("hidden", !isAdmin()));
    $("#profileButton").textContent = acc.name[0].toUpperCase();
    $("#eName").value = acc.name; $("#eUser").value = acc.username; $("#accName").textContent = acc.name; $("#accUser").textContent = acc.username; $("#accRole").textContent = isAdmin() ? "Administrador" : "Usuario normal"; $("#page-dashboard .subtitle").innerHTML = `¡Hola, ${esc(acc.name.split(" ")[0])}! <span class="wave">👋</span> Aquí tienes el resumen de hoy.`;
    $("#userChip").textContent = `${acc.name} · ${isAdmin() ? "Administrador" : "Usuario"}`;
    navigate(location.hash.slice(1) || "dashboard", false); renderAll(); if (fromLogin) burst();
  }
  function logout() { token = null; try { sessionStorage.removeItem("gcms.token"); } catch {} try { sessionStorage.removeItem(K.session); } catch {} S.user = null; $("#loginScreen").classList.remove("hidden"); setMode("user"); }
  function dialog({ title, text = "", input = null, ok = "Aceptar", danger = false, icon = "❔" }) {
    return new Promise(res => {
      const m = document.createElement("div"); m.className = "modal";
      m.innerHTML = `<div class="modal-card dialog-card"><div class="dialog-icon ${danger ? "danger" : ""}">${icon}</div><h2>${esc(title)}</h2><p>${esc(text)}</p>${input ? `<input type="${input}" id="dlgIn" autocomplete="new-password" placeholder="Mínimo 6 caracteres">` : ""}<div class="dialog-btns"><button type="button" class="button secondary" data-r="0">Cancelar</button><button type="button" class="button primary ${danger ? "danger-btn" : ""}" data-r="1">${esc(ok)}</button></div></div>`;
      const inp = m.querySelector("#dlgIn"), done = v => { m.remove(); res(v); };
      m.onclick = e => { if (e.target === m) return done(null); const b = e.target.closest("[data-r]"); if (b) done(b.dataset.r === "1" ? (inp ? inp.value : true) : null); };
      m.addEventListener("keydown", e => { if (e.key === "Escape") done(null); if (e.key === "Enter") done(inp ? inp.value : true); });
      document.body.appendChild(m); (inp || m.querySelector("[data-r='1']")).focus();
    });
  }
  const hue = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const isMe = u => !!S.user && u.username === S.user.username;
  function renderUsers() {
    const all = S.server ? S.srvUsers : users(), q = norm($("#userSearch").value.trim()), f = S.userFilter || "all";
    const admins = all.filter(u => u.role === "admin").length;
    countUp($("#usTotal"), all.length); countUp($("#usAdmins"), admins); countUp($("#usUsers"), all.length - admins);
    $$("#userFilter button").forEach(b => b.classList.toggle("selected", b.dataset.uf === f));
    const list = all.filter(u => (f === "all" || u.role === f) && (!q || norm(u.name + " " + u.username).includes(q)));
    $("#usersGrid").innerHTML = list.length ? list.map((u, n) => {
      const me = isMe(u), adm = u.role === "admin", un = esc(u.username);
      return `<div class="ucard ${me ? "me" : ""}" style="--i:${Math.min(n, 14)};--h:${hue(u.username)}">
        <div class="uavatar">${esc((u.name || u.username)[0].toUpperCase())}</div>
        <div class="uinfo"><b>${esc(u.name)}${me ? ' <span class="you">Tú</span>' : ""}</b><small>@${un}</small></div>
        <span class="rolebadge ${adm ? "admin" : "user"}">${adm ? "🛡 Administrador" : "👤 Usuario"}</span>
        <div class="uactions">
          <div class="role-switch ${me ? "locked" : ""}" title="${me ? "Tu propio rol está protegido" : "Cambiar rol"}">
            <button type="button" class="${adm ? "" : "on"}" data-ua="role" data-u="${un}" data-to="user" ${me ? "disabled" : ""}>👤 Usuario</button>
            <button type="button" class="${adm ? "on" : ""}" data-ua="role" data-u="${un}" data-to="admin" ${me ? "disabled" : ""}>🛡 Admin</button>
          </div>
          <button type="button" class="mini" data-ua="pass" data-u="${un}">🔑 Contraseña</button>
          <button type="button" class="mini danger" data-ua="del" data-u="${un}" ${me ? "disabled title=\"No puedes eliminar tu propia cuenta\"" : "title=\"Eliminar cuenta\""}>🗑 Eliminar</button>
        </div>
        ${me ? '<p class="lockmsg">🔒 <b>Tu rol está protegido.</b> No puedes quitarte el administrador a ti mismo; otro administrador puede hacerlo si hace falta.</p>' : ""}
      </div>`;
    }).join("") : '<div class="help-empty"><div>🕵️</div><b>Sin resultados</b><p>No hay cuentas que coincidan con la búsqueda.</p></div>';
  }
  async function userAction(act, name, newPass, to) {
    if (S.user && name === S.user.username) {
      if (act === "role") return toast("🔒 No puedes cambiar tu propio rol. Pídeselo a otro administrador.", "error");
      if (act === "del") return toast("No puedes eliminar tu propia cuenta.", "error");
    }
    let v;
    if (act === "pass") { v = newPass || await dialog({ title: "Nueva contraseña", text: `Escribe la nueva contraseña para @${name}.`, input: "password", ok: "Guardar", icon: "🔑" }); if (v == null) return; if (v.length < 6) return toast("La contraseña necesita 6+ caracteres.", "error"); }
    if (act === "del" && !await dialog({ title: "¿Eliminar cuenta?", text: `Se eliminará a @${name}. No se puede deshacer.`, ok: "Eliminar", danger: true, icon: "🗑" })) return;
    if (S.server) { try { S.srvUsers = (await api("users", "POST", { action: act, username: name, value: v })).users; renderUsers(); toast(act === "role" ? "Rol actualizado ✓" : "Usuario actualizado.", "success"); } catch (e) { toast(e.message, "error"); } return; }
    let list = users(); const u = list.find(x => x.username === name); if (!u) return;
    const admins = list.filter(x => x.role === "admin").length;
    if (act === "role") { if (u.role === "admin" && admins < 2) return toast("Debe existir al menos un administrador.", "error"); u.role = u.role === "admin" ? "user" : "admin"; }
    if (act === "del") { if (u.role === "admin" && admins < 2) return toast("Debe existir al menos un administrador.", "error"); list = list.filter(x => x !== u); }
    if (act === "pass") u.hash = await hash(v, u.salt);
    save(K.users, list); renderUsers(); toast(act === "role" ? "Rol actualizado ✓" : "Usuario actualizado.", "success");
  }
  async function changePass() { await userAction("pass", S.user.username); }
  async function addUser() {
    if (S.server) { try { S.srvUsers = (await api("users", "POST", { action: "add", name: $("#nuName").value.trim(), username: $("#nuUser").value.trim().toLowerCase(), value: $("#nuPass").value, role: $("#nuRole").value })).users; ["#nuName", "#nuUser", "#nuPass"].forEach(s => $(s).value = ""); renderUsers(); burst(40); toast("Usuario creado ✓", "success"); } catch (e) { toast(e.message, "error"); } return; }
    const [n, u, p] = ["#nuName", "#nuUser", "#nuPass"].map(s => $(s).value.trim());
    if (!n || !u || p.length < 6) return toast("Completa nombre, usuario y contraseña (mín. 6).", "error");
    if (users().some(x => x.username === u.toLowerCase())) return toast("Ese usuario ya existe.", "error");
    save(K.users, [...users(), await makeUser(n, u, p, $("#nuRole").value)]);
    ["#nuName", "#nuUser", "#nuPass"].forEach(s => $(s).value = ""); renderUsers(); burst(40); toast("Usuario creado ✓", "success");
  }

  /* ---------- Navegación y apariencia ---------- */
  function navigate(name, hashUpdate = true) {
    if (name === "users" && !isAdmin()) name = "dashboard";
    const page = $(`#page-${name}`); if (!page) return;
    $$(".page").forEach(p => p.classList.toggle("active", p === page));
    $$(".nav-item[data-page]").forEach(b => b.classList.toggle("active", b.dataset.page === name));
    $("#currentSection").textContent = page.dataset.title || "GCMS"; $("#sidebar").classList.remove("open");
    if (hashUpdate) history.replaceState(null, "", "#" + name);
    if (name === "explorer") renderExplorer(); if (name === "users") renderUsers();
  }
  function applyAppearance() {
    const r = document.documentElement; r.dataset.theme = S.theme; r.style.setProperty("--accent", S.accent);
    const v = /^#[0-9a-f]{6}$/i.test(S.accent) ? S.accent.slice(1) : "2f8f68"; r.style.setProperty("--accent-rgb", [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16)).join(", "));
    $("#customAccent").value = S.accent;
    $$("[data-theme]").forEach(b => b.classList.toggle("selected", b.dataset.theme === S.theme));
    $$(".swatch").forEach(b => b.classList.toggle("selected", b.dataset.accent.toLowerCase() === S.accent.toLowerCase()));
    save(K.theme, S.theme); save(K.accent, S.accent);
  }

  /* ---------- Importación ---------- */
  function parseCsv(t, d) {
    const rows = []; let row = [], c = "", q = false;
    for (let i = 0; i < t.length; i++) { const ch = t[i];
      if (ch === '"') { if (q && t[i + 1] === '"') { c += '"'; i++; } else q = !q; }
      else if (ch === d && !q) { row.push(c); c = ""; }
      else if ((ch === "\n" || ch === "\r") && !q) { if (ch === "\r" && t[i + 1] === "\n") i++; row.push(c); c = ""; rows.push(row); row = []; }
      else c += ch; }
    if (c.length || row.length) { row.push(c); rows.push(row); }
    return rows;
  }
  function normalize(rows) {
    const clean = rows.filter(r => r.some(v => String(v ?? "").trim() !== ""));
    if (clean.length < 2) throw new Error("La tabla necesita encabezados y al menos una fila de datos.");
    const w = Math.max(...clean.map(r => r.length)), seen = {};
    const headers = Array.from({ length: w }, (_, i) => { let h = String(clean[0][i] ?? "").trim() || `Columna ${i + 1}`; seen[h] = (seen[h] || 0) + 1; return seen[h] > 1 ? `${h} (${seen[h]})` : h; });
    return { headers, rows: clean.slice(1).map(r => headers.map((_, i) => String(r[i] ?? ""))) };
  }
  const sheetRows = (wb, n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "", raw: false, blankrows: false });
  function tablesToWorkbook(html) {
    const doc = new DOMParser().parseFromString(html, "text/html"), tabs = $$("table", doc);
    if (!tabs.length) throw new Error("No se encontró ninguna tabla en el archivo.");
    const wb = XLSX.utils.book_new(); tabs.forEach((t, i) => XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(t, { raw: true }), `Tabla ${i + 1}`)); return wb;
  }
  async function handleFile(file) {
    if (!file) return; const n = file.name.toLowerCase(), ext = n.split(".").pop();
    if (file.size > 25 * 1024 * 1024) return toast("El archivo supera 25 MB.", "error");
    try {
      let wb = null, parsed;
      if (["csv", "tsv", "txt"].includes(ext)) {
        const t = (await file.text()).replace(/^\uFEFF/, ""), first = t.split(/\r?\n/)[0] || "";
        const d = ext === "tsv" || (first.split("\t").length > first.split(",").length) ? "\t" : first.split(";").length > first.split(",").length ? ";" : ",";
        parsed = normalize(parseCsv(t, d));
      } else {
        if (!window.XLSX) throw new Error("No se cargó el lector de tablas (necesita internet la primera vez).");
        if (ext === "docx") { if (!window.mammoth) throw new Error("No se cargó el lector de Word (necesita internet)."); wb = tablesToWorkbook((await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })).value); }
        else if (ext === "html" || ext === "htm") wb = tablesToWorkbook(await file.text());
        else wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
        const name = wb.SheetNames.find(s => sheetRows(wb, s).some(r => r.some(v => String(v).trim()))) || wb.SheetNames[0];
        parsed = normalize(sheetRows(wb, name)); parsed.sheet = name;
      }
      parsed.size = file.size; preview(file.name, parsed, wb); toast("Archivo leído correctamente.", "success");
    } catch (e) { S.preview = null; $("#filePreview").classList.remove("hidden"); $("#previewName").textContent = file.name; $("#previewMeta").textContent = "No se pudo leer"; $("#previewMessage").className = "inline-message error"; $("#previewMessage").textContent = e.message; $("#previewTable").innerHTML = ""; $("#sheetPickerWrap").classList.add("hidden"); $("#confirmImport").disabled = true; toast(e.message, "error"); }
  }
  function preview(name, p, wb) {
    S.preview = { name, ...p, wb };
    $("#previewName").textContent = name; $("#previewMeta").textContent = `${p.headers.length} columnas · ${p.rows.length} filas`;
    $("#previewCount").textContent = `Vista previa: ${Math.min(8, p.rows.length)} de ${p.rows.length} filas`;
    if (!$("#topicInput").value) $("#topicInput").value = name.replace(/\.[^.]+$/, "");
    $("#previewTable").innerHTML = `<thead><tr>${p.headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${p.rows.slice(0, 8).map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody>`;
    const multi = wb && wb.SheetNames.length > 1; $("#sheetPickerWrap").classList.toggle("hidden", !multi);
    if (wb) $("#sheetPicker").innerHTML = wb.SheetNames.map(s => `<option ${s === p.sheet ? "selected" : ""}>${esc(s)}</option>`).join("");
    $("#previewMessage").className = "inline-message success"; $("#previewMessage").textContent = "Revisa el tema, los encabezados y las primeras filas antes de confirmar.";
    $("#filePreview").classList.remove("hidden"); $("#confirmImport").disabled = false;
  }
  function confirmImport() {
    const p = S.preview; if (!p) return;
    const ds = { id: Date.now().toString(36), topic: $("#topicInput").value.trim() || p.name, file: p.name, size: p.size || 0, columns: p.headers, rows: p.rows, at: new Date().toISOString() };
    S.datasets.push(ds); S.active = ds.id; S.preview = null; $("#filePreview").classList.add("hidden"); $("#fileInput").value = ""; $("#topicInput").value = "";
    persist(); renderAll(); burst(); toast(`Tabla «${ds.topic}» importada: ${ds.rows.length} filas.`, "success"); navigate("explorer");
  }

  /* ---------- Tabla interactiva ---------- */
  const cur = () => S.datasets.find(d => d.id === S.active) || S.datasets[0];
  function view(ds) {
    const q = ($("#globalSearch").value || "").trim().toLowerCase();
    let idx = ds.rows.map((_, i) => i).filter(i => {
      const r = ds.rows[i];
      if (q && !r.some(v => String(v).toLowerCase().includes(q))) return false;
      return Object.entries(S.filters).every(([c, v]) => !v || String(r[c]) === v);
    });
    if (S.sort) { const { c, dir } = S.sort, num = idx.every(i => ds.rows[i][c] === "" || !isNaN(parseFloat(String(ds.rows[i][c]).replace(/,/g, ""))));
      idx.sort((a, b) => { const x = ds.rows[a][c], y = ds.rows[b][c]; const r = num ? parseFloat(String(x).replace(/,/g, "") || 0) - parseFloat(String(y).replace(/,/g, "") || 0) : String(x).localeCompare(String(y), "es", { numeric: true }); return r * dir; }); }
    return idx;
  }
  function renderExplorer() {
    const ds = cur(), has = !!ds;
    $("#explorerTablePanel").classList.toggle("hidden", !has); $("#explorerEmpty").classList.toggle("hidden", has); $("#datasetTabs").classList.toggle("hidden", !has);
    if (!has) return; S.active = ds.id; S.hidden[ds.id] ||= [];
    $("#datasetTabs").innerHTML = S.datasets.map(d => `<button data-ds="${d.id}" class="${d.id === ds.id ? "active" : ""}">${esc(d.topic)} · ${d.rows.length}</button>`).join("");
    if (document.activeElement !== $("#topicTitle")) $("#topicTitle").value = ds.topic;
    $("#heroFile").textContent = "📄 " + ds.file; $("#chDate").textContent = "📅 Importado el " + new Date(ds.at).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" }); $("#chSize").textContent = "💾 " + fmtSize(ds.size); $("#chRows").textContent = "▤ " + ds.rows.length.toLocaleString("es") + " filas"; $("#chCols").textContent = "⌗ " + ds.columns.length + " columnas"; $("#topicTitle").readOnly = !isAdmin();
    const cols = ds.columns.map((c, i) => i).filter(i => !S.hidden[ds.id].includes(i));
    const fb = $("#dynamicFilters"); fb.innerHTML = "";
    ds.columns.forEach((c, i) => { const vals = [...new Set(ds.rows.map(r => String(r[i])).filter(v => v.trim()))]; if (vals.length < 2 || vals.length > 40) return;
      const l = document.createElement("label"); l.className = "fchip" + (S.filters[i] ? " on" : ""); const s = document.createElement("select"); s.dataset.c = i; l.innerHTML = `<span>${esc(c)}</span>`; s.innerHTML = '<option value="">Todos</option>' + vals.sort((a, b) => a.localeCompare(b, "es", { numeric: true })).map(v => `<option value="${esc(v)}">${esc(v.slice(0, 28))}</option>`).join(""); s.value = S.filters[i] || ""; l.appendChild(s); fb.appendChild(l); });
    if (Object.values(S.filters).some(Boolean)) fb.insertAdjacentHTML("beforeend", '<button class="text-link" id="clearF">✕ Quitar filtros</button>');
    $("#colsMenu").innerHTML = ds.columns.map((c, i) => `<label><input type="checkbox" data-col="${i}" ${cols.includes(i) ? "checked" : ""}>${esc(c)}</label>`).join("");
    const idx = view(ds), pages = Math.max(1, Math.ceil(idx.length / PAGE)); S.page = Math.min(S.page, pages - 1);
    const slice = idx.slice(S.page * PAGE, S.page * PAGE + PAGE), ed = isAdmin();
    $("#dataHead").innerHTML = `<tr><th class="row-number">#</th>${cols.map(i => `<th data-sort="${i}" title="Ordenar">${esc(ds.columns[i])}${S.sort?.c === i ? (S.sort.dir > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}${ed ? "<th></th>" : ""}</tr>`;
    $("#dataBody").innerHTML = slice.map((ri, n) => `<tr style="--i:${Math.min(n, 20)}"><td class="row-number">${S.page * PAGE + n + 1}</td>${cols.map(i => `<td data-r="${ri}" data-c="${i}" title="${esc(ds.rows[ri][i])}">${esc(ds.rows[ri][i]) || '<span class="empty-cell">—</span>'}</td>`).join("")}${ed ? `<td><button class="rowdel" data-del="${ri}" title="Eliminar fila">✕</button></td>` : ""}</tr>`).join("");
    $("#resultPill").textContent = `${idx.length.toLocaleString("es")} de ${ds.rows.length.toLocaleString("es")} filas · ${ds.columns.length} columnas`;
    $("#dataCount").textContent = `Mostrando ${slice.length ? S.page * PAGE + 1 : 0}–${S.page * PAGE + slice.length} de ${idx.length.toLocaleString("es")}`;
    $("#pgInfo").textContent = `${S.page + 1} / ${pages}`; $("#prevPg").disabled = S.page === 0; $("#nextPg").disabled = S.page >= pages - 1;
    $(".data-table").classList.toggle("compact", S.dense);
  }
  function editCell(td) {
    if (!isAdmin() || td.querySelector("input")) return; const ds = cur(), r = +td.dataset.r, c = +td.dataset.c;
    const inp = document.createElement("input"); inp.value = ds.rows[r][c]; td.textContent = ""; td.classList.add("editing"); td.appendChild(inp); inp.focus(); inp.select();
    const done = ok => { if (ok) { ds.rows[r][c] = inp.value; persist(); } renderExplorer(); };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") done(true); if (e.key === "Escape") done(false); }); inp.addEventListener("blur", () => done(true));
  }
  function download(name, blob) { const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 500); }
  function exportCsv() { const ds = cur(); if (!ds) return; const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`; download(`${ds.topic}.csv`, new Blob(["\uFEFF" + [ds.columns, ...ds.rows].map(r => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" })); }
  function exportXlsx() { const ds = cur(); if (!ds || !window.XLSX) return toast("El exportador Excel no está disponible sin internet.", "error"); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([ds.columns, ...ds.rows]), ds.topic.slice(0, 31).replace(/[\\/?*[\]:]/g, "") || "Tabla"); XLSX.writeFile(wb, `${ds.topic}.xlsx`); }
  function fullscreen() { const p = $("#explorerTablePanel"); if (document.fullscreenElement || p.classList.contains("is-full")) { document.fullscreenElement && document.exitFullscreen(); p.classList.remove("is-full"); $("#fullBtn").textContent = "⛶ Pantalla completa"; return; } p.classList.add("is-full"); $("#fullBtn").textContent = "✕ Salir"; p.requestFullscreen?.().catch(() => {}); }

  function renderAll() {
    const rows = S.datasets.reduce((a, d) => a + d.rows.length, 0);
    countUp($("#metricFiles"), S.datasets.length); countUp($("#metricRows"), rows); countUp($("#metricFields"), new Set(S.datasets.flatMap(d => d.columns)).size); $("#metricPending").textContent = "0";
    $("#historyCount").textContent = `${S.datasets.length} tabla${S.datasets.length === 1 ? "" : "s"}`;
    const row = d => `<tr><td>${esc(d.topic)} <small>(${esc(d.file)})</small></td><td>${d.rows.length}</td>`;
    $("#historyBody").innerHTML = S.datasets.length ? S.datasets.map(d => row(d) + `<td>${d.columns.length}</td><td><span class="tag">Guardada</span></td></tr>`).join("") : '<tr><td colspan="4" class="table-empty">Todavía no hay tablas.</td></tr>';
    $("#recentEmpty").classList.toggle("hidden", !!S.datasets.length); $("#recentWrap").classList.toggle("hidden", !S.datasets.length);
    $("#recentBody").innerHTML = S.datasets.slice(-5).reverse().map(d => row(d) + `<td><span class="tag">Guardada</span></td></tr>`).join("");
    renderBanner(); renderSystem(); renderExplorer();
  }

  /* ---------- Efectos divertidos (se apagan con «Animaciones» desactivadas) ---------- */
  function burst(n = 70) {
    if (!S.prefs.anim) return; const cols = ["#2f8f68", "#4779d9", "#8b5cc7", "#c17b31", "#c04f67", "#f5c542"], f = document.createDocumentFragment();
    for (let i = 0; i < n; i++) { const s = document.createElement("span"); s.className = "confetti"; s.style.cssText = `left:${Math.random() * 100}vw;background:${cols[i % cols.length]};--d:${1.6 + Math.random() * 1.6}s;--x:${(Math.random() - .5) * 240}px;width:${6 + Math.random() * 6}px;height:${8 + Math.random() * 8}px;animation-delay:${Math.random() * .4}s`; f.appendChild(s); setTimeout(() => s.remove(), 3900); }
    document.body.appendChild(f);
  }
  function fxInit() {
    const bl = document.createElement("div"); bl.className = "bg-blobs"; bl.innerHTML = "<i></i><i></i><i></i>"; document.body.prepend(bl);
    document.addEventListener("mousedown", e => {
      const b = e.target.closest?.(".button,.help-btn,.help-cat,.help-chip"); if (!b || !S.prefs.anim) return;
      const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height), s = document.createElement("span"); s.className = "ripple";
      s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`; b.appendChild(s); setTimeout(() => s.remove(), 650);
    });
    document.addEventListener("mousemove", e => { const c = e.target.closest?.(".panel,.metric-card,.ucard,.ustat"); if (!c) return; const r = c.getBoundingClientRect(); c.style.setProperty("--mx", e.clientX - r.left + "px"); c.style.setProperty("--my", e.clientY - r.top + "px"); });
    document.addEventListener("keydown", e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
      if (e.key === "Escape" && !$("#helpModal").classList.contains("hidden")) closeHelp();
      if (e.key === "?" && !typing && S.user) { e.preventDefault(); openHelp(); }
    });
  }

  function bind() {
    $$(".nav-item[data-page]").forEach(b => b.addEventListener("click", () => navigate(b.dataset.page)));
    $$("[data-go]").forEach(b => b.addEventListener("click", () => navigate(b.dataset.go)));
    $("#themeToggle").onclick = () => { S.theme = S.theme === "dark" ? "light" : "dark"; applyAppearance(); };
    $$("[data-theme]").forEach(b => b.onclick = () => { S.theme = b.dataset.theme; applyAppearance(); });
    $$(".swatch").forEach(b => b.onclick = () => { S.accent = b.dataset.accent; applyAppearance(); });
    $("#customAccent").oninput = e => { S.accent = e.target.value; applyAppearance(); };
    $("#resetAppearance").onclick = () => { S.theme = "light"; S.accent = "#2f8f68"; applyAppearance(); setPref("font", 14); };
    $("#mobileMenu").onclick = () => $("#sidebar").classList.toggle("open"); $("#dismissNotice").onclick = () => $("#demoNotice").classList.add("hidden");
    const dz = $("#dropZone"); dz.onclick = () => $("#fileInput").click();
    dz.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("#fileInput").click(); } };
    dz.ondragover = e => { e.preventDefault(); dz.classList.add("dragover"); }; dz.ondragleave = () => dz.classList.remove("dragover");
    dz.ondrop = e => { e.preventDefault(); dz.classList.remove("dragover"); handleFile(e.dataTransfer.files[0]); };
    $("#fileInput").onchange = e => handleFile(e.target.files[0]);
    $("#sheetPicker").onchange = e => { const p = S.preview; try { const n = normalize(sheetRows(p.wb, e.target.value)); n.sheet = e.target.value; n.size = p.size; preview(p.name, n, p.wb); } catch (x) { toast(x.message, "error"); } };
    $("#clearPreview").onclick = () => { S.preview = null; $("#filePreview").classList.add("hidden"); $("#fileInput").value = ""; };
    $("#confirmImport").onclick = confirmImport;
    $("#globalSearch").oninput = () => { S.page = 0; renderExplorer(); };
    $("#dynamicFilters").onclick = e => { if (e.target.id === "clearF") { S.filters = {}; S.page = 0; renderExplorer(); } };
    $("#dynamicFilters").onchange = e => { S.filters[e.target.dataset.c] = e.target.value; S.page = 0; renderExplorer(); };
    $("#datasetTabs").onclick = e => { const b = e.target.closest("[data-ds]"); if (b) { S.active = b.dataset.ds; S.sort = null; S.filters = {}; S.page = 0; renderExplorer(); } };
    $("#topicTitle").onchange = e => { if (isAdmin() && e.target.value.trim()) { cur().topic = e.target.value.trim(); persist(); renderAll(); } };
    $("#dataHead").onclick = e => { const t = e.target.closest("[data-sort]"); if (!t) return; const c = +t.dataset.sort; S.sort = S.sort?.c === c ? (S.sort.dir > 0 ? { c, dir: -1 } : null) : { c, dir: 1 }; renderExplorer(); };
    $("#dataBody").ondblclick = e => { const td = e.target.closest("td[data-r]"); if (td) editCell(td); };
    $("#dataBody").onclick = e => { const b = e.target.closest("[data-del]"); if (b && confirm("¿Eliminar esta fila?")) { cur().rows.splice(+b.dataset.del, 1); persist(); renderAll(); } };
    $("#addRow").onclick = () => { const ds = cur(); ds.rows.unshift(ds.columns.map(() => "")); S.sort = null; S.page = 0; persist(); renderAll(); };
    $("#addCol").onclick = () => { const n = prompt("Nombre de la nueva columna:"); if (!n?.trim()) return; const ds = cur(); ds.columns.push(n.trim()); ds.rows.forEach(r => r.push("")); persist(); renderAll(); };
    $("#delDataset").onclick = () => { const ds = cur(); if (ds && confirm(`¿Eliminar la tabla «${ds.topic}»?`)) { S.datasets = S.datasets.filter(d => d !== ds); S.active = null; persist(); renderAll(); } };
    $("#colsBtn").onclick = () => $("#colsMenu").classList.toggle("hidden");
    $("#colsMenu").onchange = e => { const i = +e.target.dataset.col, h = S.hidden[cur().id]; e.target.checked ? h.splice(h.indexOf(i), 1) : h.push(i); renderExplorer(); };
    $("#densityBtn").onclick = () => { S.dense = !S.dense; $("#densityBtn").textContent = S.dense ? "Cómoda" : "Compacta"; renderExplorer(); };
    $("#prevPg").onclick = () => { S.page--; renderExplorer(); }; $("#nextPg").onclick = () => { S.page++; renderExplorer(); };
    $("#exportCsv").onclick = exportCsv; $("#exportXlsx").onclick = exportXlsx; $("#fullBtn").onclick = fullscreen;
    document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && $("#explorerTablePanel").classList.contains("is-full") && $("#fullBtn").textContent.includes("Salir")) { /* Esc del navegador: mantiene vista ampliada */ } });
    $("#loginForm").onsubmit = submitLogin; $$(".lg-tab").forEach(b => b.onclick = () => setMode(b.dataset.m)); $("#nuAdd").onclick = addUser;
    $("#helpBtn").onclick = openHelp; $("#helpClose").onclick = closeHelp; $("#helpQ").oninput = () => { helpLast = -1; renderHelp(); };
    $("#helpModal").onclick = e => { if (e.target.id === "helpModal") closeHelp(); };
    $("#bnPub").onclick = () => { S.banner = { text: $("#bnText").value.trim(), date: $("#bnDate").value }; save("gcms.banner", S.banner); push(); renderBanner(); toast("Aviso publicado.", "success"); };
    $("#lgFolder").onclick = connectFolder; $("#folderBtn").onclick = connectFolder; $("#bkExport").onclick = exportBackup; $("#bkImport").onclick = () => $("#bkFile").click(); $("#bkFile").onchange = e => e.target.files[0] && importBackup(e.target.files[0]);
    $("#chgPass").onclick = changePass; $("#saveAcc").onclick = saveAcc; $("#logoutBtn").onclick = logout;
    $("#animToggle").onchange = e => setPref("anim", e.target.checked); $("#sideToggle").onchange = e => setPref("side", e.target.checked); $("#perPage").onchange = e => { S.page = 0; setPref("perPage", +e.target.value); };
    $$("[data-font]").forEach(b => b.onclick = () => setPref("font", +b.dataset.font));
    $("#usersGrid").onclick = e => { const b = e.target.closest("[data-ua]"); if (!b || b.disabled) return; if (b.dataset.ua === "role") { const u = (S.server ? S.srvUsers : users()).find(x => x.username === b.dataset.u); if (u && u.role === b.dataset.to) return; } userAction(b.dataset.ua, b.dataset.u); };
    $("#userSearch").oninput = renderUsers; $("#userFilter").onclick = e => { const b = e.target.closest("[data-uf]"); if (b) { S.userFilter = b.dataset.uf; renderUsers(); } };
    $("#helpCats").onclick = e => { const b = e.target.closest("[data-cat]"); if (b) { helpCat = b.dataset.cat; helpLast = -1; renderHelp(); } };
    $("#helpChips").onclick = e => { const b = e.target.closest("[data-q]"); if (b) { $("#helpQ").value = b.dataset.q; renderHelp(); $("#helpQ").focus(); } };
    $("#profileButton").onclick = () => { if (confirm("¿Cerrar sesión?")) logout(); };
    window.addEventListener("hashchange", () => S.user && navigate(location.hash.slice(1) || "dashboard", false));
  }
  document.addEventListener("DOMContentLoaded", async () => {
    applyAppearance(); bind(); fxInit(); applyPrefs(); setupLogin(); folderUI();
    await detect();
    if (!S.server) { try {
      const have = users(); (window.GCMS_ACCOUNTS || []).forEach(a => { const role = a.rol === "admin" ? "admin" : "user", x = have.find(y => y.username === a.usuario); if (x) { if (!(x.role === "admin" && role !== "admin" && have.filter(h => h.role === "admin").length < 2)) x.role = role; x.name = a.nombre || x.name; } else if (a.usuario && a.hash) have.push({ name: a.nombre, username: a.usuario, role, salt: a.salt, hash: a.hash }); }); if ((window.GCMS_ACCOUNTS || []).length) save(K.users, have);
      if (!users().length) save(K.users, [await makeUser("Administrador", "admin", "1234", "admin")]);
    } catch (e) { console.warn("GCMS: no se pudo preparar la cuenta inicial", e); } setupLogin(); }
    await detect(); renderSystem();
    if (S.server) { if (token) try { const d = await pull(); enter(d.me); } catch {} }
    else { let name = null; try { name = sessionStorage.getItem(K.session); } catch {} const acc = users().find(u => u.username === name); if (acc) enter(acc); restoreFolder(); }
    setInterval(async () => { await detect(); if (S.server && token && S.user) { try { S.banner = await api("banner"); renderBanner(); } catch {} } }, 6000);
  });
})();
