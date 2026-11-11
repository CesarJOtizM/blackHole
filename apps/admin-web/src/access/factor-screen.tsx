import { useNavigate } from "@tanstack/react-router";
import { FactorView } from "#src/access/login-view.js";
import { signedInEmail, verifyAccess } from "#src/access/session.js";

export function FactorScreen() {
  const navigate = useNavigate();
  const email = signedInEmail();

  return (
    <FactorView
      email={email.length === 0 ? "tu correo" : email}
      onVerify={(code) => {
        const error = verifyAccess(code);
        if (error === null) {
          void navigate({ to: "/home" });
        }
        return error;
      }}
    />
  );
}
