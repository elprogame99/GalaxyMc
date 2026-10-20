// Cuenta GCMS. Cambia "rol" a "admin" o "user", guarda el archivo y abre la app.
window.GCMS_ACCOUNTS = window.GCMS_ACCOUNTS || [];
window.GCMS_ACCOUNTS.push({
  nombre: "Administrador",
  usuario: "admin",
  rol: "admin",
  salt: "seed-1",
  hash: "3f85323f312a67a893419f5b0ccab28bbeb8c967c4c26ce58dae23d04ea3db1e" // contraseña cifrada, no editar
});
