import { useState } from "react";
import { AuditView } from "#src/audit/audit-view.js";

export function AuditScreen() {
  const [status, setStatus] = useState("");
  return (
    <AuditView
      status={status}
      onExport={() => setStatus("El export de auditoría queda en esta sesión.")}
    />
  );
}
