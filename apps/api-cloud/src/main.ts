import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { BlobFileStorage } from "@blackhole/platform/adapters/blob/blob-file-storage";
import { NodePublicKeyVerifier } from "@blackhole/platform/adapters/crypto/node-public-key-verifier";
import {
  DiskFileStorage,
  nodeDiskStorageClient,
} from "@blackhole/platform/adapters/disk/disk-file-storage";
import { GcsFileStorage } from "@blackhole/platform/adapters/gcs/gcs-file-storage";
import { InMemoryIdentityRepository } from "@blackhole/platform/adapters/memory/in-memory-identity-repository";
import { InMemoryOrganizationRepository } from "@blackhole/platform/adapters/memory/in-memory-organization-repository";
import { InMemoryPendingIssuance } from "@blackhole/platform/adapters/memory/in-memory-pending-issuance";
import { InMemoryProviderRateGate } from "@blackhole/platform/adapters/memory/in-memory-provider-rate-gate";
import { InMemoryVenueOperationRepository } from "@blackhole/platform/adapters/memory/in-memory-venue-operation-repository";
import { AwsRuntimeMetrics } from "@blackhole/platform/adapters/metrics-aws/aws-runtime-metrics";
import { AzureRuntimeMetrics } from "@blackhole/platform/adapters/metrics-azure/azure-runtime-metrics";
import { GcpRuntimeMetrics } from "@blackhole/platform/adapters/metrics-gcp/gcp-runtime-metrics";
import {
  consoleLogMetricsClient,
  LogRuntimeMetrics,
} from "@blackhole/platform/adapters/metrics-log/log-runtime-metrics";
import { S3FileStorage } from "@blackhole/platform/adapters/s3/s3-file-storage";
import { AwsSecrets } from "@blackhole/platform/adapters/secrets-aws/aws-secrets";
import { AzureSecrets } from "@blackhole/platform/adapters/secrets-azure/azure-secrets";
import {
  FileSecrets,
  nodeFileSecretsClient,
} from "@blackhole/platform/adapters/secrets-file/file-secrets";
import { GcpSecrets } from "@blackhole/platform/adapters/secrets-gcp/gcp-secrets";
import { Clock } from "@blackhole/platform/application/ports/clock";
import type { FileStorage } from "@blackhole/platform/application/ports/file-storage";
import { PasswordHasher } from "@blackhole/platform/application/ports/password-hasher";
import { PinHasher } from "@blackhole/platform/application/ports/pin-hasher";
import type { RuntimeMetrics } from "@blackhole/platform/application/ports/runtime-metrics";
import { SecondFactor } from "@blackhole/platform/application/ports/second-factor";
import type { Secrets } from "@blackhole/platform/application/ports/secrets";

import { authorizationDependencies } from "#src/authorization-access.js";
import { createApplication } from "#src/create-application.js";
import { FactusSimulator } from "#src/factus-simulator.js";

const scrypt = promisify(scryptCallback);
const fileStorageAdapters = ["s3", "gcs", "blob", "disk"] as const;
const secretsAdapters = ["aws", "gcp", "azure", "file"] as const;
const metricsAdapters = ["aws", "gcp", "azure", "log"] as const;

export interface ProcessInfrastructure {
  fileStorage: FileStorage;
  secrets: Secrets;
  metrics: RuntimeMetrics;
  port: number;
  databaseUrl: string;
}

class SystemClock extends Clock {
  override now(): number {
    return Date.now();
  }
}

class ScryptHasher extends PasswordHasher {
  override async hash(password: string): Promise<string> {
    return digest("scrypt", password);
  }
}

class ScryptPinHasher extends PinHasher {
  override async hash(pin: string): Promise<string> {
    return digest("pin", pin);
  }
}

class ScryptSecondFactor extends SecondFactor {
  override async enroll(code: string): Promise<string> {
    return digest("factor", code);
  }

  override async verify(code: string): Promise<string> {
    return digest("factor", code);
  }
}

const digest = async (label: string, value: string): Promise<string> => {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scrypt(value, salt, 32)) as Buffer;

  return `${label}:${salt}:${derived.toString("base64url")}`;
};

const requiredEnv = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
};

const oneOf = (
  name: string,
  value: string,
  allowed: readonly string[],
): void => {
  if (!allowed.includes(value)) {
    throw new Error(`${name} must be ${allowed.join(", ")}`);
  }
};

