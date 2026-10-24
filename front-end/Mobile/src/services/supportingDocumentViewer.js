// Abre el soporte de una justificación guardado en MinIO: lo descarga con la sesión
// (Bearer) a la caché de la app y lo entrega al visor del sistema con expo-sharing.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import ENV from '../config/env';
import { apiUrl } from '../api/apiClient';
import { getToken } from '../storage/TokenStorage';

const EXTENSIONS = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' };

export const DOCUMENT_ERRORS = {
  NOT_AVAILABLE: 'DOCUMENT_NOT_AVAILABLE',
  NO_VIEWER: 'DOCUMENT_NO_VIEWER',
};

export async function openSupportingDocument({ id, mime }) {
  const token = await getToken();
  const url = apiUrl(`${ENV.ATTENDANCE_BASE_URL}api/v1/supporting-documents/${id}/content`);
  const target = new File(Paths.cache, `soporte-${id}.${EXTENSIONS[mime] || 'bin'}`);

  let file;
  try {
    file = await File.downloadFileAsync(url, target, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      idempotent: true,
    });
  } catch {
    // 404 (soporte registrado antes de la subida real), 403 o red caída.
    const error = new Error(DOCUMENT_ERRORS.NOT_AVAILABLE);
    error.code = DOCUMENT_ERRORS.NOT_AVAILABLE;
    throw error;
  }

  if (!(await Sharing.isAvailableAsync())) {
    const error = new Error(DOCUMENT_ERRORS.NO_VIEWER);
    error.code = DOCUMENT_ERRORS.NO_VIEWER;
    throw error;
  }
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: file.name });
}
