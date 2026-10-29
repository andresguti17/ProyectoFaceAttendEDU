// Monta un hook en un componente de prueba y devuelve un getter con su último valor.
import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export async function renderHook(useHook, props, Wrapper = null) {
    let latest;
    let renderer;
    function Probe() {
        latest = useHook(props);
        return null;
    }
    await act(async () => {
        renderer = create(Wrapper ? <Wrapper><Probe /></Wrapper> : <Probe />);
    });
    return { result: () => latest, unmount: () => act(() => renderer.unmount()) };
}

/** Deja correr promesas y efectos pendientes. */
export async function flush(times = 2) {
    for (let i = 0; i < times; i += 1) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
    }
}

export { act };
