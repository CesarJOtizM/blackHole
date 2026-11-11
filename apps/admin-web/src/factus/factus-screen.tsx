import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  addContributor,
  askForFactusDocuments,
  continueWithoutIssuing,
  listContributors,
  listFactusDocuments,
} from "#src/api/admin-api.js";
import {
  ContributorsView,
  FactusDocumentsView,
} from "#src/factus/factus-view.js";

export function FactusDocumentsScreen() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState(() => listFactusDocuments());
  const [status, setStatus] = useState("");

  return (
    <FactusDocumentsView
      documents={documents}
      status={status}
      onAsk={() => {
        setStatus(askForFactusDocuments());
        setDocuments(listFactusDocuments());
      }}
      onContinue={() => setStatus(continueWithoutIssuing())}
      onContributors={() => {
        void navigate({ to: "/plan/factus/contributors" });
      }}
    />
  );
}

export function ContributorsScreen() {
  const [contributors, setContributors] = useState(() => listContributors());
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  return (
    <ContributorsView
      contributors={contributors}
      error={error}
      status={status}
      onAdd={(name, nit) => {
        const refusal = addContributor(name, nit);

        if (refusal !== null) {
          setError(refusal);
          return false;
        }

        setError("");
        setStatus("El segundo contribuyente queda en el alta.");
        setContributors(listContributors());
        return true;
      }}
    />
  );
}
