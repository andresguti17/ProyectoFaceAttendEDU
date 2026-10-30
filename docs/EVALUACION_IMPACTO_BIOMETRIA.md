# Evaluación de impacto del tratamiento de datos biométricos

> **Borrador técnico para revisión jurídica.** Recoge lo que el sistema hace hoy, verificado en
> el código, y deja **sin llenar** lo que requiere una medición o una decisión de la institución:
> está marcado con `TODO`. No inventar cifras ni conclusiones. En particular, **las tasas de falsa
> aceptación y falso rechazo (FAR/FRR) no se han medido**: los umbrales actuales vienen de la
> literatura del modelo, no de pruebas en el aula (§6).
>
> Contexto normativo y controles técnicos ya descritos: [PROTECCION_DATOS_LEY_1581.md](PROTECCION_DATOS_LEY_1581.md),
> [MENORES_ACUDIENTES_Y_TERMINOS.md](MENORES_ACUDIENTES_Y_TERMINOS.md) e
> [INCIDENTES.md](INCIDENTES.md). Este documento no los repite: los enlaza.

Este documento no es asesoría jurídica. La Ley 1581 de 2012 no exige por nombre una "evaluación de
impacto", pero el tratamiento de datos sensibles (art. 5) y de menores (art. 7) obliga a justificar
que es necesario y proporcional; esta evaluación es la forma de dejar esa justificación por escrito.
El área jurídica debe confirmar si la institución adopta además el formato de la Superintendencia de
Industria y Comercio (SIC) para tratamientos de alto riesgo. `TODO`

## 1. Descripción del tratamiento

| Aspecto | Qué hace el sistema |
|---|---|
| Finalidad | Registrar la asistencia de aprendices a clase, identificándolos por rostro o por huella, y poder generar reportes y alertas de asistencia. |
| Responsable | La institución educativa de la sede. `TODO`: nombre, NIT y contacto (el aviso de privacidad lo dice hoy de forma genérica). |
| Encargados (proveedores) | Neon (PostgreSQL), AWS (servidor), Vercel (aplicación web), Expo (notificaciones móviles) y Gmail (correo). La biometría está en MongoDB, que corre con Docker Compose en el mismo servidor (AWS EC2), no en un servicio de base de datos de terceros; AWS sigue siendo el proveedor de esa infraestructura. `TODO`: confirmar el alojamiento real de MongoDB y de los respaldos. |
| Titulares | Aprendices (incluidos menores de edad con TI) y, si se les enrola, instructores. |
| Quién captura | El instructor o el administrador de la sede, con el aprendiz presente, en el kiosco de la aplicación web. |
| Alternativa sin biometría | Registro manual por el instructor. Existe y es obligatoria de ofrecer: la biometría es facultativa (art. 6). Verificado de punta a punta: un aprendiz sin biometría queda presente y cuenta igual en los reportes y en las alertas. |

### 1.1 Datos que se tratan

| Dato | Se guarda | No se guarda |
|---|---|---|
| Rostro | Una plantilla matemática de 128 valores, cifrada (AES-256-GCM). | La foto o el video: se calcula la plantilla y se descarta la imagen. |
| Huella | La muestra capturada, cifrada (AES-256-GCM). | La imagen del lector fuera de esa muestra. Ojo: es la muestra, no solo una plantilla irreversible; es más sensible que la del rostro. |
| Registro de cada verificación o identificación | Tipo, operación, si hubo coincidencia, puntaje, umbral, persona y quién la disparó, y un identificador de correlación. | La imagen o la muestra. |
| Asistencia | Estado, hora y método de captura (rostro, huella o manual) por sesión de clase. | |

Detalle del cifrado, las claves y el borrado: [PROTECCION_DATOS_LEY_1581.md](PROTECCION_DATOS_LEY_1581.md) §4 y §3.

## 2. Necesidad y proporcionalidad

La pregunta que debe responder esta sección es si hay una forma menos intrusiva de lograr la misma
finalidad, y por qué se elige la biométrica.

| Alternativa | Ventajas | Límites |
|---|---|---|
| Lista y registro manual del instructor | Sin datos sensibles. Ya existe como alternativa. | Lenta en grupos grandes y sujeta a que un aprendiz marque por otro. |
| Código QR o carné | Sin datos sensibles. | Se presta: no prueba presencia de la persona. |
| Rostro o huella | Prueba presencia de la persona y es rápida. | Dato sensible permanente: si se filtra, no se puede cambiar como una contraseña. |

