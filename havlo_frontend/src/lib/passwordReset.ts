const RESET_EMAIL_KEY = 'havlo:password-reset-email';
const RESET_TOKEN_KEY = 'havlo:password-reset-token';

export function readPasswordResetEmail(): string {
  return sessionStorage.getItem(RESET_EMAIL_KEY) || '';
}

export function writePasswordResetEmail(email: string) {
  sessionStorage.setItem(RESET_EMAIL_KEY, email);
}

export function readPasswordResetToken(): string {
  return sessionStorage.getItem(RESET_TOKEN_KEY) || '';
}

export function writePasswordResetToken(token: string) {
  sessionStorage.setItem(RESET_TOKEN_KEY, token);
}

export function clearPasswordResetState() {
  sessionStorage.removeItem(RESET_EMAIL_KEY);
  sessionStorage.removeItem(RESET_TOKEN_KEY);
}
