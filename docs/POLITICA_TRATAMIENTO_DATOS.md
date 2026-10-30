# Política de tratamiento de datos personales — FaceAttend EDU

> **Borrador técnico para revisión jurídica.** La Ley 1581 de 2012 (art. 17-k) y el Decreto
> 1074 de 2015 (arts. 2.2.2.25.3.1 y siguientes) obligan al **responsable del tratamiento** a
> adoptar y publicar esta política. Aquí está todo lo que el sistema hace hoy, verificado en el
> código, y marcado como `TODO` lo que debe decidir la institución. No es asesoría jurídica y no
> sustituye la aprobación del área jurídica.
>
> Relación con otros documentos: el aviso de privacidad que ve el titular en la app es el resumen
> de esta política (`front-end/Web/src/core/config/privacy.js`, versión 2026-11); los controles
> técnicos están en [PROTECCION_DATOS_LEY_1581.md](PROTECCION_DATOS_LEY_1581.md), la biometría en
> [EVALUACION_IMPACTO_BIOMETRIA.md](EVALUACION_IMPACTO_BIOMETRIA.md) y los menores en
> [MENORES_ACUDIENTES_Y_TERMINOS.md](MENORES_ACUDIENTES_Y_TERMINOS.md).

## 1. Responsable del tratamiento

| Dato | Valor |
|---|---|
| Razón social | `TODO` |
| NIT | `TODO` |
| Domicilio y dirección | `TODO` |
| Correo para consultas y reclamos | `TODO` |
| Teléfono | `TODO` |
| Área o persona encargada de atender a los titulares | `TODO` |

FaceAttend EDU es la herramienta con la que la institución trata los datos; no es el responsable.

## 2. Datos que se tratan y finalidades

| Categoría | Datos | Finalidad | Obligatorio |
|---|---|---|---|
| Identificación y contacto | Nombre, apellidos, tipo y número de documento, correo, teléfono, dirección, fecha de nacimiento | Identificar al titular, crear su cuenta, contactarlo y determinar si es menor de edad | Sí, salvo dirección |
| Cuenta | Usuario, contraseña (solo su hash), rol, sesiones | Dar acceso seguro a la plataforma | Sí |
| Académicos | Sede, programa, ficha, cursos, matrícula, horarios | Organizar las clases y la asistencia | Sí |
| Asistencia | Estado por clase (presente, tarde, ausente, justificado), hora y método de captura | Registrar la asistencia, generar reportes y alertas de baja asistencia | Sí |
| Justificaciones | Motivo y documento de soporte | Tramitar las ausencias justificadas | Solo si el titular justifica |
| Biométricos (sensibles) | Plantilla del rostro (sin la foto) y muestra de huella, cifradas | Identificar al aprendiz al tomar asistencia | **No: facultativo** |
| Salud (sensible) | Grupo sanguíneo | `TODO`: decidir si se conserva. Hoy solo se usa como pregunta de verificación de identidad en la app móvil cuando falla el rostro | **No: facultativo** |
| Acudiente de un menor | Nombre, documento, parentesco, contacto y autorización firmada | Cumplir el art. 7 de la Ley 1581 | Sí, para menores que usen biometría |
| Técnicos | Registros de verificación biométrica, de acceso y de errores | Seguridad, auditoría y soporte | Sí |

Los datos no se usan para fines distintos a los descritos. Cualquier finalidad nueva requiere
actualizar esta política, la versión del aviso y una nueva autorización.

## 3. Datos sensibles y menores de edad

- Autorizar el tratamiento de datos sensibles (biométricos y de salud) es **facultativo**: nadie
  está obligado y negarse no tiene consecuencias. La asistencia de quien no usa biometría se
  registra manualmente y cuenta igual en reportes y alertas.
- Los datos de menores se tratan con la autorización de su representante legal, que la firma
  en persona en la sede. Sin el acudiente registrado, su autorización firmada archivada y los
  términos aceptados, el menor no usa funciones biométricas.
- Se respeta el interés superior del menor (Ley 1098 de 2006).

## 4. Derechos de los titulares

El titular (o su representante legal) puede:

