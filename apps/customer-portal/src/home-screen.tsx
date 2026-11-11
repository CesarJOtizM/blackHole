import { Button, Field } from "@blackhole/ui";
import { useState } from "react";

const ACCOUNT_DOCUMENT = "1010101010";

type Step = "ask" | "match" | "issued";

export function HomeScreen() {
  const [documentId, setDocumentId] = useState("");
  const [step, setStep] = useState<Step>("ask");
  const [error, setError] = useState("");

  function lookup() {
    if (documentId !== ACCOUNT_DOCUMENT) {
      setStep("ask");
      setError("Esos datos no coinciden con esta cuenta.");
      return;
    }
    setError("");
    setStep("match");
  }

  return (
    <main className="mx-auto grid min-h-svh max-w-lg gap-6 px-4 py-8">
      <header className="grid gap-1">
        <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">
          La Parrilla · Chapinero · mesa 12
        </p>
        <h1 className="font-display text-title">Factura a tu nombre</h1>
        <p className="text-ink-muted">
          Llegaste desde el QR de la precuenta. La caja no escribe tus datos.
        </p>
      </header>
      <p className="font-mono text-numeral">$128.400</p>
      {step === "issued" ? (
        <p role="status">
          La factura queda a tu nombre. Puedes consultarla con este mismo enlace
          mientras siga vigente.
        </p>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (step === "match") setStep("issued");
            else lookup();
          }}
        >
          <Field
            label="Cédula"
            inputMode="numeric"
            autoComplete="off"
            value={documentId}
            error={error}
            hint="Solo ves tus datos, y enmascarados."
            onChange={(event) => setDocumentId(event.target.value)}
          />
          {step === "match" ? (
            <div className="grid gap-1 rounded-2xl border-2 border-border p-4">
              <p>C••••• M•••••</p>
              <p className="text-ink-muted">c••••@correo.com</p>
              <p className="text-ink-muted">
                Consumidor con documento, INC 8 %.
              </p>
            </div>
          ) : null}
          <Button type="submit">
            {step === "match" ? "Confirmar factura" : "Buscar mis datos"}
          </Button>
        </form>
      )}
    </main>
  );
}