const closed = (adapter: string) => async (): Promise<never> => {
  throw new Error(`${adapter} client is not configured`);
};

const fileStorageFrom = (
  env: NodeJS.ProcessEnv,
  adapter: string,
): FileStorage => {
  switch (adapter) {
    case "disk":
      return new DiskFileStorage(
        nodeDiskStorageClient(env.FILE_STORAGE_ROOT ?? ".data/files"),
      );
    case "s3":
      return new S3FileStorage({
        putObject: closed("s3"),
        getSignedUrl: closed("s3"),
      });
    case "gcs":
      return new GcsFileStorage({
        save: closed("gcs"),
        getSignedUrl: closed("gcs"),
      });
    case "blob":
      return new BlobFileStorage({
        uploadBlockBlob: closed("blob"),
        generateSasUrl: closed("blob"),
      });
    default:
      throw new Error(
        `FILE_STORAGE_ADAPTER must be ${fileStorageAdapters.join(", ")}`,
      );
  }
};

const secretsFrom = (env: NodeJS.ProcessEnv, adapter: string): Secrets => {
  switch (adapter) {
    case "file":
      return new FileSecrets(
        nodeFileSecretsClient(env.SECRETS_FILE ?? ".data/secrets.json"),
      );
    case "aws":
      return new AwsSecrets({ getSecretValue: closed("aws") });
    case "gcp":
      return new GcpSecrets({ accessSecretVersion: closed("gcp") });
    case "azure":
      return new AzureSecrets({ getSecret: closed("azure") });
    default:
      throw new Error(`SECRETS_ADAPTER must be ${secretsAdapters.join(", ")}`);
  }
};

const metricsFrom = (adapter: string): RuntimeMetrics => {
  switch (adapter) {
    case "log":
      return new LogRuntimeMetrics(consoleLogMetricsClient());
    case "aws":
      return new AwsRuntimeMetrics({ putMetricData: closed("aws") });
    case "gcp":
      return new GcpRuntimeMetrics({ createTimeSeries: closed("gcp") });
    case "azure":
      return new AzureRuntimeMetrics({ trackMetric: closed("azure") });
    default:
      throw new Error(`METRICS_ADAPTER must be ${metricsAdapters.join(", ")}`);
  }
};

export const infrastructureFromEnv = (
  env: NodeJS.ProcessEnv,
): ProcessInfrastructure => {
  const fileStorageAdapter = requiredEnv(env, "FILE_STORAGE_ADAPTER");
  const secretsAdapter = requiredEnv(env, "SECRETS_ADAPTER");
  const metricsAdapter = requiredEnv(env, "METRICS_ADAPTER");
  const databaseUrl = requiredEnv(env, "DATABASE_URL");
  const port = Number(requiredEnv(env, "PORT"));

  oneOf("FILE_STORAGE_ADAPTER", fileStorageAdapter, fileStorageAdapters);
  oneOf("SECRETS_ADAPTER", secretsAdapter, secretsAdapters);
  oneOf("METRICS_ADAPTER", metricsAdapter, metricsAdapters);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT must be a positive integer");
  }

  return {
    fileStorage: fileStorageFrom(env, fileStorageAdapter),
    secrets: secretsFrom(env, secretsAdapter),
    metrics: metricsFrom(metricsAdapter),
    port,
    databaseUrl,
  };
};

export const startApi = async (
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> => {
  const runtime = infrastructureFromEnv(env);
  const identities = new InMemoryIdentityRepository();
  const clock = new SystemClock();
  const application = await createApplication({
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations: new InMemoryOrganizationRepository(),
    identities,
    passwords: new ScryptHasher(),
    pins: new ScryptPinHasher(),
    secondFactor: new ScryptSecondFactor(),
    clock,
    signatures: new NodePublicKeyVerifier(),
    ...authorizationDependencies(identities, clock),
    fileStorage: runtime.fileStorage,
    secrets: runtime.secrets,
    metrics: runtime.metrics,
    providerRate: new InMemoryProviderRateGate(),
    pendingIssuance: new InMemoryPendingIssuance(clock),
    factus: new FactusSimulator(),
  });

  await application.listen({ host: "0.0.0.0", port: runtime.port });
};

const entry = process.argv[1];

if (entry && pathToFileURL(path.resolve(entry)).href === import.meta.url) {
  await startApi();
}
