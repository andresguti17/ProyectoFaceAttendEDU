import {isLightColor} from '../ScreenSafeArea';

describe('isLightColor', () => {
    it('treats white and light neutrals as light (dark status bar icons)', () => {
        expect(isLightColor('#ffffff')).toBe(true);
        expect(isLightColor('#f0f0f0')).toBe(true);
        expect(isLightColor('#fff')).toBe(true);
    });

    it('treats dark surfaces and saturated dark colors as dark (light icons)', () => {
        expect(isLightColor('#000000')).toBe(false);
        expect(isLightColor('#0f172a')).toBe(false);
        expect(isLightColor('#1e3a8a')).toBe(false);
    });

    it('falls back to dark for missing or non-hex colors', () => {
        expect(isLightColor(undefined)).toBe(false);
        expect(isLightColor('rgba(255, 255, 255, 0.5)')).toBe(false);
    });
});
