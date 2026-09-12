# Qué se entrega — sitio web FEM salón

Documento de entrega. Resume qué incluye el trabajo, qué necesita el cliente para ponerlo
en línea y qué no está incluido.

---

## Qué es

Un sitio web propio de siete páginas (Inicio, Servicios, Colorimetría, Galería, Sobre nosotros,
Turnos y Contacto) **con sistema de turnos online y panel de administración**.

No es una plantilla ni un maquetado: es una aplicación. La clienta reserva desde la web
eligiendo servicio, profesional, día y horario **según la disponibilidad real del salón**, y el
turno entra directo a la agenda. El salón administra todo desde un panel, sin tocar código.

## Qué incluye

**Sitio público**

- Siete páginas, pensadas primero para el celular.
- Servicios por categoría con precio, duración y botón de reserva.
- Galería con filtros por técnica y ampliación de fotos.
- Botones de WhatsApp con el mensaje ya escrito, botón fijo de "Reservar turno" en celular,
  mapa y "Cómo llegar".
- Preparado para búsquedas locales: títulos y descripciones por página, `sitemap.xml`,
  `robots.txt` y datos estructurados de peluquería (lo que Google necesita para entender
  que es un salón en Castelar).

**Reservas online**

- Seis pasos: servicio, profesional, fecha, horario, datos y confirmación.
- Los horarios que se ofrecen salen del horario real del salón, menos los turnos ya tomados
  y los bloqueos cargados. No se superponen.
- La clienta recibe código de reserva, puede agregar el turno a su calendario y tiene un
  enlace propio para ver o cancelar.

**Panel de administración**

- Agenda diaria, semanal y mensual.
- Turnos: alta, edición, estados (pendiente, confirmado, completado, cancelado), filtros,
  búsqueda, exportación a Excel y mensajes de WhatsApp a la clienta.
- Servicios y precios, profesionales, horarios y bloqueos, galería, reseñas y todos los textos.
- Usuarios con dos niveles: administración y equipo.

**Documentación**

- `MANUAL-DEL-PANEL.md` — cómo usar el panel, para el salón.
- `DESPLIEGUE.md` — cómo publicarlo en internet, paso a paso.
- `README.md` — documentación técnica.

## Qué necesita el cliente

Para que el sitio esté en línea hacen falta dos servicios, **contratados y pagados por el salón**:

| | Para qué | Costo aproximado |
|---|---|---|
| **Hosting** | Donde vive la aplicación y la base de turnos | Desde unos USD 7 por mes |
| **Dominio** | La dirección, ej. `femsalon.com.ar` | Se paga una vez al año |

El dominio debe quedar **a nombre del salón**: es el activo del negocio.

Hay planes gratuitos, pero **no sirven para tomar turnos reales**: borran la agenda cada vez
que el servidor se reinicia. Solo para probar.

## Qué NO incluye

- El pago del hosting y del dominio.
- La carga de contenido: precios, duraciones reales, fotos propias, Instagram y reseñas.
  El sitio queda funcionando con "Consultar" e ilustraciones de ejemplo hasta que se carguen.
- Soporte mensual, cambios posteriores ni posicionamiento en Google (se cotizan aparte).

## Para que quede completo, el salón tiene que aportar

1. Precios de cada servicio.
2. **Duraciones reales** — es lo que define cuántos turnos entran por día.
3. Fotos de trabajos y del local.
4. Link de Instagram y link de la ficha de Google Maps.
5. Si tienen política de seña o cancelación, el texto.

## Cómo se pone en línea

Está todo en `DESPLIEGUE.md`. Resumido: se sube el código a GitHub, se conecta con el
proveedor de hosting y en unos minutos queda publicado con HTTPS. La configuración ya viene
lista en el archivo `render.yaml`.

## Para aparecer en Google

1. Cargar la dirección del sitio en la **ficha de Google Maps del salón**. Es lo que más
   impacto tiene y es gratis.
2. Dar de alta el dominio en Google Search Console y enviar el `sitemap.xml`.
3. La indexación tarda de días a un par de semanas.
