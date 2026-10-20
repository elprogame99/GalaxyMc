// GCMS: servidor Node.js con PostgreSQL (Neon/Render).
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const { Pool } = require("pg");

const ROOT = __dirname;
const CFG = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "servidor.config.json"), "utf8")); } catch { return {}; } })();
const HOST = process.env.HOST || CFG.host || "0.0.0.0";
const PORT = Number(process.env.PORT || CFG.port || 3000);
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Falta DATABASE_URL. Configura la variable con la URL de conexión de Neon en Render.");
  process.exit(1);
}
const pool = new Pool({
  connectionString: DATABASE_URL,
  // Neon normalmente requiere TLS. La conexión se valida por defecto cuando el servidor lo permite.
  ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000
});
const sha = (s, p) => crypto.createHash("sha256").update(s + p).digest("hex");
const tok = new Map();
const pub = u => ({ name: u.name, username: u.username, role: u.role });
const valid = u => /^[a-z0-9._-]{3,}$/.test(u || "");
const send = (r, c, o) => {
  if (r.headersSent) return;
  r.writeHead(c, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  r.end(JSON.stringify(o));
};
const body = q => new Promise((resolve, reject) => {
  let d = "";
  q.on("data", c => { d += c; if (d.length > 60e6) { reject(new Error("Solicitud demasiado grande")); q.destroy(); } });
  q.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); } });
  q.on("error", reject);
});
const mkUser = (name, username, pass, role) => {
  const salt = crypto.randomBytes(12).toString("hex");
  return { name, username, role, salt, hash: sha(salt, pass) };
};

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcms_users (
      username TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS gcms_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      datasets JSONB NOT NULL DEFAULT '[]'::jsonb,
      banner JSONB NOT NULL DEFAULT '{"text":"","date":""}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO gcms_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
  `);
  const count = await pool.query("SELECT COUNT(*)::int AS n FROM gcms_users");
  if (count.rows[0].n === 0) {
    // Si se incluyó una base JSON antigua, migra sus cuentas/tablas una sola vez.
    let old = null;
    // La importación de db.json solo se activa manualmente para evitar migrar la cuenta demo por accidente.
    if (process.env.GCMS_IMPORT_LOCAL_JSON === "true") {
      try { old = JSON.parse(fs.readFileSync(path.join(ROOT, "datos", "db.json"), "utf8")); } catch {}
    }
    if (old && Array.isArray(old.users) && old.users.length) {
      for (const u of old.users) {
        if (u.username && u.salt && u.hash) {
          await pool.query(
            `INSERT INTO gcms_users(username,name,role,salt,password_hash) VALUES($1,$2,$3,$4,$5) ON CONFLICT(username) DO NOTHING`,
            [u.username, u.name || u.username, u.role === "admin" ? "admin" : "user", u.salt, u.hash]
          );
        }
      }
      await pool.query("UPDATE gcms_state SET datasets=$1::jsonb, banner=$2::jsonb WHERE id=1",
        [JSON.stringify(Array.isArray(old.datasets) ? old.datasets : []), JSON.stringify(old.banner || {text:"",date:""})]);
    }
    const after = await pool.query("SELECT COUNT(*)::int AS n FROM gcms_users");
    if (after.rows[0].n === 0) {
      const password = process.env.GCMS_ADMIN_PASSWORD || "1234";
      const u = mkUser("Administrador", "admin", password, "admin");
      await pool.query(
        "INSERT INTO gcms_users(username,name,role,salt,password_hash) VALUES($1,$2,$3,$4,$5)",
        [u.username, u.name, u.role, u.salt, u.hash]
      );
      if (!process.env.GCMS_ADMIN_PASSWORD) console.warn("AVISO: admin usa contraseña inicial 1234. Configura GCMS_ADMIN_PASSWORD en Render.");
    }
  }
  console.log("Base de datos PostgreSQL conectada; tablas GCMS listas.");
}

async function getUser(username) {
  const r = await pool.query("SELECT username,name,role,salt,password_hash AS hash FROM gcms_users WHERE username=$1", [username]);
  return r.rows[0] || null;
}
async function getState() {
  const r = await pool.query("SELECT datasets,banner FROM gcms_state WHERE id=1");
  return r.rows[0] || { datasets: [], banner: { text: "", date: "" } };
}
async function api(q, r, p) {
  const b = q.method === "GET" ? {} : await body(q);
  if (p === "ping") return send(r, 200, { ok: true, database: "postgresql" });

  if (p === "login") {
    const username = String(b.username || "").toLowerCase();
    const u = await getUser(username);
    if (!u || u.hash !== sha(u.salt, String(b.password || ""))) return send(r, 401, { error: "Usuario o contraseña incorrectos." });
    const t = crypto.randomBytes(32).toString("hex");
    tok.set(t, u.username);
    return send(r, 200, { token: t, user: pub(u) });
  }

  if (p === "signup") {
    const name = String(b.name || "").trim();
    const un = String(b.username || "").toLowerCase().trim();
    const password = String(b.password || "");
    if (!name || !valid(un) || password.length < 6) return send(r, 400, { error: "Datos no válidos (usuario 3+ y contraseña 6+)." });
    const u = mkUser(name, un, password, "user");
    try {
      await pool.query("INSERT INTO gcms_users(username,name,role,salt,password_hash) VALUES($1,$2,$3,$4,$5)", [u.username, u.name, u.role, u.salt, u.hash]);
      return send(r, 200, { ok: true });
    } catch (e) {
      if (e.code === "23505") return send(r, 400, { error: "Ese usuario ya existe." });
      throw e;
    }
  }

  const t = String(q.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const username = tok.get(t);
  const me = username ? await getUser(username) : null;
  if (!me) return send(r, 401, { error: "Sesión caducada. Inicia sesión otra vez." });
  const adm = me.role === "admin";

  if (p === "banner") {
    const state = await getState();
    return send(r, 200, state.banner || { text: "", date: "" });
  }
  if (p === "db" && q.method === "GET") {
    const state = await getState();
    const users = adm ? (await pool.query("SELECT name,username,role FROM gcms_users ORDER BY created_at, username")).rows : [];
    return send(r, 200, { datasets: state.datasets || [], banner: state.banner || { text: "", date: "" }, me: pub(me), users });
  }
  if (p === "db" && q.method === "PUT") {
    const state = await getState();
    if (adm) {
      await pool.query("UPDATE gcms_state SET datasets=$1::jsonb,banner=$2::jsonb,updated_at=NOW() WHERE id=1",
        [JSON.stringify(Array.isArray(b.datasets) ? b.datasets : []), JSON.stringify(b.banner || state.banner || { text: "", date: "" })]);
    } else if (Array.isArray(b.datasets)) {
      const current = Array.isArray(state.datasets) ? state.datasets : [];
      const ids = new Set(current.map(d => d.id));
      const additions = b.datasets.filter(d => d && !ids.has(d.id));
      if (additions.length) await pool.query("UPDATE gcms_state SET datasets=$1::jsonb,updated_at=NOW() WHERE id=1",
        [JSON.stringify(current.concat(additions))]);
    }
    const updated = await getState();
    return send(r, 200, { datasets: updated.datasets || [] });
  }

  if (p === "users") {
    if (b.action === "self") {
      const un = String(b.username || "").toLowerCase().trim();
      if (me.hash !== sha(me.salt, String(b.old || ""))) return send(r, 400, { error: "La contraseña actual no es correcta." });
      if (!b.name || !valid(un)) return send(r, 400, { error: "Nombre o usuario no válidos." });
      if (un !== me.username && await getUser(un)) return send(r, 400, { error: "Ese usuario ya existe." });
      if (b.value && String(b.value).length < 6) return send(r, 400, { error: "La contraseña necesita 6+ caracteres." });
      const newHash = b.value ? sha(me.salt, String(b.value)) : me.hash;
      try {
        await pool.query("UPDATE gcms_users SET name=$1,username=$2,password_hash=$3 WHERE username=$4", [String(b.name).trim(), un, newHash, me.username]);
      } catch (e) {
        if (e.code === "23505") return send(r, 400, { error: "Ese usuario ya existe." });
        throw e;
      }
      tok.set(t, un);
      return send(r, 200, { user: { name: String(b.name).trim(), username: un, role: me.role } });
    }
    if (!adm) return send(r, 403, { error: "Solo el administrador puede hacer esto." });
    const targetName = String(b.username || "").toLowerCase();
    const u = await getUser(targetName);
    const adminsResult = await pool.query("SELECT COUNT(*)::int AS n FROM gcms_users WHERE role='admin'");
    const admins = adminsResult.rows[0].n;
    if (b.action === "add") {
      const un = String(b.username || "").toLowerCase().trim();
      const name = String(b.name || "").trim();
      const value = String(b.value || "");
      if (!name || !valid(un) || value.length < 6) return send(r, 400, { error: "Datos no válidos." });
      const nu = mkUser(name, un, value, b.role === "admin" ? "admin" : "user");
      try {
        await pool.query("INSERT INTO gcms_users(username,name,role,salt,password_hash) VALUES($1,$2,$3,$4,$5)", [nu.username, nu.name, nu.role, nu.salt, nu.hash]);
      } catch (e) {
        if (e.code === "23505") return send(r, 400, { error: "Ese usuario ya existe." });
        throw e;
      }
    } else if (!u) return send(r, 404, { error: "No existe." });
    else if (b.action === "role") {
      if (u.username === me.username) return send(r, 400, { error: "No puedes cambiar tu propio rol. Pídeselo a otro administrador." });
      if (u.role === "admin" && admins < 2) return send(r, 400, { error: "Debe existir al menos un administrador." });
      await pool.query("UPDATE gcms_users SET role=$1 WHERE username=$2", [u.role === "admin" ? "user" : "admin", u.username]);
    } else if (b.action === "pass") {
      const value = String(b.value || "");
      if (value.length < 6) return send(r, 400, { error: "6+ caracteres." });
      const salt = crypto.randomBytes(12).toString("hex");
      await pool.query("UPDATE gcms_users SET salt=$1,password_hash=$2 WHERE username=$3", [salt, sha(salt, value), u.username]);
    } else if (b.action === "del") {
      if (u.username === me.username || (u.role === "admin" && admins < 2)) return send(r, 400, { error: "No se puede eliminar esta cuenta." });
      await pool.query("DELETE FROM gcms_users WHERE username=$1", [u.username]);
    } else return send(r, 400, { error: "Acción no válida." });
    const users = (await pool.query("SELECT name,username,role FROM gcms_users ORDER BY created_at, username")).rows;
    return send(r, 200, { users });
  }
  return send(r, 404, { error: "No encontrado" });
}

const MIME = { ".html":"text/html", ".js":"application/javascript", ".css":"text/css", ".json":"application/json", ".md":"text/plain", ".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg", ".ico":"image/x-icon" };
const handler = async (q, r) => {
  try {
    const url = decodeURIComponent((q.url || "/").split("?")[0]);
    if (url.startsWith("/api/")) return await api(q, r, url.slice(5));
    const f = path.resolve(ROOT, "." + (url === "/" ? "/index.html" : url));
    if (f !== ROOT && !f.startsWith(ROOT + path.sep)) return r.writeHead(403).end();
    if (f.includes(path.sep + "datos" + path.sep) || /servidor\.js$/.test(f) || f.includes(path.sep + "certs" + path.sep) || f.includes(path.sep + "herramientas" + path.sep) || /servidor\.config\.json$/.test(f) || f.includes(path.sep + "node_modules" + path.sep)) {
      r.writeHead(403); return r.end("Prohibido");
    }
    fs.readFile(f, (e, d) => {
      if (e) { r.writeHead(404); return r.end("No encontrado"); }
      r.writeHead(200, { "Content-Type": (MIME[path.extname(f)] || "application/octet-stream") + "; charset=utf-8", "X-Content-Type-Options": "nosniff" });
      r.end(d);
    });
  } catch (e) {
    console.error("Error en solicitud:", e);
    send(r, 500, { error: "Error interno del servidor." });
  }
};

async function main() {
  await initDB();
  const server = http.createServer(handler);
  server.on("error", e => { console.error(e); process.exit(1); });
  server.listen(PORT, HOST, () => console.log(`GCMS activo en ${HOST}:${PORT}`));
  const shutdown = async () => { server.close(() => {}); await pool.end(); process.exit(0); };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
main().catch(e => { console.error("No se pudo iniciar GCMS o conectar con PostgreSQL:", e.message); process.exit(1); });
