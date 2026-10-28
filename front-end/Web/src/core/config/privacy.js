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
        body: "Usamos tu nombre, documento, correo, teléfono y tus registros de asistencia para identificarte, registrar tu asistencia, gestionar justificaciones y generar reportes académicos. No los usamos para otros fines.",
    },
    {
        title: "Grupo sanguíneo (dato de salud, opcional)",
        body: "Puedes indicar tu grupo sanguíneo en tu perfil, pero no es necesario: no se usa para el control de asistencia y puedes dejarlo vacío o borrarlo cuando quieras. Es un dato sensible y su suministro es facultativo.",
    },
    {
        title: "Datos biométricos (sensibles, facultativos)",
        body: "Tu rostro y tu huella son datos sensibles. Autorizar su tratamiento es facultativo: no estás obligado a hacerlo y, si no lo haces, tu asistencia se registra por otros medios y no tiene consecuencias para ti. Si lo autorizas, de tu rostro guardamos una plantilla matemática cifrada, no la foto; de tu huella, la muestra capturada, también cifrada.",
    },
    {
        title: "Con quién compartimos tus datos",
        body: "Para operar el servicio, la institución usa proveedores que tratan tus datos solo por su encargo: alojamiento y base de datos (Neon y AWS), la aplicación web (Vercel), las notificaciones del celular (Expo) y el correo (Gmail). Algunos están fuera de Colombia. No entregamos tus datos a otros terceros sin tu autorización, salvo que una autoridad competente lo exija.",
    },
    {
        title: "Tus derechos",
        body: "Puedes conocer, actualizar y rectificar tus datos, pedir prueba de esta autorización, ser informado sobre su uso, revocarla y pedir la supresión de tus datos biométricos desde tu perfil, y presentar quejas ante la Superintendencia de Industria y Comercio.",
    },
    {
        title: "Seguridad",
        body: "Tus plantillas biométricas se guardan cifradas y cada persona del personal solo accede a los datos de su sede.",
    },
];
