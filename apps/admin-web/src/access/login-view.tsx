import { useState } from "react";
import styles from "#src/styles/access.module.scss";
import ui from "#src/styles/ui.module.scss";

export function LoginView({
  onContinue,
}: {
  onContinue: (email: string, password: string) => string | null;
}) {
  const [email, setEmail] = useState("carolina@laparrilla.co");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={styles.stage}>
      <Manifesto />
      <section className={styles.panel}>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            setError(onContinue(email, password));
          }}
        >
          <p className={ui.eyebrow}>Administración</p>
          <h1 className={ui.title}>Ingresa a tu empresa</h1>
          <p className={ui.note}>
            Para propietarios, gerentes, administradores de sede, contadores y
            auditores.
          </p>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Correo</span>
            <input
              className={ui.input}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Contraseña</span>
            <input
              className={ui.input}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <p className={ui.error}>{error}</p> : null}
          <button type="submit" className={ui.button}>
            Continuar
          </button>
          <p className={ui.note}>
            ¿Olvidaste la contraseña? El personal de salón entra con PIN en la
            sede, no aquí.
          </p>
        </form>
      </section>
    </div>
  );
}

export function FactorView({
  email,
  onVerify,
}: {
  email: string;
  onVerify: (code: string) => string | null;
}) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [trust, setTrust] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={styles.stage}>
      <Manifesto />
      <section className={styles.panel}>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            setError(onVerify(digits.join("")));
          }}
        >
          <p className={ui.eyebrow}>
            Verificación · obligatoria para propietarios
          </p>
          <h1 className={ui.title}>Escribe el código de tu app</h1>
          <p className={ui.note}>
            Abre tu app de autenticación. El código cambia cada 30 segundos.
            Estás entrando como {email}.
          </p>
          <div className={styles.digits}>
            {digits.map((digit, index) => (
              <input
                key={index}
                className={styles.digit}
                inputMode="numeric"
                maxLength={1}
                aria-label={`Dígito ${index + 1}`}
                value={digit}
                onChange={(event) => {
                  const next = [...digits];
                  next[index] = event.target.value.replace(/\D/g, "").slice(-1);
                  setDigits(next);
                }}
              />
            ))}
          </div>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={trust}
              onChange={(event) => setTrust(event.target.checked)}
            />
            <span>
              Confiar en este equipo 30 días. No lo actives en computadores
              compartidos de la sede.
            </span>
          </label>
          {error ? <p className={ui.error}>{error}</p> : null}
          <button type="submit" className={ui.button}>
            Verificar
          </button>
          <p className={ui.note}>
            ¿Perdiste el teléfono? Usa un código de respaldo.
          </p>
        </form>
      </section>
    </div>
  );
}

function Manifesto() {
  return (
    <section className={styles.manifesto}>
      <p className={styles.brand}>Blackhole</p>
      <div>
        <h2 className={styles.pitch}>
          La comanda, la caja y la factura en un solo rollo.
        </h2>
        <p className={styles.rule} aria-hidden="true">
          - - - - - - - - - - - - - - - - - - - -
        </p>
        <p className={styles.kicker}>Administración · empresas y sedes</p>
      </div>
    </section>
  );
}