1. Conocer, actualizar y rectificar sus datos.
2. Pedir prueba de la autorización otorgada.
3. Ser informado del uso que se ha dado a sus datos.
4. Revocar la autorización y pedir la supresión de los datos, cuando no exista un deber legal o
   contractual de conservarlos. La autorización biométrica se revoca desde el perfil y borra de
   inmediato las plantillas y el historial biométrico.
5. Presentar quejas ante la Superintendencia de Industria y Comercio (SIC), después de agotar el
   trámite ante el responsable.
6. Acceder gratuitamente a sus datos.

## 5. Procedimiento para consultas y reclamos

| Trámite | Plazo legal (Ley 1581, arts. 14 y 15) |
|---|---|
| Consulta | Hasta 10 días hábiles, prorrogables 5 días hábiles avisando el motivo |
| Reclamo | Hasta 15 días hábiles, prorrogables 8 días hábiles avisando el motivo. Si está incompleto, se pide completarlo en 5 días; pasados 2 meses sin respuesta del titular, se entiende desistido |

Canal: `TODO` (correo y, si aplica, formulario). Lo que debe incluir la solicitud: identificación
del titular, descripción de los hechos, dirección de respuesta y documentos que se quieran hacer
valer. Responsable interno de responder: `TODO`.

## 6. Encargados del tratamiento y transferencias

La institución usa proveedores que tratan los datos solo por su encargo:

| Proveedor | Para qué | Ubicación |
|---|---|---|
| Neon | Base de datos PostgreSQL (identidad, académico, asistencia) | Estados Unidos (AWS `us-east-2`, Ohio). Verificado el 30 de octubre de 2026 en el proyecto de Neon y en la conexión que usan los servicios |
| AWS | Servidor de la aplicación, MongoDB (biometría) y archivos (MinIO) | Estados Unidos (`us-east-2`, Ohio). Verificado el 30 de octubre de 2026 en el nombre del host de la instancia |
| Vercel | Aplicación web | `TODO` |
| Expo | Notificaciones al celular | Estados Unidos |
| Gmail | Envío de correos | `TODO` |

`TODO` (jurídica): contrato de transmisión o términos de tratamiento de datos con cada proveedor
(Decreto 1074 de 2015, art. 2.2.2.25.5.2) y confirmar el nivel adecuado de protección del país
según la Circular Externa SIC 005 de 2017 (hallazgo L-06).

## 7. Seguridad

Medidas técnicas vigentes (detalle en [PROTECCION_DATOS_LEY_1581.md](PROTECCION_DATOS_LEY_1581.md)):
datos de identificación y plantillas biométricas cifrados en reposo (AES-256-GCM); soportes y
autorizaciones firmadas cifrados en el almacenamiento de archivos; contraseñas con bcrypt;
sesiones que se guardan solo como huella; acceso del personal limitado a su sede; respaldos con
cifrado disponible y restauración probada. Procedimiento ante incidentes: [INCIDENTES.md](INCIDENTES.md).

## 8. Conservación

| Datos | Plazo |
|---|---|
| Registros de verificación biométrica | 90 días (se eliminan automáticamente) |
| Plantillas biométricas | Mientras exista la autorización y el vínculo con la institución; se borran al revocar. `TODO`: plazo tras la desvinculación |
| Datos de identificación, académicos y de asistencia | `TODO` (hallazgo L-NEW-03). Considerar las obligaciones de archivo de la institución |
| Justificaciones y soportes | `TODO` |
| Autorizaciones y aceptaciones (prueba de la autorización) | Mientras se conserven los datos que autorizan, más el tiempo que exija la ley `TODO` |

Los registros nunca se borran físicamente en la base, salvo la supresión biométrica: se marcan
como eliminados. `TODO`: definir y automatizar el borrado definitivo al vencer cada plazo.

## 9. Vigencia y cambios

- Fecha de entrada en vigencia: `TODO`.
- Versión del aviso de privacidad asociada: 2026-11.
- Cuando cambie esta política de forma sustancial, se informará a los titulares y se pedirá
  aceptar de nuevo el aviso (la app lo exige al subir su versión).
- Registro de la base de datos en el RNBD de la SIC: `TODO` (hallazgo L-05).
