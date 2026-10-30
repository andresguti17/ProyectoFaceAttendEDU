// ============================================================
//  Regresión N-16: los diálogos no se cerraban con Escape.
//  BaseModal solo pasaba onRequestClose cuando closeOnBackdrop era true, así que
//  "Nueva ficha" y los demás modales de edición seguían abiertos tras Escape.
// ============================================================

import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let modalProps;

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

// El Modal de react-native-web monta un portal que react-test-renderer no soporta.
jest.mock("react-native-web/dist/exports/Modal", () => ({
    __esModule: true,
    default: (props) => {
        modalProps = props;
        return props.children;
    },
}));

jest.mock("../../../hooks/useTheme", () => ({
    useTheme: () => ({
        theme: {
            colors: new Proxy({}, { get: () => new Proxy({}, { get: () => "#000" }) }),
        },
    }),
}));

jest.mock("../../../hooks/useResponsive", () => ({
    useResponsive: () => ({ isSmall: false }),
}));

const { BaseModal } = require("../BaseModal");

const render = (props) => {
    modalProps = undefined;
    act(() => {
        create(
            <BaseModal visible title="Nueva ficha" onClose={props.onClose} {...props}>
                {null}
            </BaseModal>
        );
    });
    return modalProps;
};

describe("BaseModal · cierre con Escape", () => {
    it("cierra con Escape cuando tiene botón de cerrar (valor por defecto)", () => {
        const onClose = jest.fn();
        render({ onClose });
        expect(typeof modalProps.onRequestClose).toBe("function");
        modalProps.onRequestClose();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("cierra con Escape cuando se cierra al tocar fuera aunque no tenga botón", () => {
        const onClose = jest.fn();
        render({ onClose, showCloseButton: false, closeOnBackdrop: true });
        modalProps.onRequestClose();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("sigue bloqueante cuando no ofrece ninguna forma de cerrarlo", () => {
        render({ onClose: jest.fn(), showCloseButton: false, closeOnBackdrop: false });
        expect(modalProps.onRequestClose).toBeUndefined();
    });
});
