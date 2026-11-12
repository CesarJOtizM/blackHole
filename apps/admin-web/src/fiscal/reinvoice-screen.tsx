import { useState } from "react";
import { ADMIN_SCOPE } from "#src/api/admin-api.js";
import {
  type ReinvoiceWindowChoice,
  ReinvoiceWindowView,
} from "#src/fiscal/reinvoice-view.js";

const APPROVE_REINVOICE_PATH = `/tenants/${ADMIN_SCOPE.tenantId}/venues/${ADMIN_SCOPE.venueId}/reinvoices/approve`;

export interface ReinvoiceApprovalRequest {
  invoiceNumber: string;
  at: string;
  original: {
    closureId: string;
    referenceCode: string;
    status: "accepted";
    buyer: {
      documentType: "13";
      documentNumber: "222222222222";
      name: "Consumidor final";
      responsibility: "R-99-PN";
      email: string;
    };
    number?: string;
  };
  creditNote: {
    referenceCode: string;
    tenantId: string;
    actorId: string;
    authorizerId: string | null;
    deviceId: string;
    siteId: string;
    reason: string;
  };
  invoice: {
    closureId: string;
    referenceCode: string;
    taxpayerEmail: string;
    documentBalance: number;
    rules: readonly never[];
    siteRangeId: string;
  };
}

export function ReinvoiceWindowScreen({
  permissions = [],
  approval,
}: {
  permissions?: readonly string[];
  approval?: ReinvoiceApprovalRequest;
}) {
  const [mode, setMode] = useState<ReinvoiceWindowChoice>("same_day");
  const [approved, setApproved] = useState(false);

  async function approve() {
    const response = await fetch(APPROVE_REINVOICE_PATH, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-id": ADMIN_SCOPE.sessionId,
      },
      body: JSON.stringify({ ...approval, windowMode: mode }),
    });
    const payload: unknown = await response.json();

    if (
      typeof payload === "object" &&
      payload !== null &&
      "outcome" in payload &&
      payload.outcome === "approved"
    ) {
      setApproved(true);
    }
  }

  return (
    <>
      <ReinvoiceWindowView
        mode={mode}
        permissions={permissions}
        onMode={setMode}
        onApprove={() => {
          void approve();
        }}
      />
      {approved ? <p role="status">Nota crédito aprobada.</p> : null}
    </>
  );
}
