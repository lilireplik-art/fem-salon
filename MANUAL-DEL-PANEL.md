# Manual del panel — FEM salón

Guía para manejar la página desde adentro. No hace falta saber nada de computación:
todo se cambia desde una pantalla, con el celular o la computadora.

**Dirección del panel:** `https://TU-DIRECCION/admin`
**Usuario:** `admin`
**Contraseña:** la que definiste al publicar el sitio.

> Conviene guardar el panel en favoritos y cambiar la contraseña la primera vez
> (abajo de todo, en **Usuarios → Mi contraseña**).

---

## 1. Lo de todos los días: los turnos

Cuando una clienta reserva desde la web, el turno entra como **Pendiente** y aparece un
numerito rojo al lado de "Turnos" en el menú de la izquierda.

**Para confirmarlo:**

1. Entrá a **Agenda** o a **Turnos**.
2. Tocá el turno.
3. Cambiá el estado a **Confirmado** y tocá **Guardar**.
4. Si querés avisarle, tocá **WhatsApp → Confirmar turno**: se abre WhatsApp con el mensaje
   ya escrito y el teléfono de la clienta cargado. Solo tocás enviar.

**Los cuatro estados:**

| Estado | Cuándo usarlo |
|---|---|
| Pendiente | Recién reservado, todavía no lo confirmaste |
| Confirmado | Ya le avisaste a la clienta y el turno va |
| Completado | La clienta vino y se atendió |
| Cancelado | No va. **El horario se libera** y otra clienta puede tomarlo |

**Para cargar un turno que te pidieron por teléfono o WhatsApp:** botón **Nuevo turno**
(arriba a la derecha). Elegís servicio, día y hora — el panel te muestra los horarios que
están libres— y cargás el nombre y el teléfono.

**Las tres vistas de la Agenda:**

- **Día**: la grilla con la hora, una columna por profesional. Tocando un espacio vacío
  cargás un turno ahí directamente.
- **Semana**: los siete días de un vistazo.
- **Mes**: para ver cómo viene el mes.

---

## 2. Precios y duraciones

**Servicios y precios** en el menú de la izquierda.

Tocá **Editar** en cualquier servicio para cambiar:

- **Precio**: si lo dejás vacío, en la web dice "Consultar". También podés marcar
  *Mostrar como "Desde"*.
- **Precios por forma de pago**: si cobrás distinto en efectivo, transferencia o tarjeta,
  cargás una opción por cada uno y la web los muestra a los tres.
- **Duración**: **es la más importante.** Define cuánto ocupa ese servicio en la agenda.
  Si un balayage lleva 3 horas, poné 180: así el sistema no te agenda otra clienta encima.
  Si lo dejás vacío, el sistema le da 1 hora.
- **Visible en la web** y **Se puede reservar online**: para esconder un servicio o dejarlo
  a la vista pero sin reserva online.

Con **Nuevo servicio** agregás uno que no esté.

---

## 3. Horarios, feriados y vacaciones

**Horarios y bloqueos** en el menú.

- **Horario del salón**: los días y las horas que abre. Es de donde salen todos los horarios
  que la clienta ve al reservar. Si cambiás acá, cambia la web al instante.
- **Bloquear un horario**: para un feriado, un curso o las vacaciones. Elegís desde qué día
  hasta qué día, y si es todo el día o de tal a tal hora. Esos horarios dejan de ofrecerse.
- **Abrir un horario especial**: al revés, para atender un domingo puntual o quedarte hasta
  más tarde un día.
- Si bloqueás días donde ya había turnos tomados, el panel te avisa cuántos son para que
  los revises.

---

## 4. Profesionales

**Profesionales** en el menú. Cada una puede tener:

- Foto, nombre y especialidad (si marcás *Mostrar en la web*, aparece en "Sobre nosotros").
- **Los servicios que hace**: solo esos se le pueden agendar.
- **Horario propio** o el del salón, si alguna trabaja menos días.

Cuantas más profesionales activas haya, más turnos en simultáneo acepta el sistema.
Con dos cargadas, se pueden tomar dos turnos a la misma hora.

---

## 5. Fotos y reseñas

**Galería**: subís las fotos de los trabajos, elegís a qué técnica corresponde cada una
(balayage, color, cortes…) y la web arma los filtros sola. Mientras no haya fotos propias,
el sitio muestra ilustraciones marcadas como "Imagen de ejemplo".

**Reseñas**: se cargan a mano, una por una. Copiá las que ya están en Google, con el nombre
de la clienta y las estrellas. **Cargá solo reseñas reales.**

Cuando ya tengas fotos y reseñas propias, andá a **Configuración → Contenido de ejemplo**
y desactivalo: desaparecen las ilustraciones y los carteles de ejemplo.

---

## 6. Textos, WhatsApp y ubicación

**Configuración** en el menú. Lo más usado:

- **Datos del negocio**: dirección, teléfono, email.
- **WhatsApp**: el número y los mensajes que se escriben solos cuando alguien toca un botón
  de WhatsApp en la web.
- **Instagram y ubicación**: el link de Instagram (si lo dejás vacío, el ícono no se muestra)
  y el link de Google Maps del salón. Con eso, el botón "Cómo llegar" y el mapa se arman solos.
- **Textos de la web**: todos los títulos y textos. Si ponés una palabra entre \*asteriscos\*,
  sale en la letra cursiva de color, como "Tu cabello, \*nuestro arte.\*".
- **Reservas online**: si querés que los turnos se confirmen solos, con cuánta anticipación
  mínima se puede reservar, y con cuántos días de anticipación como máximo.

Al final de la pantalla, **Guardar cambios**.

---

## 7. Preguntas que suelen aparecer

**Una clienta reservó y ya no puede venir.**
Buscá el turno y ponelo en **Cancelado**: el horario se libera solo.

**Quiero cerrar el salón una semana.**
Horarios y bloqueos → Bloquear, desde el primer día hasta el último, todo el día.

**No quiero recibir más turnos por la web por un tiempo.**
Configuración → Reservas online → desactivá *Reservas online activas*. La web pasa a invitar
a escribir por WhatsApp.

**Se llenó de turnos falsos.**
Configuración → Reservas online → activá que los turnos queden pendientes hasta que vos los
confirmes (viene así de fábrica), y cancelá los que no correspondan.

**Me olvidé la contraseña.**
Se resetea desde el servidor donde está publicada la página; quien te la publicó puede hacerlo.

**Cambié algo y no lo veo en la web.**
Refrescá la página con Ctrl+F5. Si seguís sin verlo, fijate que hayas tocado *Guardar*.
