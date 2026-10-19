import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../view/components/common/ThemeContext";
import { backendGet } from "../api/backend";
import ENV from "../config/env";

const ACAD = () => ENV.ACADEMIC_BASE_URL;

async function safe(promise) {
  try {
    return await promise;
  } catch {
    return null;
  }
}

// Sedes con su conteo de programas. Solo lectura: la gestión (crear/editar)
// vive en la web. En paralelo acotado para no colgar el dispositivo.
const FETCH_CHUNK_SIZE = 5;

export function useSchoolsViewModel() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [schools, setSchools] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = (await safe(backendGet(ACAD(), "api/v1/schools"))) ?? [];
      const list = Array.isArray(raw) ? raw : [];
      const enriched = [];
      for (let i = 0; i < list.length; i += FETCH_CHUNK_SIZE) {
        const chunk = await Promise.all(
          list.slice(i, i + FETCH_CHUNK_SIZE).map(async (s) => {
            const schoolId = s.school_id ?? s.schoolId ?? s.id;
            if (!schoolId) return null;
            const programs =
              (await safe(backendGet(ACAD(), `api/v1/schools/${schoolId}/programs`))) ?? [];
            return {
              schoolId,
              code: s.code ?? "—",
              name: s.name ?? "—",
              address: s.address ?? null,
              phone: s.phone ?? null,
              email: s.email ?? null,
              status: s.status !== undefined ? s.status : true,
              programsCount: Array.isArray(programs) ? programs.length : 0,
            };
          })
        );
        enriched.push(...chunk.filter(Boolean));
      }
      setSchools(enriched);
    } catch (e) {
      setError(t("schools.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return { loading, error, schools, reload: load, colors, t };
}
