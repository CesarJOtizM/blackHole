import { InMemoryProviderRateGate } from "#adapters/memory/in-memory-provider-rate-gate.js";
import { providerRateGateContract } from "#application/ports/provider-rate-gate.contract.js";

providerRateGateContract(() => new InMemoryProviderRateGate());
