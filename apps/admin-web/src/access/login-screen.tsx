import { useNavigate } from "@tanstack/react-router";
import { LoginView } from "#src/access/login-view.js";
import { beginAccess } from "#src/access/session.js";

export function LoginScreen() {
  const navigate = useNavigate();

  return (
    <LoginView
      onContinue={(email, password) => {
        const error = beginAccess(email, password);
        if (error === null) {
          void navigate({ to: "/login/factor" });
        }
        return error;
      }}
    />
  );
}
