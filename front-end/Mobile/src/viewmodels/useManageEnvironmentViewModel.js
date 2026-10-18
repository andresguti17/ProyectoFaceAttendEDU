import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {EnvironmentService} from '../services/EnvironmentService';
import {SchoolService} from '../services/SchoolService';
import Environment from '../models/scheduling/Environment';

const toItem = (env) => ({
    id: String(env.environmentId),
    nombre: env.name || env.code || '—',
    ubicacion: env.code || '—',
    capacidad: env.capacity || 0,
    status: env.status,
});

export function useManageEnvironmentViewModel(enabled = true) {
    const {t} = useTranslation();
    const [ambientes, setAmbientes] = useState([]);
    const [schoolId, setSchoolId] = useState(null);
    const [updateKey, setUpdateKey] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchEnvironments = useCallback(async () => {
        try {
            setLoading(true);
            const currentSchoolId = await SchoolService.getCurrentSchoolId();
            setSchoolId(currentSchoolId);
            const list = currentSchoolId
                ? await EnvironmentService.getBySchool(currentSchoolId)
                : await EnvironmentService.getAll();
            setAmbientes(list.filter(Boolean).map(toItem));
            setUpdateKey((k) => k + 1);
        } catch (error) {
            console.error('Error fetching environments:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Solo Administrador puede gestionar ambientes: evita la petición
        // mientras la pantalla valida el rol (o si se monta sin permiso).
        if (!enabled) {
            setLoading(false);
            return;
        }
        fetchEnvironments();
    }, [enabled, fetchEnvironments]);

    const searchAmbientes = useCallback(
        (query) => {
            const q = (query || '').trim().toLowerCase();
            if (!q) return ambientes;
            return ambientes.filter((a) => {
                const nombre = (a.nombre || '').toLowerCase();
                const ubicacion = (a.ubicacion || '').toLowerCase();
                return nombre.includes(q) || ubicacion.includes(q);
            });
        },
        [ambientes]
    );

    const toModel = (form, base = {}) => new Environment({
        school_id: base.schoolId ?? schoolId,
        code: form.ubicacion.trim(),
        name: form.nombre.trim(),
        capacity: Number(form.capacidad),
        status: base.status ?? true,
    });

    // Las tres operaciones lanzan el error del backend para que la pantalla lo muestre.
    const addAmbiente = useCallback(async (form) => {
        if (!schoolId) throw new Error(t('errors.missingSchool'));
        await EnvironmentService.create(toModel(form));
        await fetchEnvironments();
    }, [schoolId, fetchEnvironments]);

    const updateAmbiente = useCallback(async (form) => {
        await EnvironmentService.update(form.id, toModel(form, {status: form.status}));
        await fetchEnvironments();
    }, [schoolId, fetchEnvironments]);

    const deleteAmbiente = useCallback(async (id) => {
        await EnvironmentService.delete(id);
        await fetchEnvironments();
    }, [fetchEnvironments]);

    return {
        ambientes, updateKey, loading,
        searchAmbientes, addAmbiente, updateAmbiente, deleteAmbiente,
        refresh: fetchEnvironments,
    };
}
