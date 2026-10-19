export const MAX_CODE_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 30000;
export const CODE_EXPIRATION_MS = 600000;
export const RESEND_COOLDOWN_MS = 60000;
export const REQUEST_TIMEOUT_MS = 15000;
export const CODE_LENGTH = 6;
export const FOCUS_DELAY_MS = 400;
export const NAVIGATION_DELAY_MS = 1500;

export const VerificationErrorType = {
  INVALID_CODE: 'INVALID_CODE',
  EXPIRED_CODE: 'EXPIRED_CODE',
  NO_CODE: 'NO_CODE',
  TIMEOUT: 'TIMEOUT',
  GENERIC: 'GENERIC',
};

export const PasswordUpdateErrorType = {
  REQUIRED: 'REQUIRED',
  REQUIREMENTS: 'REQUIREMENTS',
  MISMATCH: 'MISMATCH',
  TIMEOUT: 'TIMEOUT',
  GENERIC: 'GENERIC',
};

export const COMMON_PASSWORDS = [
  'password', 'password1', 'password123',
  '12345678', '123456789', '1234567890',
  'qwerty', 'qwerty123', 'qwertyui',
  'iloveyou', 'sunshine', 'princess',
  'football', 'baseball', 'superman',
  'letmein', 'welcome', 'monkey',
  'master', 'dragon', 'login', 'admin',
];

export const SEQUENTIAL_PATTERNS = [
  '123', '234', '345', '456', '567', '678', '789', '890',
  'qwe', 'wer', 'ert', 'asd', 'sdf', 'zxc', 'xcv',
  'abc', 'bcd', 'cde', 'def', 'efg',
];
