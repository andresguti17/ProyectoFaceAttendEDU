import { evaluateColor, hexToHsl } from '../colorUtils';

// Valores capturados antes de leer los canales con hexChannels.
test('hexToHsl keeps the hue, saturation and lightness', () => {
  expect(hexToHsl('#1E90FF')).toEqual([210, 100, 56]);
  expect(hexToHsl('#FFD700')).toEqual([51, 100, 50]);
  expect(hexToHsl('#8B0000')).toEqual([0, 100, 27]);
  expect(hexToHsl('#808080')).toEqual([0, 0, 50]);
});

test('evaluateColor keeps its contrast and readability tiers', () => {
  const dark = evaluateColor('#000000');
  const light = evaluateColor('#FFFFFF');
  const blue = evaluateColor('#1E90FF');
  expect([dark.contrastRatio, dark.readability]).toEqual([21, 'appearance.read.excellent']);
  expect([light.contrastRatio, light.readability]).toEqual([21, 'appearance.read.poor']);
  expect([blue.wcagLevel, blue.scoreTone, blue.readability]).toEqual(['AA', 'success', 'appearance.read.weak']);
});
