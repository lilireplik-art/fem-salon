# FEM salón — sitio web y sistema de turnos

Sitio web público + sistema de reservas online + panel de administración para **FEM salón**
(Rodríguez Peña 1149, Castelar, Provincia de Buenos Aires).

No necesita instalar dependencias: funciona con Node.js 22.13 o superior usando el servidor HTTP
y la base de datos SQLite que ya vienen incluidos en Node.

---

## 0. Entregarlo al cliente (publicación con un clic)

Para que el salón lo publique por su cuenta, sin tocar código ni pedirte nada:

1. Subí este proyecto a un repositorio **público** de GitHub.
2. Armá el enlace de despliegue con la dirección de ese repositorio:

   `https://render.com/deploy?repo=https://github.com/TU-USUARIO/fem-salon`

3. Mandale ese enlace junto con la guía de publicación.

Render lee `render.yaml`, crea el servicio con Node 24 y HTTPS, y le pide una contraseña
para el panel. El plan gratuito no pide tarjeta. El repositorio tiene que ser público para
que el botón funcione sin darle acceso a nadie: no contiene datos ni contraseñas.

Documentos que acompañan la entrega: `ENTREGA.md` (alcance), `MANUAL-DEL-PANEL.md` (uso
del panel) y `DESPLIEGUE.md` (detalle técnico).

---

## 1. Cómo arrancarlo

```bash
npm start
```

- Sitio: <http://localhost:3000>
- Panel: <http://localhost:3000/admin>

La **primera vez** se crea la base de datos y un usuario administrador. La contraseña se muestra
en la consola (o podés definirla antes con la variable `ADMIN_PASSWORD`). Cambiala desde
**Panel → Usuarios**.

Si olvidás la contraseña:

```bash
npm run admin:reset -- admin nueva-contraseña-segura
```

Para desarrollar con recarga automática: `npm run dev`
Para verificar que todo funciona: `npm test`

---

## 2. Qué incluye

**Sitio público** (siete páginas, pensadas para el celular)

| Página | Contenido |
|---|---|
| `/` Inicio | Portada, presentación, categorías de servicios, colorimetría, galería breve y reseñas |
| `/servicios` | Todos los servicios por categoría, con precio, duración y botón *Reservar* |
| `/colorimetria` | Balayage, babylights, iluminaciones, correcciones de color y tinturas |
| `/galeria` | Trabajos con filtros por técnica y ampliación de fotos |
| `/nosotros` | El salón, el equipo y las reseñas |
| `/turnos` | Reserva online en 6 pasos |
| `/contacto` | Dirección, teléfono, horario, mapa y *Cómo llegar* |

Además: WhatsApp flotante, barra fija de *Reservar turno* en celular, SEO local (título, descripción,
datos estructurados `HairSalon`, `robots.txt` y `sitemap.xml`).

**Reservas online:** servicio → profesional → fecha → horario → datos → confirmación, con
código de reserva, agregado a Google Calendar / `.ics`, contacto por WhatsApp y enlace propio
para ver o cancelar el turno.

**Panel de administración** (`/admin`)

- Agenda diaria (grilla por profesional), semanal y mensual.
- Turnos: alta, edición, cambio de estado (pendiente, confirmado, completado, cancelado),
  filtros por fecha, profesional, servicio, estado y búsqueda, exportación a CSV y
  mensajes de WhatsApp a la clienta.
- Servicios y categorías: precios (único, "desde" o por forma de pago), duración, descripción,
  imagen, profesionales que lo realizan, visibilidad y orden.
- Profesionales: datos, foto, color de agenda, servicios y horario propio o del salón.
- Horarios: horario semanal del salón, bloqueos (feriados, vacaciones, cursos) y aperturas especiales.
- Galería y reseñas.
- Configuración: textos, imágenes, WhatsApp, Instagram, ubicación, SEO y parámetros de reserva.
  El botón «Cómo llegar», el mapa y el enlace a reseñas se generan solos con la dirección cargada.
