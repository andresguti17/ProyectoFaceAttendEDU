# Licencias de los modelos biométricos (dlib)

> Decisión de 2026-10-28 (hallazgo L-12): **se acepta el modelo de 68 puntos para uso no comercial**,
> pendiente de confirmación del área jurídica. Este documento explica qué modelos usa el servicio
> biométrico, su licencia y en qué condición habría que cambiarlo.

## Qué modelos hay y para qué se usan

`06-ms-biometric` usa la librería `face_recognition`, que trae cuatro modelos de dlib
(`face_recognition_models`). Verificado en la imagen y en `domain/face_encoding.py`:

| Modelo | Uso en FaceAttend EDU | Licencia (dlib-models README) |
|---|---|---|
| Detector HOG (sin archivo) | Encontrar la cara (`face_locations`, `FACE_DETECTION_MODEL = "hog"`) | Parte de dlib (Boost Software License) |
| `shape_predictor_5_face_landmarks.dat` | Alinear la cara antes de codificarla (`face_encodings` usa `model="small"` por defecto) | Dominio público |
| `dlib_face_recognition_resnet_model_v1.dat` | Calcular la plantilla de 128 valores | Dominio público |
| `shape_predictor_68_face_landmarks.dat` | **Solo la prueba de vida**: medir parpadeo, giro, boca y sonrisa (`face_landmarks`, `model="large"`) | Entrenado con iBUG 300-W, cuya licencia **excluye el uso comercial**; el autor indica que el modelo no puede usarse en un producto comercial |
| `mmod_human_face_detector.dat` | No se usa (el detector es HOG) | Dominio público |

Es decir: el reconocimiento (quién es) depende solo de modelos de dominio público; el modelo con
restricción solo interviene en la prueba de vida (si es una persona real frente a la cámara).

## Decisión

FaceAttend EDU lo opera una entidad pública educativa (SENA) para controlar la asistencia, sin
venderlo ni cobrar por su uso. Se acepta el modelo de 68 puntos para ese uso no comercial.

`TODO` (jurídica): confirmar que este uso no es "comercial" en los términos de la licencia de
iBUG 300-W y dejar la confirmación por escrito.

## Cuándo hay que sustituirlo

- Si el software se vende, se licencia a terceros o se ofrece como servicio con cobro.
- Si jurídica concluye que el uso actual sí es comercial.

Alternativa evaluada: medir los gestos con **MediaPipe Face Landmarker** (Apache 2.0), que da
puntos de ojos, boca y contorno. Exige reescribir `liveness_report` y recalibrar los umbrales de
cada gesto (`BLINK_EAR_DELTA` y los demás) con pruebas reales; el reconocimiento no cambia.
Estimación: varios días de trabajo más la recalibración.

## Otras licencias revisadas en L-12

Liquibase 5 (Functional Source License) ya no se empaqueta en los servicios Java (PR #314); las
migraciones usan los contenedores de Liquibase 4.29 (Apache 2.0).