`TODO` (institución, con jurídica): **decidir y dejar escrito** por qué la biometría es necesaria
para esta institución y no basta con las alternativas anteriores (p. ej. evidencia de suplantación
en el registro manual, tamaño de los grupos). Sin esa justificación el tratamiento no es
proporcional aunque el consentimiento sea válido.

Principios que el diseño ya aplica:

- **Facultativa y libre:** nadie está obligado; negarse no tiene consecuencias para la asistencia (art. 6).
- **Minimización:** no se guarda la foto; el grupo sanguíneo es opcional y ajeno a la asistencia.
- **Finalidad única:** las plantillas solo se usan para identificar o verificar en el kiosco de la sede.
- **Acceso restringido a la sede:** un instructor solo busca coincidencias entre aprendices de su sede, y las rutas por `person_id` exigen el alcance de la sede (PR #288 y #294).

## 3. Autorización y menores

| Requisito | Cómo se cumple hoy |
|---|---|
| Autorización previa, expresa e informada | Casilla biométrica aparte del aviso de privacidad, nunca obligatoria, con versión y fecha; el servicio biométrico la vuelve a verificar antes de guardar nada. |
| Revocación | Desde el perfil: borra todas las plantillas y el historial del titular. |
| Menores (art. 7) | El menor no puede enrolar rostro ni huella hasta que su acudiente esté registrado, haya aceptado los términos en persona ante el administrador y tenga archivada la autorización firmada (PR #309). |

`TODO` (jurídica): redactar el **formato de la autorización firmada** del acudiente y confirmar
que el texto del aviso de privacidad (versión 2026-11) basta como información previa.

## 4. Riesgos y controles

Escala sugerida: probabilidad e impacto en bajo, medio o alto. Las columnas de probabilidad e impacto
son una propuesta técnica; **jurídica y la institución deben validarlas** `TODO`.

| # | Riesgo | Prob. | Impacto | Controles existentes | Riesgo residual / pendiente |
|---|---|---|---|---|---|
| R1 | Filtración de plantillas o muestras de huella (base o respaldo) | Media | Alto | Cifrado AES-256-GCM con clave fuera de la base; respaldos con cifrado opcional y restauración probada (PR #303); acceso solo desde la red interna. | La clave es única para todo el sistema (`BIOMETRIC_ENCRYPTION_KEY`) y no hay rotación automática. El cifrado de respaldos es opcional: hacerlo obligatorio en producción `TODO`. |
| R2 | Acceso indebido de personal de otra sede | Media | Alto | Alcance por sede en lectura, borrado, identificación y verificación; la API no devuelve el vector ni la muestra. | Verificado con tests y de punta a punta; `/identify-image`, `/identify-sample` y el WebSocket solo con tests. |
| R3 | Suplantación (foto, video o muestra ajena) | Media | Medio | Prueba de vida por gestos (parpadeo, giros, boca, sonrisa) con reto firmado, vigencia de 120 s y tiempo mínimo por paso; control de misma persona entre pasos. | La prueba de vida no se ha medido contra ataques de presentación (foto en pantalla, máscara). `TODO`: pruebas de ataque. |
| R4 | Falso rechazo: el aprendiz legítimo no es reconocido y queda sin asistencia | Media | Medio | Alternativa manual del instructor, que cuenta igual. | Sin medir (ver §6). |
| R5 | Falsa aceptación: se registra a otra persona | Baja | Medio | Umbral estricto (distancia 0,5 frente a los 0,6 que recomienda el modelo); en identificación gana el candidato permitido de la sede. | Sin medir (ver §6). |
| R6 | Sesgo: el desempeño del modelo varía con tono de piel, edad, género o iluminación | Media | Alto | Ninguno específico. | El modelo (dlib) tiene sesgos documentados. `TODO`: medir por grupos con los aprendices reales antes del piloto y decidir qué hacer si hay diferencia (más umbral, otro modelo o solo manual). |
| R7 | Tratamiento sin autorización válida (menores, autorización retirada) | Media | Alto | Verificación de la autorización y del acudiente en el servicio biométrico, que falla cerrado si identity no responde. | Los menores ya enrolados antes de #309 deben revisarse: quedan pendientes del documento firmado. |
| R8 | Conservación excesiva | Media | Medio | Registros de verificación se eliminan a los 90 días (índice TTL de MongoDB); la revocación borra todo. | **No hay plazo para las plantillas** (se conservan mientras exista autorización) ni para los datos de asistencia. `TODO`: definir y automatizar (L-NEW-03). |
| R9 | Incidente de seguridad sin detección ni aviso a tiempo | Media | Alto | Procedimiento técnico en [INCIDENTES.md](INCIDENTES.md). | Roles, plazos y canal a la SIC sin definir `TODO`. No hay monitoreo con alertas (OPS-02). |
| R10 | Uso para fines distintos (p. ej. vigilancia o control disciplinario) | Baja | Alto | Las plantillas solo se consultan desde el kiosco de la sede; el registro de verificaciones permite auditar quién consultó. | Falta una política escrita que prohíba otros usos `TODO`. |
| R11 | Transferencia internacional | Alta (ya ocurre) | Medio | La biometría no sale del servidor, pero el servidor (AWS) está en Estados Unidos (`us-east-2`, Ohio), así que sale de Colombia. | Neon (Estados Unidos, `us-east-2`) y otros proveedores guardan datos de identidad: contratos de transmisión y nivel adecuado de protección pendientes (L-06). |

## 5. Derechos de los titulares y su ejercicio

- **Conocer y acceder:** el titular ve su estado de autorización desde el perfil.
- **Revocar y suprimir:** borrado inmediato de plantillas e historial desde el perfil.
- **Reclamos:** canal y plazos de respuesta que fije la institución `TODO` (el aviso de privacidad menciona 10 días hábiles para consultas y 15 para reclamos, según la ley).

## 6. Medición pendiente: FAR y FRR

**No existen mediciones propias.** Los umbrales vigentes son:

| Modalidad | Umbral actual | Origen |
|---|---|---|
| Rostro | Distancia euclídea ≤ 0,5 (puntaje = 1 − distancia) | Recomendación del modelo dlib (0,6) endurecida; no calibrado en el aula. |
| Huella | ≥ 8 coincidencias de puntos clave | Portado del servicio anterior; no calibrado. |
| Prueba de vida, misma persona | 0,75 | Valor interno; no calibrado. |

Protocolo propuesto (`TODO`: ejecutarlo con el consentimiento de los participantes y registrar los resultados aquí):

1. **Población:** al menos 30 personas con distintos tonos de piel, edades y géneros, incluidas las gafas, la mascarilla y la poca luz que ocurren en el aula.
2. **FRR (falso rechazo):** cada persona se verifica contra su propia plantilla en 20 intentos en condiciones reales (aula, distinta hora). FRR = rechazos / intentos.
3. **FAR (falsa aceptación):** cada persona se compara con las plantillas de las demás (impostores) en todos los pares posibles. FAR = aceptaciones / comparaciones.
4. **Curva:** repetir variando el umbral para escoger el punto de operación y documentar el equilibrio.
5. **Por grupos:** calcular FAR y FRR por grupo (tono, edad, género) y comparar.
6. **Criterio de aceptación:** definir **antes** de medir los valores máximos tolerables (propuesta inicial a validar: FAR ≤ 0,1 % y FRR ≤ 5 %, con alternativa manual para el resto). `TODO`

Registro de resultados: `TODO` (fecha, población, umbral, FAR, FRR, por grupo, responsable).

## 7. Conclusión y decisión

`TODO` (institución y jurídica): conclusión de si el tratamiento es necesario y proporcional, qué
riesgos se aceptan, qué controles faltantes son condición para el piloto y quién aprueba. Condiciones
técnicas que este borrador propone exigir **antes** de usar la biometría con datos reales:

- [ ] Justificación de necesidad aprobada (§2).
- [ ] FAR/FRR medidos y dentro del criterio, también por grupos (§6).
- [ ] Autorización del acudiente firmada y archivada para todo menor (§3).
- [ ] Plazos de conservación definidos y automatizados (R8).
- [ ] Cifrado de respaldos obligatorio y restauración ensayada en el servidor (R1).
- [ ] Roles y plazos del procedimiento de incidentes confirmados (R9).
- [ ] Contratos de transmisión con los proveedores (R11).

## 8. Revisión

Revisar esta evaluación al cambiar el modelo de reconocimiento, los umbrales, el alojamiento de
los datos, los plazos de conservación o la población (p. ej. nuevas sedes o instructores), y al
menos una vez al año. `TODO`: responsable y fecha de la próxima revisión.
