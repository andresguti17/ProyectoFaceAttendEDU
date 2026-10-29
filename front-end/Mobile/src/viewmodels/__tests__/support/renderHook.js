// Monta un hook en un componente de prueba y devuelve un getter con su último valor.
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

export async function renderHook(useHook, props) {
    let latest;
    let renderer;
    function Probe() {
        latest = useHook(props);
        return null;
    }
    await act(async () => {
        renderer = TestRenderer.create(<Probe />);
    });
    return {result: () => latest, unmount: () => act(() => renderer.unmount())};
}

/** Deja correr promesas y efectos pendientes. */
export async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

export {act};
