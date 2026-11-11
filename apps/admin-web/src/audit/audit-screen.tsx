import { useState } from "react";
import { readAuditFromCloud } from "#src/api/admin-api.js";
import { AuditView } from "#src/audit/audit-view.js";

export function AuditScreen() {
  const [status, setStatus] = useState("");
  return (
    <AuditView
      status={status}
      onExport={() => {
        void readAuditFromCloud()
          .then(setStatus)
          .catch(() =>
            setStatus(
              "El export de auditoría queda en esta sesión. La nube no respondió.",
            ),
          );
      }}
    />
  );
}
