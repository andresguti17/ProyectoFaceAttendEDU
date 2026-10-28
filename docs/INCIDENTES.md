# Procedimiento de respuesta a incidentes de seguridad

> **Borrador técnico.** Los plazos legales, los responsables y el canal de aviso a la
> Superintendencia de Industria y Comercio (SIC) **no están definidos**: están marcados
> con `TODO` y deben confirmarse con el área jurídica y el responsable del tratamiento
> antes de dar este documento por vigente. No inventar plazos ni contactos.

Aplica a cualquier sospecha de acceso no autorizado, fuga o pérdida de datos personales
o biométricos (rostro, huella), compromiso de credenciales o de un servicio. La Ley 1581
de 2012 (art. 17) obliga al responsable a informar a la SIC las violaciones a los
códigos de seguridad y los riesgos en la administración de la información de los
titulares. Contexto de datos y derechos: [PROTECCION_DATOS_LEY_1581.md](PROTECCION_DATOS_LEY_1581.md).

## 1. Roles

| Rol | Persona | Función |
|---|---|---|
| Coordinador del incidente | `TODO` | Decide contención, comunica y cierra |
| Responsable técnico | `TODO` | Ejecuta contención y recolecta evidencia |
| Responsable del tratamiento / jurídico | `TODO` | Decide si hay que avisar a la SIC y a los titulares |

## 2. Detección y reporte

- Cualquier persona que sospeche un incidente avisa de inmediato al coordinador por el
  canal interno `TODO`. Los reportes externos llegan según [SECURITY.md](../SECURITY.md).
- No pegar credenciales, imágenes de rostros/huellas ni datos personales en el chat, el
  correo ni los tickets: describir el hecho y dónde está la evidencia.
- Anotar desde el primer momento una cronología (hora de detección, qué se vio, quién
  actuó). La hora de detección es la que puede contar para los plazos legales.

## 3. Contención (primeras acciones)

Elegir según el tipo de incidente. Los accesos administrativos van por túnel SSH
(ver [DESPLIEGUE.md](../DESPLIEGUE.md) §9).

| Situación | Acción |
|---|---|
| Sesión o cuenta comprometida | Cerrar la sesión con `DELETE /api/v1/sessions/{id}` (solo Super Administrador; `GET /api/v1/sessions/user/{userId}` lista las de un usuario). Forzar el cambio de contraseña de la cuenta. |
| Secreto de producción expuesto | Generar uno nuevo (`openssl rand -base64 32`), actualizar `ENV_PROD_FILE` y `.env.prod` y recrear los servicios afectados (DESPLIEGUE.md §3). Para MongoDB, usar `database/scripts/rotate-mongo-password.sh` (§6). |
| Claves de cifrado (`PII_ENCRYPTION_KEY`, `PII_HASH_KEY`, `BIOMETRIC_ENCRYPTION_KEY`) | **No cambiarlas sin plan**: cambiarlas exige volver a cifrar y sin ellas los datos no se leen (DESPLIEGUE.md §3). Decidir con el coordinador antes de actuar. |
| Servicio comprometido | Aislarlo (parar el contenedor) conservando los logs; revisar Kong y el servicio con `docker logs faceattend-kong` y `docker logs faceattend-<servicio>` (DESPLIEGUE.md §9). |
| Datos biométricos de un titular expuestos | Borrado definitivo de plantillas y revocación del consentimiento según PROTECCION_DATOS_LEY_1581.md §3, previa decisión del responsable del tratamiento: se pierde la evidencia de las plantillas, así que primero preservar lo necesario para la investigación. |

Los puertos de los servicios solo deben escuchar en `127.0.0.1` (`BIND_IP`) y la API de
administración de Kong también; si un incidente muestra lo contrario, corregirlo es
parte de la contención.

## 4. Evidencia

Antes de reiniciar o recrear contenedores, copiar los logs (`docker logs … > archivo`)
y los registros relevantes a un lugar de acceso restringido. Los logs no deben contener
identificadores de sesión ni correos completos; si los contienen, tratarlos como datos
sensibles. Registrar qué datos y cuántos titulares pudieron verse afectados.

## 5. Evaluación y aviso

1. El responsable del tratamiento determina si el incidente afecta datos personales y
   si debe informarse a la SIC. Plazo y medio de aviso: `TODO` (confirmar con jurídica
   la norma y el plazo vigentes).
2. Decidir si hay que informar a los titulares afectados y, si son menores de edad, a
   sus representantes legales. Contenido y canal: `TODO`.
3. Si el incidente involucra proveedores (Neon, AWS, Vercel, Expo, correo), avisarles
   según sus procedimientos.

## 6. Erradicación y recuperación

- Corregir la causa (parche, configuración, credencial) y desplegar por el flujo normal
  (PR a `develop`, CI en verde).
- Rotar todo secreto que haya podido estar expuesto, aunque no haya evidencia de uso.
- Restaurar desde respaldo solo si hay una restauración probada (`TODO`: aún no existe
  procedimiento documentado de respaldo y restauración).

## 7. Cierre

Dentro de un plazo razonable tras la recuperación, escribir un informe corto: cronología,
causa raíz, datos y titulares afectados, avisos hechos, acciones correctivas y dueño de
cada una. Actualizar este documento con lo aprendido.
