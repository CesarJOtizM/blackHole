import { useNavigate } from "@tanstack/react-router";
import { LoginView } from "#src/access/login-view.js";
import { beginAccess } from "#src/access/session.js";
import { signInAdministration } from "#src/api/admin-api.js";

export function LoginScreen() {
  const navigate = useNavigate();

  return (
    <LoginView
      onContinue={(email, password) => {
        const error = beginAccess(email, password);
        if (error === null) {
          void signInAdministration(email, password).catch(() => undefined);
          void navigate({ to: "/login/factor" });
        }
        return error;
      }}
    />
  );
}
