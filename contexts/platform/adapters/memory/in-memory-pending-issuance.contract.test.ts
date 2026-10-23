import { FakeClock } from "#adapters/memory/fast-identity-doubles.js";
import { InMemoryPendingIssuance } from "#adapters/memory/in-memory-pending-issuance.js";
import { pendingIssuanceContract } from "#application/ports/pending-issuance.contract.js";

pendingIssuanceContract(
  (now) => new InMemoryPendingIssuance(new FakeClock(now)),
);
