interface AccessState {
  signedIn: boolean;
  email: string;
}

let state: AccessState = {
  signedIn: false,
  email: "",
};

export function isSignedIn(): boolean {
  return state.signedIn;
}

export function signedInEmail(): string {
  return state.email;
}

export function beginAccess(email: string, password: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@") || !normalized.includes(".")) {
    return "Escribe el correo de la empresa.";
  }
  if (password.trim().length === 0) {
    return "Escribe la contraseña.";
  }
  state = { signedIn: false, email: normalized };
  return null;
}

export function verifyAccess(code: string): string | null {
  if (state.email.length === 0) {
    return "Primero ingresa con el correo.";
  }
  if (!/^\d{4}$/.test(code)) {
    return "El código tiene 4 dígitos.";
  }
  state = { ...state, signedIn: true };
  return null;
}

export function resetAccess(): void {
  state = { signedIn: false, email: "" };
}
