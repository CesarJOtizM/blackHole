import { layer as applicationLayer } from "../application/index.js";

export const layer = "adapters" as const;

export const dependsOn = applicationLayer;
