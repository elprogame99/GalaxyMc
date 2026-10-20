// Servidor local de GCMS (sin dependencias). Uso: node servidor.js  ->  http://localhost:3000
const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto"),os=require("os");
const ROOT=__dirname,DBF=path.join(ROOT,"datos","db.json");
const CFG={host:"0.0.0.0",port:3000,...(()=>{try{return JSON.parse(fs.readFileSync(path.join(ROOT,"servidor.config.json"),"utf8"))}catch{return{}}})()};
const HOST=process.env.HOST||CFG.host,PORT=+(process.env.PORT||CFG.port);
const sha=(s,p)=>crypto.createHash("sha256").update(s+p).digest("hex");
let db={users:[],datasets:[],banner:{text:"",date:""}};
try{db={...db,...JSON.parse(fs.readFileSync(DBF,"utf8"))}}catch{}
if(!db.users.length){const s=crypto.randomBytes(6).toString("hex");db.users.push({name:"Administrador",username:"admin",role:"admin",salt:s,hash:sha(s,process.env.GCMS_ADMIN_PASSWORD||"1234")})}
const save=()=>{fs.mkdirSync(path.dirname(DBF),{recursive:true});fs.writeFileSync(DBF+".tmp",JSON.stringify(db));fs.renameSync(DBF+".tmp",DBF)};save();
const tok=new Map(),pub=u=>({name:u.name,username:u.username,role:u.role}),valid=u=>/^[a-z0-9._-]{3,}$/.test(u||"");
const send=(r,c,o)=>{r.writeHead(c,{"Content-Type":"application/json"});r.end(JSON.stringify(o))};
const body=q=>new Promise(res=>{let d="";q.on("data",c=>{d+=c;if(d.length>60e6)q.destroy()});q.on("end",()=>{try{res(JSON.parse(d||"{}"))}catch{res({})}})});
const mkUser=(name,username,pass,role)=>{const salt=crypto.randomBytes(6).toString("hex");return{name,username,role,salt,hash:sha(salt,pass)}};
async function api(q,r,p){
  const b=q.method==="GET"?{}:await body(q);
  if(p==="ping")return send(r,200,{ok:true});
  if(p==="login"){const u=db.users.find(x=>x.username===b.username);if(!u||u.hash!==sha(u.salt,b.password||""))return send(r,401,{error:"Usuario o contraseña incorrectos."});const t=crypto.randomBytes(24).toString("hex");tok.set(t,u.username);return send(r,200,{token:t,user:pub(u)})}
  if(p==="signup"){const un=(b.username||"").toLowerCase();if(!b.name||!valid(un)||(b.password||"").length<6)return send(r,400,{error:"Datos no válidos (usuario 3+ y contraseña 6+)."});if(db.users.some(x=>x.username===un))return send(r,400,{error:"Ese usuario ya existe."});db.users.push(mkUser(b.name,un,b.password,"user"));save();return send(r,200,{ok:true})}
  const t=(q.headers.authorization||"").slice(7),me=db.users.find(x=>x.username===tok.get(t));
  if(!me)return send(r,401,{error:"Sesión caducada."});
  const adm=me.role==="admin";
  if(p==="banner")return send(r,200,db.banner);
  if(p==="db"&&q.method==="GET")return send(r,200,{datasets:db.datasets,banner:db.banner,me:pub(me),users:adm?db.users.map(pub):[]});
  if(p==="db"&&q.method==="PUT"){if(adm){db.datasets=b.datasets||[];db.banner=b.banner||db.banner}else{const ids=new Set(db.datasets.map(d=>d.id));(b.datasets||[]).forEach(d=>!ids.has(d.id)&&db.datasets.push(d))}save();return send(r,200,{datasets:db.datasets})}
  if(p==="users"){
    if(b.action==="self"){const un=(b.username||"").toLowerCase();if(me.hash!==sha(me.salt,b.old||""))return send(r,400,{error:"La contraseña actual no es correcta."});if(!b.name||!valid(un))return send(r,400,{error:"Nombre o usuario no válidos."});if(un!==me.username&&db.users.some(x=>x.username===un))return send(r,400,{error:"Ese usuario ya existe."});if(b.value&&b.value.length<6)return send(r,400,{error:"La contraseña necesita 6+ caracteres."});me.name=b.name;me.username=un;if(b.value)me.hash=sha(me.salt,b.value);tok.set(t,un);save();return send(r,200,{user:pub(me)})}
    if(!adm)return send(r,403,{error:"Solo el administrador puede hacer esto."});
    const u=db.users.find(x=>x.username===b.username),admins=db.users.filter(x=>x.role==="admin").length;
    if(b.action==="add"){const un=(b.username||"").toLowerCase();if(!b.name||!valid(un)||(b.value||"").length<6)return send(r,400,{error:"Datos no válidos."});if(db.users.some(x=>x.username===un))return send(r,400,{error:"Ese usuario ya existe."});db.users.push(mkUser(b.name,un,b.value,b.role==="admin"?"admin":"user"))}
    else if(!u)return send(r,404,{error:"No existe."});
    else if(b.action==="role"){if(u===me)return send(r,400,{error:"No puedes cambiar tu propio rol. Pídeselo a otro administrador."});if(u.role==="admin"&&admins<2)return send(r,400,{error:"Debe existir al menos un administrador."});u.role=u.role==="admin"?"user":"admin"}
    else if(b.action==="pass"){if((b.value||"").length<6)return send(r,400,{error:"6+ caracteres."});u.hash=sha(u.salt,b.value)}
    else if(b.action==="del"){if(u===me||(u.role==="admin"&&admins<2))return send(r,400,{error:"No se puede eliminar esta cuenta."});db.users=db.users.filter(x=>x!==u)}
    save();return send(r,200,{users:db.users.map(pub)});
  }
  send(r,404,{error:"No encontrado"});
}
const MIME={".html":"text/html",".js":"application/javascript",".css":"text/css",".json":"application/json",".md":"text/plain"};
const handler=async(q,r)=>{try{
  const url=decodeURIComponent(q.url.split("?")[0]);
  if(url.startsWith("/api/"))return await api(q,r,url.slice(5));
  const f=path.join(ROOT,url==="/"?"index.html":url);
  if(!f.startsWith(ROOT))return r.writeHead(403).end();
  if(f.includes(path.sep+"datos"+path.sep)){r.writeHead(200,{"Content-Type":"application/javascript"});return r.end("")}
  if(/servidor\.js$/.test(f)||f.includes(path.sep+"certs"+path.sep)||f.includes(path.sep+"herramientas"+path.sep)||/servidor\.config\.json$/.test(f)){r.writeHead(403);return r.end()}
  fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end("No encontrado")}r.writeHead(200,{"Content-Type":(MIME[path.extname(f)]||"application/octet-stream")+"; charset=utf-8"});r.end(d)});
}catch(e){r.writeHead(500);r.end("Error")}};
const KEY=path.join(ROOT,"certs","key.pem"),CRT=path.join(ROOT,"certs","cert.pem"),SECURE=fs.existsSync(KEY)&&fs.existsSync(CRT);
const server=SECURE?require("https").createServer({key:fs.readFileSync(KEY),cert:fs.readFileSync(CRT)},handler):http.createServer(handler);
const scheme=SECURE?"https":"http";
server.on("error",e=>{console.error(e.code==="EADDRNOTAVAIL"?"\nLa IP '"+HOST+"' no pertenece a este equipo. Cámbiala en servidor.config.json (usa 0.0.0.0 para todas).":e.code==="EADDRINUSE"?"\nEl puerto "+PORT+" ya está en uso. Cámbialo en servidor.config.json.":e);process.exit(1)});
server.listen(PORT,HOST,()=>{
  console.log("\nGCMS servidor activo ("+(SECURE?"HTTPS":"HTTP")+")\n  Este equipo:  "+scheme+"://localhost:"+PORT);
  Object.values(os.networkInterfaces()).flat().filter(i=>i.family==="IPv4"&&!i.internal).forEach(i=>console.log("  Red local:    "+scheme+"://"+i.address+":"+PORT));
  console.log("  Escuchando en: "+HOST+":"+PORT+"\n  Datos:        datos/db.json\n  Usuario inicial: admin\n  Contraseña inicial: usa GCMS_ADMIN_PASSWORD si está configurada; de lo contrario, 1234 (cámbiala)\n");
  if(!process.env.NOOPEN){const url=scheme+"://localhost:"+PORT,c=process.platform==="win32"?'start "" ':process.platform==="darwin"?"open ":"xdg-open ";require("child_process").exec(c+url,()=>{})}
});
