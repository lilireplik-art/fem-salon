# Publicar FEM salón en internet (plan gratuito)

Objetivo: que cualquiera pueda abrir el sitio desde su navegador, con el sistema de turnos
funcionando, en una dirección del estilo `https://fem-salon.onrender.com`.

Todo lo que sigue es gratis. Hacen falta dos cuentas: **GitHub** (para guardar el código) y
**Render** (para que el sitio corra). Se crean con un email en dos minutos.

---

## Antes de empezar: qué esperar del plan gratuito

| | Plan gratuito | Plan pago (más adelante) |
|---|---|---|
| Dirección | `fem-salon.onrender.com` | Tu dominio, ej. `femsalon.com.ar` |
| Turnos | Funcionan | Funcionan |
| **Los turnos y las fotos se conservan** | **No**: se borran cada vez que el sitio se reinicia o se actualiza | Sí, en un disco propio |
| Si nadie entra por un rato | Se "duerme": la primera visita tarda ~40 segundos en abrir | Siempre despierto |
| Aparecer en Google | No conviene | Sí |

**Traducido:** el plan gratuito es perfecto para mostrárselo a alguien y probarlo entre todos.
No sirve para tomar turnos reales de clientas, porque un reinicio borra la agenda.
Cuando el salón lo vaya a usar de verdad, se pasa al plan pago (paso 6).

---

## Paso 1 — Crear la cuenta de GitHub

1. Entrá a <https://github.com/signup> y creá la cuenta.
2. Confirmá el email.

## Paso 2 — Subir el código

En esta carpeta, abrí una terminal y ejecutá (una línea por vez):

```bash
git init -b main
```

```bash
git add .
```

```bash
git commit -m "Sitio web y sistema de turnos de FEM salon"
```

Después creá un repositorio vacío en <https://github.com/new>:

- **Repository name:** `fem-salon`
- Elegí **Private** (privado) si no querés que el código sea público. Render funciona igual.
- **No** marques ninguna casilla de "Add a README".

GitHub te va a mostrar dos comandos como estos (usá los que te muestre a vos, con tu usuario):

```bash
git remote add origin https://github.com/TU-USUARIO/fem-salon.git
```

```bash
git push -u origin main
```

La primera vez te va a pedir usuario y contraseña de GitHub: en la ventana que se abre,
iniciá sesión con el navegador.

## Paso 3 — Crear la cuenta de Render

Entrá a <https://render.com> y registrate con **"Sign in with GitHub"**: así queda conectado
con tu repositorio en un paso.

## Paso 4 — Publicar el sitio

1. En Render, tocá **New +** → **Blueprint**.
2. Elegí el repositorio `fem-salon`. Render lee solo el archivo `render.yaml` de este proyecto
   y configura todo (Node 24, el comando de arranque, HTTPS).
3. Te va a pedir un valor para **ADMIN_PASSWORD**: es la contraseña con la que vas a entrar al
   panel. Poné una tuya, de 8 caracteres o más, y guardala.
4. Tocá **Apply** y esperá unos minutos a que diga **Live**.

Listo: arriba te muestra la dirección, algo como `https://fem-salon.onrender.com`.
Esa es la que le pasás a quien quieras.

## Paso 5 — Revisar que quedó bien

- Abrí la dirección y probá reservar un turno de prueba.
- Entrá al panel en `https://TU-DIRECCION/admin` con usuario `admin` y la contraseña del paso 4.
- Borrá el turno de prueba desde el panel.

Acordate: como el plan es gratuito, cada vez que Render reinicie el servicio la base vuelve a
cero (servicios y horarios se vuelven a crear solos; turnos, fotos y profesionales, no).

---

## Paso 6 — Cuando lo usen en serio (plan pago y dominio)

1. En Render, cambiá el servicio al plan **Starter** (unos USD 7 por mes).
2. Agregá un **Disk**: punto de montaje `/data`, 1 GB alcanza y sobra.
3. Agregá dos variables de entorno para que los datos vivan en ese disco:
   - `DATA_DIR` = `/data/data`
   - `UPLOAD_DIR` = `/data/uploads`
4. Comprá el dominio (por ejemplo en <https://nic.ar> para un `.com.ar`) y cargalo en
   Render → **Settings** → **Custom Domains**. Render te da el HTTPS sin costo.
5. En el panel del sitio: **Configuración → SEO → Dirección del sitio**, poné la dirección final.

## Paso 7 — Aparecer en Google

1. Entrá a <https://search.google.com/search-console>, agregá el dominio y verificalo.
2. Cargá el sitemap: `https://TU-DOMINIO/sitemap.xml` (el sitio ya lo genera solo).
3. En la ficha del salón en Google Maps, agregá el sitio web en **Sitio web**.
   Ese enlace es lo que más ayuda a que aparezca al buscar "peluquería Castelar".

La indexación no es inmediata: suele tardar de unos días a un par de semanas.

---

## Actualizar el sitio más adelante

Cada vez que se cambie algo del código:

```bash
git add . && git commit -m "Cambios" && git push
```

Render lo detecta y vuelve a publicar solo. Los cambios de textos, precios, fotos y horarios
**no** requieren esto: se hacen desde el panel y quedan al instante.