- Usuarios: rol *Administración* (todo) y rol *Equipo* (agenda, turnos y bloqueos).

---

## 3. Datos cargados

Confirmados y ya cargados:

- FEM salón — Rodríguez Peña 1149, B1712 Castelar, Buenos Aires.
- Teléfono 011 2778-6008 · Horario: todos los días de 09:00 a 22:00.
- Servicios: balayage, babylights, técnicas de iluminación, tintura, corrección de color,
  corte personalizado, nutrición, tratamiento capilar y alisado → **precio: Consultar**.

**No se inventó ningún dato.** Quedan pendientes de cargar desde el panel: precios del resto de
los servicios, duraciones, nombres de las profesionales, Instagram, fotos reales, política de
señas o cancelación y métodos de pago.

Mientras no haya fotos, la web muestra ilustraciones marcadas como *"Imagen de ejemplo"*.
Se desactivan en **Configuración → Contenido de ejemplo**.

---

## 4. Cómo funciona la disponibilidad

1. Se toma el horario semanal del salón, se suman las aperturas especiales y se restan los bloqueos.
2. Si el servicio tiene profesionales asignadas, se usa la agenda de cada una (horario propio o del salón)
   menos sus turnos y bloqueos.
3. Si todavía no hay profesionales, se usa el horario del salón con la cantidad de
   *turnos simultáneos* configurada (por defecto 1).
4. Se generan horarios cada 30 minutos (configurable) que entren completos, respetando la
   anticipación mínima y la ventana de reservas.

Cada servicio ocupa su **duración**; si no tiene una cargada se usa la duración predeterminada (60 min).
Conviene cargar las duraciones reales (por ejemplo, un balayage ocupa mucho más que un corte)
para que la agenda no se superponga.

---

## 5. Configuración por variables de entorno

Copiá `.env.example` a `.env` (opcional):

| Variable | Para qué sirve |
|---|---|
| `PORT`, `HOST` | Dirección donde escucha el servidor (por defecto 3000) |
| `ADMIN_USER`, `ADMIN_PASSWORD` | Usuario administrador inicial (solo en la primera ejecución) |
| `TRUST_PROXY` | `1` si corre detrás de Nginx, Cloudflare, Render, Railway… |
| `COOKIE_SECURE` | `auto` (por defecto), `1` o `0` |
| `DATA_DIR`, `UPLOAD_DIR` | Carpetas de la base de datos y de las imágenes subidas |

---

## 6. Publicarlo en internet

1. Subir la carpeta a un servidor con Node.js 22.13+ (VPS, Render, Railway, Fly.io…).
2. Definir `ADMIN_PASSWORD` y `TRUST_PROXY=1`, y montar un **disco persistente** para
   `data/` y `uploads/` (ahí viven los turnos y las fotos).
3. Poner un proxy con HTTPS (Nginx, Caddy o el del proveedor) apuntando al puerto de la app.
4. Cargar la dirección final en **Configuración → SEO → Dirección del sitio**.
5. Hacer copias de seguridad de `data/femsalon.db` y de `uploads/`.

Como servicio de Windows / arranque automático se puede usar `pm2`, `nssm` o una tarea programada
que ejecute `npm start`.

---

## 7. Estructura

```
server/           Servidor, API y lógica
  index.js        HTTP, archivos estáticos, seguridad
  db.js           Base de datos SQLite, esquema y datos iniciales
  availability.js Cálculo de horarios disponibles
  appointments.js Alta, edición y cancelación de turnos + calendario
  api.js          API pública y del panel
  render.js       HTML del sitio (renderizado en el servidor, bueno para SEO)
  art.js          Ilustraciones de ejemplo en SVG
  cli.js          Utilidades de consola
  selftest.js     Pruebas automáticas
public/           Sitio (CSS/JS) y panel de administración
data/             Base de datos (se crea sola; hacer backup)
uploads/          Imágenes cargadas desde el panel
```
