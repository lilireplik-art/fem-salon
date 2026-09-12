@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   FEM salon
echo   Sitio:  http://localhost:3000
echo   Panel:  http://localhost:3000/admin
echo.
echo   Dejar esta ventana abierta mientras uses la pagina.
echo   Para apagar el servidor: cerrar esta ventana o pulsar Ctrl+C.
echo.
start "" "http://localhost:3000"
node server\index.js
echo.
echo   El servidor se detuvo.
pause
