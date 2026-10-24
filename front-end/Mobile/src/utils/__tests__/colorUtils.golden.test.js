import { evaluateColor, hexToHsl } from '../colorUtils';

// Valores capturados antes de quitar la lectura de canales duplicada, para
// comprobar que el refactor no cambia ningún veredicto.
const EXPECTED = {
    "#000000": {
        "score": "appearance.score.acceptable",
        "scoreTone": "warning",
        "readability": "appearance.read.excellent",
        "vibe": "appearance.vibe.neutral",
        "uiFit": "appearance.uiFit.dark",
        "tip": "appearance.tip.fine",
        "contrastRatio": 21,
        "wcagLevel": "AAA"
    },
    "#FFFFFF": {
        "score": "appearance.score.acceptable",
        "scoreTone": "warning",
        "readability": "appearance.read.poor",
        "vibe": "appearance.vibe.neutral",
        "uiFit": "appearance.uiFit.light",
        "tip": "appearance.tip.lowerLum15",
        "contrastRatio": 21,
        "wcagLevel": "AAA"
    },
    "#1E90FF": {
        "score": "appearance.score.good",
        "scoreTone": "success",
        "readability": "appearance.read.weak",
        "vibe": "appearance.vibe.blue",
        "uiFit": "appearance.uiFit.balanced",
        "tip": "appearance.tip.lowerLum8",
        "contrastRatio": 6.5,
        "wcagLevel": "AA"
    },
    "#FFD700": {
        "score": "appearance.score.acceptable",
        "scoreTone": "warning",
        "readability": "appearance.read.poor",
        "vibe": "appearance.vibe.orange",
        "uiFit": "appearance.uiFit.balanced",
        "tip": "appearance.tip.fine",
        "contrastRatio": 15,
        "wcagLevel": "AAA"
    },
    "#808080": {
        "score": "appearance.score.acceptable",
        "scoreTone": "warning",
        "readability": "appearance.read.weak",
        "vibe": "appearance.vibe.neutral",
        "uiFit": "appearance.uiFit.desaturated",
        "tip": "appearance.tip.fine",
        "contrastRatio": 5.3,
        "wcagLevel": "AA"
    },
    "#8B0000": {
        "score": "appearance.score.excellent",
        "scoreTone": "success",
        "readability": "appearance.read.excellent",
        "vibe": "appearance.vibe.red",
        "uiFit": "appearance.uiFit.balanced",
        "tip": "appearance.tip.fine",
        "contrastRatio": 10,
        "wcagLevel": "AAA"
    }
};

const EXPECTED_HSL = {
    "#000000": [
        0,
        0,
        0
    ],
    "#FFFFFF": [
        0,
        0,
        100
    ],
    "#1E90FF": [
        210,
        100,
        56
    ],
    "#FFD700": [
        51,
        100,
        50
    ],
    "#808080": [
        0,
        0,
        50
    ],
    "#8B0000": [
        0,
        100,
        27
    ]
};

describe('evaluateColor (Mobile)', () => {
  it.each(Object.keys(EXPECTED))('keeps the verdict for %s', (hex) => {
    expect(evaluateColor(hex)).toEqual(EXPECTED[hex]);
  });
});

describe('hexToHsl', () => {
  it.each(Object.keys(EXPECTED_HSL))('keeps the HSL of %s', (hex) => {
    expect(hexToHsl(hex)).toEqual(EXPECTED_HSL[hex]);
  });
});
