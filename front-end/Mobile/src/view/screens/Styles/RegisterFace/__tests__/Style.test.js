import { createRegisterFaceStyles } from '../Style';

const colors = new Proxy(
  { cameraBackground: '#101010', onCamera: '#FAFAFA', text: '#202020' },
  { get: (target, key) => target[key] ?? '#123456' },
);

describe('createRegisterFaceStyles liveness overlay', () => {
  const styles = createRegisterFaceStyles(colors);

  it('takes the banner and its texts from the theme tokens', () => {
    expect(styles.livenessBanner.backgroundColor).toBe('#101010C7');
    expect(styles.livenessLabel.color).toBe('#FAFAFAB3');
    expect(styles.livenessAction.color).toBe('#FAFAFA');
    expect(styles.livenessProgress.color).toBe('#FAFAFAD9');
  });

  it('takes the person name color from the theme text token', () => {
    expect(styles.registerFacePerson.color).toBe('#202020');
  });

  it('defines each style key once in the source', () => {
    const source = require('fs').readFileSync(require.resolve('../Style'), 'utf8');
    const keys = [...source.matchAll(/^\s{0,8}([A-Za-z]\w*): \{/gm)].map((match) => match[1]);
    expect(keys.filter((key, index) => keys.indexOf(key) !== index)).toEqual([]);
  });
});
