import { afterEach, describe, expect, it } from "vitest";
import {
  beginAccess,
  isSignedIn,
  resetAccess,
  signedInEmail,
  verifyAccess,
} from "#src/access/session.js";

describe("access session", () => {
  afterEach(() => {
    resetAccess();
  });

  it("Given a malformed email, When access begins, Then it stays signed out", () => {
    const error = beginAccess("carolina", "secreta");

    expect(error).toBe("Escribe el correo de la empresa.");
    expect(isSignedIn()).toBe(false);
  });

  it("Given a valid email, When access begins, Then the second step still has to confirm", () => {
    const error = beginAccess("Carolina@LaParrilla.co", "secreta");

    expect(error).toBeNull();
    expect(isSignedIn()).toBe(false);
    expect(signedInEmail()).toBe("carolina@laparrilla.co");
  });

  it("Given no email yet, When a code is verified, Then access is refused", () => {
    expect(verifyAccess("4819")).toBe("Primero ingresa con el correo.");
    expect(isSignedIn()).toBe(false);
  });

  it("Given a started email, When four digits are verified, Then the session is open", () => {
    beginAccess("carolina@laparrilla.co", "secreta");

    expect(verifyAccess("4819")).toBeNull();
    expect(isSignedIn()).toBe(true);
  });
});
