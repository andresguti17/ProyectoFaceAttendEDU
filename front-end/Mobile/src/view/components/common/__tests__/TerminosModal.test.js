// El modal de términos del primer ingreso: se monta sin romper (antes importaba un export por
// defecto de Style.js que no existe) y muestra el texto vigente, no claves sin traducir.
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import es from '../../../../utils/locales/es.json';
import TerminosModal from '../TerminosModal';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key) => key.split('.').reduce((node, part) => node?.[part], require('../../../../utils/locales/es.json')) ?? key,
    }),
}));
jest.mock('../ThemeContext', () => ({useTheme: () => ({colors: {}})}));

function textOf(node) {
    if (node == null) return '';
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(textOf).join('');
    return textOf(node.children);
}

function render(props) {
    let root;
    act(() => {
        root = TestRenderer.create(<TerminosModal isVisible onClose={jest.fn()} {...props} />);
    });
    return textOf(root.toJSON());
}

test('the first-login modal shows every section of the current terms and the sign buttons', () => {
    const text = render({onAccept: jest.fn()});

    expect(text).toContain(es.termsModal.title);
    for (let n = 1; n <= 14; n += 1) {
        expect(text).toContain(es.termsModal[`s${n}Title`]);
    }
    expect(text).toContain(es.termsGate.sign);
    expect(text).toContain(es.termsGate.leave);
    expect(text).not.toMatch(/termsModal\./);
});

test('read-only mode (link on the login screen) only offers to close', () => {
    const text = render({});

    expect(text).not.toContain(es.termsGate.sign);
    expect(text).toContain(es.common.close);
});
