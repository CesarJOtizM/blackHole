import { InMemoryRuntimeMetrics } from "#adapters/memory/in-memory-runtime-metrics.js";
import { runtimeMetricsContract } from "#application/ports/runtime-metrics.contract.js";

runtimeMetricsContract(() => new InMemoryRuntimeMetrics());
