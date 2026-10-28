// ============================================================
//  FaceAttend EDU — Aviso de privacidad (Ley 1581 de 2012)
//
//  PRIVACY_POLICY_VERSION debe coincidir con faceattend.privacy.policy-version
//  de ms-identity: el servidor solo acepta la versión vigente. Al cambiar el
//  texto del aviso se sube la versión en ambos lados y todos lo aceptan de nuevo.
//
//  Contenido mínimo del art. 12: responsable, finalidad, carácter facultativo
//  de los datos sensibles, derechos del titular y canal para ejercerlos.
// ============================================================

export const PRIVACY_POLICY_VERSION = "2026-11";

export const PRIVACY_NOTICE = [
    {
        title: "Responsable del tratamiento",
        body: "La institución educativa de tu sede es la responsable de tus datos personales y los trata para el control de asistencia. FaceAttend EDU es la herramienta con la que lo hace.",
    },
    {
        title: "Datos y finalidad",
        body: "Tratamos tu nombre, tipo y número de documento, correo, teléfono, dirección, fecha de nacimiento, usuario y contraseña (cifrada), dirección IP y fechas de tus sesiones, y tus registros de asistencia (estado, fecha y hora, método). Las justificaciones y sus soportes pueden incluir datos de salud que tú decides aportar. Los usamos para identificarte y autenticarte, registrar tu asistencia, gestionar justificaciones, enviarte alertas y reportes, y mantener la seguridad del servicio. No los usamos para otros fines.",
    },
    {
        title: "Grupo sanguíneo (dato de salud, opcional)",
        body: "Puedes indicar tu grupo sanguíneo en tu perfil, pero no es necesario y puedes dejarlo vacío o borrarlo cuando quieras. Si lo indicas, la aplicación móvil puede usarlo como una de las preguntas para verificar tu identidad cuando el reconocimiento facial falla; no se usa para otro fin. Es un dato sensible y su suministro es facultativo.",
    },
    {
        title: "Datos biométricos (sensibles, facultativos)",
        body: "Tu rostro y tu huella son datos sensibles. Autorizar su tratamiento es facultativo: no estás obligado a hacerlo y, si no lo haces, tu asistencia se registra por otros medios y no tiene consecuencias para ti. Si lo autorizas, de tu rostro guardamos una plantilla matemática cifrada, no la foto; de tu huella, la muestra capturada, también cifrada.",
    },
    {
        title: "Menores de edad",
        body: "Si eres menor de 18 años, solo tratamos tus datos con la autorización de tu padre, madre o representante legal, que un administrador de la sede registra cuando tu acudiente acude presencialmente a la sede, y que la institución conserva, atendiendo tu interés superior y tus derechos prevalentes. Tus datos biométricos y de salud nunca son obligatorios. Mientras ese registro no esté completo no podrás usar las funciones que requieren términos aceptados ni la verificación facial. Tu representante puede ejercer tus derechos y revocar sus autorizaciones.",
    },
    {
        title: "Con quién compartimos tus datos",
        body: "Para operar el servicio, la institución usa proveedores que tratan tus datos solo por su encargo: alojamiento y base de datos (Neon y AWS), la aplicación web (Vercel), las notificaciones del celular (Expo) y el correo (Gmail). Algunos están fuera de Colombia. No entregamos tus datos a otros terceros sin tu autorización, salvo que una autoridad competente lo exija.",
    },
    {
        title: "Conservación",
        body: "Conservamos tus datos mientras tengas vínculo con la institución y durante el tiempo que exija la ley. Tus plantillas biométricas se eliminan cuando revocas tu autorización y los registros de verificación biométrica se eliminan automáticamente a los 90 días.",
    },
    {
        title: "Tus derechos",
        body: "Puedes conocer, actualizar y rectificar tus datos, acceder a ellos gratis, pedir prueba de esta autorización, ser informado sobre su uso, revocarla y pedir la supresión de tus datos cuando no exista un deber legal o contractual de conservarlos. Ejércelos desde tu perfil o con el contacto de tu institución: las consultas se responden en máximo 10 días hábiles (prorrogables 5) y los reclamos en máximo 15 (prorrogables 8). También puedes presentar quejas ante la Superintendencia de Industria y Comercio.",
    },
    {
        title: "Seguridad",
        body: "Tu documento, correo, teléfono y grupo sanguíneo, tus plantillas biométricas y los soportes de tus justificaciones se guardan cifrados; cada persona del personal solo accede a los datos de su sede. Si ocurre un incidente que afecte tus datos, la institución lo gestiona e informa a la autoridad y a los titulares según la ley.",
    },
];
