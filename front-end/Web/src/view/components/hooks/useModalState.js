import { useState, useCallback } from "react";

/**
 * useModalState - Hook genérico para manejar estado de modales
 * 
 * Simplifica el manejo de modales con estados comunes: visible, data, mode.
 * Proporciona helpers para abrir, cerrar y alternar el modal.
 * 
 * @param {boolean} initialVisible - Estado inicial de visibilidad (default: false)
 * @param {any} initialData - Datos iniciales del modal (default: null)
 * @param {string} initialMode - Modo inicial (default: "none")
 * 
 * @returns {Object} Estado y funciones del modal
 * @property {boolean} isVisible - Si el modal está visible
 * @property {any} data - Datos asociados al modal (ej: item seleccionado)
 * @property {string} mode - Modo del modal (ej: "create", "edit", "view")
 * @property {Function} open - Abre el modal con data y mode opcionales
 * @property {Function} close - Cierra el modal y resetea data/mode
 * @property {Function} toggle - Alterna visibilidad del modal
 * @property {Function} setData - Actualiza solo los datos del modal
 * @property {Function} setMode - Actualiza solo el modo del modal
 * 
 * @example
 * // Básico - solo visible/hidden
 * const modal = useModalState();
 * 
 * <Button onPress={modal.open}>Abrir</Button>
 * <Modal visible={modal.isVisible} onClose={modal.close}>
 *   Contenido
 * </Modal>
 * 
 * @example
 * // Con datos - para editar/ver items
 * const modal = useModalState();
 * 
 * const handleEdit = (user) => {
 *   modal.open(user, "edit");
 * };
 * 
 * <Modal visible={modal.isVisible} onClose={modal.close}>
 *   <UserForm 
 *     mode={modal.mode} 
 *     user={modal.data} 
 *   />
 * </Modal>
 * 
 * @example
 * // Múltiples modos
 * const modal = useModalState(false, null, "none");
 * 
 * const openCreate = () => modal.open(null, "create");
 * const openEdit = (item) => modal.open(item, "edit");
 * const openView = (item) => modal.open(item, "view");
 * 
 * <Modal visible={modal.isVisible}>
 *   {modal.mode === "create" && <CreateForm />}
 *   {modal.mode === "edit" && <EditForm item={modal.data} />}
 *   {modal.mode === "view" && <ViewDetails item={modal.data} />}
 * </Modal>
 * 
 * @example
 * // Con múltiples modales en un Screen
 * const userModal = useModalState();
 * const deleteModal = useModalState();
 * const detailsModal = useModalState();
 * 
 * <Button onPress={() => userModal.open(null, "create")}>Nuevo</Button>
 * <Button onPress={() => detailsModal.open(user)}>Ver detalles</Button>
 * 
 * <UserFormModal {...userModal} />
 * <DeleteConfirmModal {...deleteModal} />
 * <DetailsModal {...detailsModal} />
 */
export function useModalState(
    initialVisible = false,
    initialData = null,
    initialMode = "none"
) {
    const [isVisible, setIsVisible] = useState(initialVisible);
    const [data, setData] = useState(initialData);
    const [mode, setMode] = useState(initialMode);

    /**
     * Abre el modal con datos y modo opcionales
     * @param {any} modalData - Datos del modal (ej: item a editar)
     * @param {string} modalMode - Modo del modal (ej: "create", "edit")
     */
    const open = useCallback((modalData = null, modalMode = "none") => {
        setData(modalData);
        setMode(modalMode);
        setIsVisible(true);
    }, []);

    /**
     * Cierra el modal y resetea datos/modo
     * @param {boolean} resetData - Si resetear data a null (default: true)
     * @param {boolean} resetMode - Si resetear mode a "none" (default: true)
     */
    const close = useCallback((resetData = true, resetMode = true) => {
        setIsVisible(false);
        if (resetData) setData(null);
        if (resetMode) setMode("none");
    }, []);

    /**
     * Alterna la visibilidad del modal
     */
    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, []);

    return {
        isVisible,
        data,
        mode,
        open,
        close,
        toggle,
        setData,
        setMode,
    };
}

/**
 * useMultiModalState - Helper para manejar múltiples modales con un solo hook
 * 
 * Útil cuando tienes varios modales y quieres gestionarlos centralmente.
 * 
 * @param {string[]} modalNames - Array de nombres de modales
 * @returns {Object} Objeto con cada modal como propiedad
 * 
 * @example
 * const modals = useMultiModalState(["create", "edit", "delete", "details"]);
 * 
 * <Button onPress={() => modals.create.open()}>Crear</Button>
 * <Button onPress={() => modals.edit.open(item)}>Editar</Button>
 * <Button onPress={() => modals.delete.open(item)}>Eliminar</Button>
 * 
 * <CreateModal visible={modals.create.isVisible} onClose={modals.create.close} />
 * <EditModal visible={modals.edit.isVisible} data={modals.edit.data} onClose={modals.edit.close} />
 * <DeleteModal visible={modals.delete.isVisible} data={modals.delete.data} onClose={modals.delete.close} />
 */
export function useMultiModalState(modalNames = []) {
    const modals = {};
    
    modalNames.forEach(name => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        modals[name] = useModalState();
    });
    
    return modals;
}

export default useModalState;
