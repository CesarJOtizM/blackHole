import { layer as domainLayer } from "#domain/index.js";

export const layer = "application" as const;

export const dependsOn = domainLayer;
