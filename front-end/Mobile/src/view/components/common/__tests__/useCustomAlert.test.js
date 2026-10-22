import React, {useState} from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {useCustomAlert} from '../useCustomAlert';

// Regresión: si showError cambia en cada render, los efectos que dependen de él
// (p. ej. load en useUpdatePhotoViewModel) se repiten sin fin y la pantalla queda cargando.
it('keeps showError and showSuccess stable across re-renders', () => {
    const seen = [];
    let bump;
    function Probe() {
        const [count, setCount] = useState(0);
        bump = () => setCount((c) => c + 1);
        const {showError, showSuccess} = useCustomAlert();
        seen.push({showError, showSuccess, count});
        return null;
    }

    act(() => {
        TestRenderer.create(<Probe />);
    });
    act(() => bump());
    act(() => bump());

    expect(seen.length).toBeGreaterThan(2);
    const first = seen[0];
    for (const render of seen) {
        expect(render.showError).toBe(first.showError);
        expect(render.showSuccess).toBe(first.showSuccess);
    }
});
