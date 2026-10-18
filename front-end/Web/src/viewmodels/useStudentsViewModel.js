import { useState, useMemo, useCallback } from "react";
import { useAppData } from "../context/AppDataContext";
import { provisionStudent } from "../services/api/staffProvisioning";

// ── Tipos de formulario ───────────────────────────────────

export const EMPTY_FORM = {
    name: "",
    code: "",
    email: "",
    course: "",
    role: "student",
    documentNumber: "",
    documentType: "",
    bloodType: "",
    birthDate: "",
    address: "",
    phone: "",
    password: "",
    schoolId: "",
    cohortId: "",
    attendance: 0,
    hasFacial: false,      // Registro facial
    hasFingerprint: false, // Registro de huella dactilar
    status: "active",
};

export function validateStudentForm(form) {
    if (!form.name.trim()) return "Completa todos los campos";
    if (!form.code.trim()) return "Completa todos los campos";
    if (!form.email.trim()) return "Completa todos los campos";
    if (!form.role) return "Completa todos los campos";
    // Todos los roles se crean en el backend (POST /persons exige
    // documentNumber, POST /users exige password de 8-100 chars).
    if (!String(form.documentNumber ?? "").trim()) return "Completa todos los campos";
    if (String(form.password ?? "").length < 8) return "La contraseña debe tener al menos 8 caracteres";
    if (String(form.birthDate ?? "").trim() && !/^\d{4}-\d{2}-\d{2}$/.test(String(form.birthDate).trim())) {
        return "La fecha de nacimiento debe tener formato AAAA-MM-DD";
    }
    // El programa/ficha solo aplica a estudiantes (el formulario de
    // docente/administrador ni siquiera lo muestra).
    if (form.role === "student" && !form.course.trim()) return "Completa todos los campos";
    // El docente/administrador queda vinculado a su sede (actor).
    if ((form.role === "teacher" || form.role === "admin") && !String(form.schoolId ?? "").trim()) {
        return "Selecciona la sede";
    }
    return null;
}

/**
 * Validación que devuelve todos los errores encontrados
 * @param {Object} form - Formulario a validar
 * @returns {Array} Array de objetos con errores { field, message }
 */
export function validateStudentFormDetailed(form) {
    const errors = [];
    
    if (!form.name.trim()) {
        errors.push({ field: 'name', message: 'El nombre completo es requerido' });
    }
    
    if (!form.code.trim()) {
        errors.push({ field: 'code', message: 'El código es requerido' });
    }
    
    if (!form.email.trim()) {
        errors.push({ field: 'email', message: 'El correo electrónico es requerido' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        errors.push({ field: 'email', message: 'El formato del correo electrónico no es válido' });
    }
    
    if (!form.course.trim()) {
        errors.push({ field: 'course', message: 'El programa/departamento es requerido' });
    }
    
    if (!form.role) {
        errors.push({ field: 'role', message: 'El rol es requerido' });
    }
    
    return errors;
}

// ── ViewModel ─────────────────────────────────────────────

export function useStudentsViewModel() {
    const appData = useAppData();

    const [search, setSearch] = useState("");
    const [courseFilter, setCourseFilter] = useState("");
    const [selected, setSelected] = useState(null);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    // Programas únicos — derivados del contexto global con formato para AnimatedDropdown
    const courses = useMemo(
        () => appData.programs.map((p) => ({
            value: p.name,
            label: p.name,
            icon: "book-open"
        })),
        [appData.programs]
    );

    const filtered = useMemo(
        () =>
            appData.students.filter((s) => {
                const matchSearch =
                    !search ||
                    s.name.toLowerCase().includes(search.toLowerCase()) ||
                    s.code.toLowerCase().includes(search.toLowerCase());
                const matchCourse = !courseFilter || s.course === courseFilter;
                return matchSearch && matchCourse;
            }),
        [appData.students, search, courseFilter]
    );

    const registerStudent = useCallback(
        async (form) => {
            const err = validateStudentForm(form);
            if (err) return err;

            try {
                await provisionStudent({
                    name: form.name.trim(),
                    code: form.code.trim(),
                    email: form.email.trim(),
                    documentNumber: String(form.documentNumber ?? "").trim(),
                    password: String(form.password ?? ""),
                    courseCode: form.course.trim(),
                    cohortId: String(form.cohortId ?? "").trim() || null,
                    details: form,
                });
            } catch (e) {
                return e?.message || "No se pudo registrar el estudiante en el backend";
            }

            await appData.addStudent({
                name: form.name.trim(),
                code: form.code.trim(),
                email: form.email.trim(),
                course: form.course.trim(),
                grade: form.role,
                attendance: form.attendance,
                hasFacial: form.hasFacial || false,
                hasFingerprint: form.hasFingerprint || false,
                status: form.status,
            });
            return null;
        },
        [appData]
    );

    const importStudents = useCallback(
        async (drafts) => {
            return appData.importStudents(drafts);
        },
        [appData]
    );

    function selectStudent(student) {
        setSelected(student);
    }

    return {
        students: appData.students || [],
        filtered: filtered || [],
        courses: courses || [],
        selected,
        isLoading: appData.isLoading,
        search,
        courseFilter,
        showRegisterModal,
        showImportModal,
        setSearch,
        setCourseFilter,
        selectStudent,
        clearSelection: () => setSelected(null),
        openRegisterModal: () => setShowRegisterModal(true),
        closeRegisterModal: () => setShowRegisterModal(false),
        openImportModal: () => setShowImportModal(true),
        closeImportModal: () => setShowImportModal(false),
        registerStudent,
        importStudents,
    };
}
