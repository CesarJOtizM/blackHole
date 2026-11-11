import { Button, Field } from "@blackhole/ui";
import { useState } from "react";
import { useService } from "#src/service/service-session.js";

const STAFF_PIN = "1357";

export function ClockScreen() {
  const service = useService();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  function submit(action: "in" | "out") {
    if (pin !== STAFF_PIN) {
      setError("PIN personal incorrecto.");
      return;
    }
    setError("");
    setPin("");
    if (action === "in") service.clockIn();
    else service.clockOut();
  }

  return (
    <section className="grid max-w-md gap-4">
      <header>
        <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">
          Dentro del local
        </p>
        <h1 className="font-display text-title">Asistencia</h1>
      </header>
      <p>
        {service.clockedIn
          ? "Jorge Díaz tiene entrada a las 12:00."
          : "Jorge Díaz no tiene entrada. No puede operar."}
      </p>
      <Field
        label="PIN personal"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={pin}
        error={error}
        onChange={(event) => setPin(event.target.value)}
      />
      <div className="grid gap-2">
        <Button onClick={() => submit("in")}>Marcar entrada</Button>
        <Button variant="secondary" onClick={() => submit("out")}>
          Marcar salida
        </Button>
      </div>
      {service.notice ? <p role="status">{service.notice}</p> : null}
    </section>
  );
}
