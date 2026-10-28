# Política de seguridad

FaceAttend EDU maneja datos personales y **datos biométricos** (rostro y huella) de
estudiantes e instructores. Si encuentras una vulnerabilidad, repórtala de forma
privada para que podamos corregirla antes de que se haga pública.

## Cómo reportar una vulnerabilidad

1. **GitHub Security Advisories (canal preferido).** En la pestaña **Security** del
   repositorio, elige **Report a vulnerability**. El reporte queda visible solo para
   quienes mantienen el repositorio.
2. **Contacto institucional:** <!-- TODO: el responsable del proyecto debe confirmar
   aquí el canal institucional (correo o buzón) antes de publicar este archivo. No se
   ha definido todavía; no se debe inventar uno. -->
   **TODO — pendiente de confirmar por el responsable del proyecto.**

**No abras un _issue_ público ni un _pull request_** para describir una vulnerabilidad.

## Qué incluir en el reporte

- Componente afectado (servicio de `back-end/`, app Web, app Mobile, Kong, Docker/CI).
- Pasos para reproducirlo, con la versión o el _commit_ en el que lo observaste.
- Impacto que crees que tiene (por ejemplo: acceso a datos de otra sede).
- Si es posible, una prueba de concepto **mínima y sin datos reales**.

## Alcance

Dentro del alcance:

- El código de este repositorio: microservicios (`back-end/`), apps Web y Mobile
  (`front-end/`), configuración de Kong, `docker-compose*.yml`, Caddyfile y flujos de
  GitHub Actions.
- Fallos de autenticación, autorización (RBAC, aislamiento por sede), manejo de
  sesiones, exposición de datos personales o biométricos, inyección y similares.

Fuera del alcance:

- Infraestructura o cuentas de terceros (proveedores de nube, correo, Expo, Neon).
- Ataques de denegación de servicio por volumen, ingeniería social o acceso físico.
- Hallazgos que dependan de una instalación local con credenciales por defecto o
  modificada respecto a la guía de despliegue (`DESPLIEGUE.md`).

## Qué NO enviar por canales públicos

Ni en _issues_, _pull requests_, comentarios, capturas ni _logs_ adjuntos:

- Contraseñas, tokens, claves privadas, `.env` o cualquier credencial (ni siquiera
  caducadas: indícalo en el reporte privado y rótalas).
- Imágenes de rostros, huellas, plantillas o _embeddings_ biométricos.
- Datos personales reales de estudiantes o personal (documento, correo, teléfono).

Si ya publicaste algo así por error, avísanos por el canal privado para que se retire
y se rote lo que corresponda.

## Qué puedes esperar

- Revisaremos el reporte y te indicaremos si lo consideramos válido y qué sigue.
- Te mantendremos informado del avance cuando haya novedades. Este es un proyecto
  mantenido por un equipo pequeño, por lo que **no garantizamos plazos concretos** de
  respuesta ni de corrección.
- Si el reporte es válido, lo corregiremos y, de común acuerdo, reconoceremos tu aporte
  cuando se publique la corrección.

Mientras investigas, evita acceder a datos de terceros más allá de lo estrictamente
necesario para demostrar el problema, y no los modifiques ni los conserves.

## Datos personales

El tratamiento de datos personales y biométricos se describe en
[docs/PROTECCION_DATOS_LEY_1581.md](docs/PROTECCION_DATOS_LEY_1581.md).
