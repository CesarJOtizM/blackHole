import { Button, Field } from "@blackhole/ui";
import { type FormEvent, useState } from "react";

export function BillingDataScreen({ token }: { token: string }) {
  const [documentNumber, setDocumentNumber] = useState("");
  const [email, setEmail] = useState("");
  const [municipalityCode, setMunicipalityCode] = useState("");
  const [oneTimeCode, setOneTimeCode] = useState("");
  const [sent, setSent] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOneTimeCode("");
    setSent(true);
  }

  return (
    <main className="mx-auto grid min-h-svh max-w-lg gap-6 px-4 py-8">
      <header className="grid gap-1">
        <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">
          Precuenta {token}
        </p>
        <h1 className="font-display text-title">Factura a tu nombre</h1>
      </header>
      <form className="grid gap-4" onSubmit={submit}>
        <Field
          label="Cédula"
          inputMode="numeric"
          autoComplete="off"
          value={documentNumber}
          onChange={(event) => setDocumentNumber(event.target.value)}
        />
        <Field
          label="Correo"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          label="Municipio"
          autoComplete="off"
          value={municipalityCode}
          onChange={(event) => setMunicipalityCode(event.target.value)}
        />
        <Field
          label="Código de un solo uso"
          inputMode="numeric"
          autoComplete="off"
          value={oneTimeCode}
          onChange={(event) => setOneTimeCode(event.target.value)}
        />
        <Button type="submit">Enviar datos</Button>
      </form>
      {sent ? <p role="status">Datos enviados.</p> : null}
    </main>
  );
}
