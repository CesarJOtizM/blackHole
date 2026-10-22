import { DiskFileStorage } from "@blackhole/platform/adapters/disk/disk-file-storage";
import { LogRuntimeMetrics } from "@blackhole/platform/adapters/metrics-log/log-runtime-metrics";
import { S3FileStorage } from "@blackhole/platform/adapters/s3/s3-file-storage";
import { AwsSecrets } from "@blackhole/platform/adapters/secrets-aws/aws-secrets";
import { FileSecrets } from "@blackhole/platform/adapters/secrets-file/file-secrets";
import { expect, it } from "vitest";

import { infrastructureFromEnv } from "#src/main.js";

const databaseUrl = "postgres://blackhole:blackhole@postgres:5432/blackhole";

it("given disk, file, and log, when the process config is read, then those adapters, the port, and the database url are selected", () => {
  const runtime = infrastructureFromEnv({
    FILE_STORAGE_ADAPTER: "disk",
    SECRETS_ADAPTER: "file",
    METRICS_ADAPTER: "log",
    PORT: "4310",
    DATABASE_URL: databaseUrl,
  });

  expect(runtime.fileStorage).toBeInstanceOf(DiskFileStorage);
  expect(runtime.secrets).toBeInstanceOf(FileSecrets);
  expect(runtime.metrics).toBeInstanceOf(LogRuntimeMetrics);
  expect(runtime.port).toBe(4310);
  expect(runtime.databaseUrl).toBe(databaseUrl);
});

it("given s3 and aws, when the process config is read, then the cloud adapters are selected", () => {
  const runtime = infrastructureFromEnv({
    FILE_STORAGE_ADAPTER: "s3",
    SECRETS_ADAPTER: "aws",
    METRICS_ADAPTER: "aws",
    PORT: "8080",
    DATABASE_URL: databaseUrl,
  });

  expect(runtime.fileStorage).toBeInstanceOf(S3FileStorage);
  expect(runtime.secrets).toBeInstanceOf(AwsSecrets);
  expect(runtime.port).toBe(8080);
});

it("given a missing database url, when the process config is read, then startup is refused", () => {
  expect(() =>
    infrastructureFromEnv({
      FILE_STORAGE_ADAPTER: "disk",
      SECRETS_ADAPTER: "file",
      METRICS_ADAPTER: "log",
      PORT: "4310",
    }),
  ).toThrow(/DATABASE_URL is required/);
});
