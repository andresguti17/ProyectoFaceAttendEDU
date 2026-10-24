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

export const PRIVACY_POLICY_VERSION = "2026-10";

export const PRIVACY_NOTICE = [
    {
        title: "Responsable del tratamiento",
        body: "La institución educativa que administra FaceAttend EDU trata tus datos personales para el control de asistencia.",
    },
    {
        title: "Datos y finalidad",
        body: "Usamos tu nombre, documento, correo, teléfono, grupo sanguíneo y tus registros de asistencia para identificarte, registrar tu asistencia, gestionar justificaciones y generar reportes académicos. No los usamos para otros fines ni los entregamos a terceros sin tu autorización.",
    },
    {
        title: "Datos biométricos (sensibles, facultativos)",
        body: "Tu rostro y tu huella son datos sensibles. Autorizar su tratamiento es facultativo: no estás obligado a hacerlo y, si no lo haces, tu asistencia se registra por otros medios. Si lo autorizas, guardamos una plantilla matemática cifrada, no la foto.",
    },
    {
        title: "Tus derechos",
        body: "Puedes conocer, actualizar y rectificar tus datos, pedir prueba de esta autorización, ser informado sobre su uso, revocarla y pedir la supresión de tus datos biométricos desde tu perfil, y presentar quejas ante la Superintendencia de Industria y Comercio.",
    },
    {
        title: "Seguridad",
        body: "Tus datos de identificación y tus plantillas biométricas se guardan cifrados y solo los consulta el personal autorizado de tu sede.",
    },
];
