import AsyncStorage from '@react-native-async-storage/async-storage';
import {savePaletteForRole, getPaletteForRole} from '../themeByRole';

describe('palette storage por rol', () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
        jest.restoreAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    test('guarda y recupera la paleta del rol', async () => {
        expect(await savePaletteForRole('docente', 'tritanopia')).toBe(true);
        expect(await getPaletteForRole('docente')).toBe('tritanopia');
    });

    test('paleta sin registro usa la predeterminada', async () => {
        expect(await getPaletteForRole('docente')).toBe('normal');
    });

    test('paleta guardada inválida vuelve a la predeterminada', async () => {
        await AsyncStorage.setItem('palette_docente', 'inexistente');
        expect(await getPaletteForRole('docente')).toBe('normal');
    });

    test('error al leer la paleta devuelve la predeterminada', async () => {
        jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
        expect(await getPaletteForRole('docente')).toBe('normal');
    });

    test('error al guardar la paleta devuelve false sin lanzar', async () => {
        jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
        await expect(savePaletteForRole('docente', 'protanopia')).resolves.toBe(false);
    });

    test('sin rol no guarda y responde false', async () => {
        expect(await savePaletteForRole(null, 'normal')).toBe(false);
        expect(await getPaletteForRole(null)).toBe('normal');
    });
});
