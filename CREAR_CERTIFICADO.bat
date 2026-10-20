@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist certs mkdir certs
set "MK="
where mkcert >nul 2>nul && set "MK=mkcert"
if not defined MK if exist "herramientas\mkcert.exe" set "MK=herramientas\mkcert.exe"
if not defined MK (
  where go >nul 2>nul
  if not errorlevel 1 (
    echo Compilando mkcert desde herramientas\mkcert-master ^(necesita internet la primera vez^)...
    pushd herramientas\mkcert-master
    go build -o ..\mkcert.exe .
    popd
    if exist "herramientas\mkcert.exe" set "MK=herramientas\mkcert.exe"
  )
)
if defined MK (
  echo Usando mkcert: %MK%
  "%MK%" -install
  "%MK%" -key-file certs\key.pem -cert-file certs\cert.pem localhost 127.0.0.1 ::1 %1 %2
) else (
  echo No se encontro mkcert ni Go; creando certificado autofirmado con openssl ^(el navegador pedira confirmar una vez^).
  set "SAN=DNS:localhost,IP:127.0.0.1"
  if not "%~1"=="" set "SAN=%SAN%,IP:%~1"
  openssl req -x509 -newkey rsa:2048 -nodes -keyout certs\key.pem -out certs\cert.pem -days 365 -subj "/CN=localhost" -addext "subjectAltName=%SAN%"
)
echo.
echo Listo. Reinicia INICIAR_SERVIDOR.bat
pause
