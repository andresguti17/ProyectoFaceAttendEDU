import {useCallback, useEffect, useState} from 'react';
import {useLanguageRefresh} from '../utils/useLanguageRefresh';
import {backendGet} from '../api/backend';
import ENV from '../config/env';
import {PersonService} from '../services/PersonService';
import {UserService} from '../services/UserService';
import Person from '../models/identity/Person';
import AppUser from '../models/identity/AppUser';
import {SchoolService} from '../services/SchoolService';
import {changeRole, createAccount} from '../services/userProvisioning';

export const ROLE_OPTIONS = ['Aprendiz', 'Instructor', 'Administrador'];
const USERS_PAGE_SIZE = 100;

function unwrap(data) {
  if (data && Array.isArray(data.value)) return data.value;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

export function useManageUsersViewModel(enabled = true) {
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const updateKey = useLanguageRefresh();

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      // Contratos gateway Kong: GET /api/v1/users?page=&limit=, GET
      // /api/v1/users/{id}/roles -> [{roleId, roleName}], GET /api/v1/persons/{id}.
      // Todas las páginas: antes solo se pedían las primeras 50 cuentas.
      const users = [];
      for (let page = 1; ; page++) {
        const batch = unwrap(await backendGet(ENV.API_BASE_URL, 'api/v1/users', {page, limit: USERS_PAGE_SIZE}));
        users.push(...batch);
        if (batch.length < USERS_PAGE_SIZE) break;
      }

      // Enriquecer por lotes acotados: 50 usuarios x 2 peticiones en un solo
      // Promise.all saturaban el gateway (rate-limit) y dejaban roles y
      // personas en blanco, desclasificando usuarios de ambas listas.
      const ENRICH_CHUNK_SIZE = 10;
      const entries = [];
      for (let i = 0; i < users.length; i += ENRICH_CHUNK_SIZE) {
        const chunk = await Promise.all(users.slice(i, i + ENRICH_CHUNK_SIZE).map(async (u) => {
        const uid = u.user_id || u.userId;
        const pid = u.person_id || u.personId;
        let roles = [];
        try {
          roles = unwrap(await backendGet(ENV.API_BASE_URL, `api/v1/users/${uid}/roles`));
        } catch {
          roles = [];
        }
        const roleNames = roles.map(r => r.role_name).filter(Boolean);
        let person = {};
        if (pid) {
          try {
            const personArr = unwrap(await backendGet(ENV.API_BASE_URL, `api/v1/persons/${pid}`));
            person = personArr[0] || {};
          } catch {
            person = {};
          }
        }
        return {
          id: uid,
          userId: uid,
          personId: pid,
          // Requerido por el PUT (documentNumber @NotBlank): sin esto el
          // guardado de edición respondía 400 siempre.
          documentNumber: person.document_number || person.documentNumber || null,
          nombre: `${person.name || ''} ${person.last_name || person.lastName || ''}`.trim(),
          name: person.name || '',
          lastName: person.last_name || '',
          email: person.email || '',
          telefono: person.phone || '',
          username: u.username,
          status: u.status,
          roles,
          roleNames,
          role: ROLE_OPTIONS.find((r) => roleNames.includes(r)) || roleNames[0] || null,
        };
        }));
        entries.push(...chunk);
      }

      const isStudent = (e) => e.roleNames.some(n => String(n).toLowerCase() === 'aprendiz');
      const isTeacher = (e) => e.roleNames.some(n => ['instructor', 'administrador'].includes(String(n).toLowerCase()));
      setStudents(entries.filter(isStudent));
      setTeachers(entries.filter(e => !isStudent(e) && isTeacher(e)));
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Solo Administrador puede listar/gestionar usuarios: evita la petición
    // mientras la pantalla valida el rol (o si se monta sin permiso).
    if (!enabled) {
      setLoading(false);
      return;
    }
    fetchUsers();
  }, [enabled, fetchUsers]);

  const searchStudents = useCallback((query) => {
    if (!query || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    return students.filter(s => (s.nombre || '').toLowerCase().includes(q));
  }, [students]);

  const searchTeachers = useCallback((query) => {
    if (!query || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    return teachers.filter(teacher => (teacher.nombre || '').toLowerCase().includes(q));
  }, [teachers]);

  const persistPerson = useCallback(async (item) => {
    const person = await PersonService.update(item.personId, new Person({
      person_id: item.personId,
      document_number: item.documentNumber,
      name: item.name.trim(),
      last_name: item.lastName.trim(),
      email: item.email || null,
      phone: item.telefono || null,
    }));
    await UserService.update(item.userId || item.id, new AppUser({
      user_id: item.userId || item.id,
      person_id: item.personId,
      status: item.status,
    }));
    if (item.role && !item.roleNames.includes(item.role)) {
      await changeRole({userId: item.userId || item.id, personId: item.personId, currentRoles: item.roles, roleName: item.role});
    }
    return {...item, nombre: person?.fullName || `${item.name} ${item.lastName}`.trim()};
  }, []);

  // Alta real (persona + usuario + rol + actor); recarga para que la cuenta
  // aparezca en la pestaña que corresponde a su rol.
  const createUser = useCallback(async (form) => {
    await createAccount({
      name: form.name.trim(),
      lastName: form.lastName.trim(),
      documentNumber: form.documentNumber.trim(),
      email: form.email.trim() || null,
      phone: form.telefono.trim() || null,
      username: form.username.trim(),
      password: form.password,
      roleName: form.role,
      schoolId: await SchoolService.getCurrentSchoolId(),
    });
    await fetchUsers();
  }, [fetchUsers]);

  // Tras editar se recarga: un cambio de rol mueve la cuenta de pestaña.
  const updateStudent = useCallback(async (student) => {
    await persistPerson(student);
    await fetchUsers();
  }, [persistPerson, fetchUsers]);

  // El backend no tiene DELETE físico (modelo: borrado lógico vía status,
  // AGENTS.md §2.2): desactivar cambia status=false en usuario y persona y
  // la fila sigue visible como inactiva en vez de desaparecer.
  const setActiveStatus = useCallback(async (item, status) => {
    await UserService.setStatus(item.userId || item.id, status);
    if (item.personId) {
      await PersonService.setStatus(item.personId, status).catch(() => {});
    }
    return {...item, status};
  }, []);

  const deleteStudent = useCallback(async (id) => {
    const student = students.find(item => item.id === id);
    if (!student) return;
    const next = !(student.status !== false);
    const updated = await setActiveStatus(student, next);
    setStudents(prev => prev.map(s => (s.id === id ? updated : s)));
  }, [students, setActiveStatus]);

  const updateTeacher = useCallback(async (teacher) => {
    await persistPerson(teacher);
    await fetchUsers();
  }, [persistPerson, fetchUsers]);

  const deleteTeacher = useCallback(async (id) => {
    const teacher = teachers.find(item => item.id === id);
    if (!teacher) return;
    const next = !(teacher.status !== false);
    const updated = await setActiveStatus(teacher, next);
    setTeachers(prev => prev.map(t => (t.id === id ? updated : t)));
  }, [teachers, setActiveStatus]);

  return {
    allStudents: students,
    students,
    teachers,
    loading,
    updateKey,
    searchStudents,
    searchTeachers,
    createUser,
    updateStudent,
    deleteStudent,
    updateTeacher,
    deleteTeacher,
    refresh: fetchUsers,
  };
}
