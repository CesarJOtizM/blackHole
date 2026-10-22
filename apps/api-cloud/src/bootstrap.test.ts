import {
  FakeClock,
  FastPasswordHasher,
  FastPinHasher,
  FastSecondFactor,
} from "@blackhole/platform/adapters/memory/fast-identity-doubles";
import { FastSignatureVerifier } from "@blackhole/platform/adapters/memory/fast-signature-verifier";
import { InMemoryIdentityRepository } from "@blackhole/platform/adapters/memory/in-memory-identity-repository";
import { InMemoryOrganizationRepository } from "@blackhole/platform/adapters/memory/in-memory-organization-repository";
import { InMemoryVenueOperationRepository } from "@blackhole/platform/adapters/memory/in-memory-venue-operation-repository";
import { AuthorizationClock } from "@blackhole/platform/application/ports/authorization-clock";
import { AuthorizationRepository } from "@blackhole/platform/application/ports/authorization-repository";
import { Clock } from "@blackhole/platform/application/ports/clock";
import { IdentityReader } from "@blackhole/platform/application/ports/identity-reader";
import { IdentityRepository } from "@blackhole/platform/application/ports/identity-repository";
import { OrganizationRepository } from "@blackhole/platform/application/ports/organization-repository";
import { PasswordHasher } from "@blackhole/platform/application/ports/password-hasher";
import { PinHasher } from "@blackhole/platform/application/ports/pin-hasher";
import { PinVerifier } from "@blackhole/platform/application/ports/pin-verifier";
import { SecondFactor } from "@blackhole/platform/application/ports/second-factor";
import { SessionReader } from "@blackhole/platform/application/ports/session-reader";
import { SignatureVerifier } from "@blackhole/platform/application/ports/signature-verifier";
import { VenueOperationRepository } from "@blackhole/platform/application/ports/venue-operation-repository";
import { expect, it } from "vitest";

import { authorizationDependencies } from "#src/authorization-access.js";
import { ApplicationModule } from "#src/application-module.js";
import { createApplication } from "#src/create-application.js";

it("given api-cloud, when it is created and closed, then no port is listening", async () => {
  const application = await createApplication(cloudDependencies());

  let listening = true;

  try {
    listening = application.getHttpAdapter().getInstance().server.listening;
  } finally {
    await application.close();
  }

  expect(listening).toBe(false);
});

it("given the created application, when its routes are listed, then there is no health route", async () => {
  const application = await createApplication(cloudDependencies());

  try {
    const routes = application.getHttpAdapter().getInstance().printRoutes();

    expect(routes).not.toMatch(/health/i);
  } finally {
    await application.close();
  }
});

it("given startup, when it is inspected, then there is no persistence dialect", async () => {
  const dependencies = cloudDependencies();
  const application = await createApplication(dependencies);

  try {
    const registered = ApplicationModule.register(dependencies);
    const repository = application.get(VenueOperationRepository);
    const organizationRepository = application.get(OrganizationRepository);
    const identityRepository = application.get(IdentityRepository);

    expect(registered.providers).toEqual([
      {
        provide: VenueOperationRepository,
        useValue: dependencies.venueOperations,
      },
      {
        provide: OrganizationRepository,
        useValue: dependencies.organizations,
      },
      {
        provide: IdentityRepository,
        useValue: dependencies.identities,
      },
      {
        provide: PasswordHasher,
        useValue: dependencies.passwords,
      },
      {
        provide: PinHasher,
        useValue: dependencies.pins,
      },
      {
        provide: SecondFactor,
        useValue: dependencies.secondFactor,
      },
      {
        provide: Clock,
        useValue: dependencies.clock,
      },
        {
          provide: SignatureVerifier,
          useValue: dependencies.signatures,
        },
        {
          provide: AuthorizationRepository,
          useValue: dependencies.authorizations,
        },
        {
          provide: SessionReader,
          useValue: dependencies.sessions,
        },
        {
          provide: IdentityReader,
          useValue: dependencies.identityViews,
        },
        {
          provide: PinVerifier,
          useValue: dependencies.pinConfirmations,
        },
        {
          provide: AuthorizationClock,
          useValue: dependencies.authorizationClock,
        },
      ]);
    expect(repository).toBe(dependencies.venueOperations);
    expect(repository).toBeInstanceOf(InMemoryVenueOperationRepository);
    expect(organizationRepository).toBe(dependencies.organizations);
    expect(organizationRepository).toBeInstanceOf(
      InMemoryOrganizationRepository,
    );
    expect(identityRepository).toBe(dependencies.identities);
    expect(identityRepository).toBeInstanceOf(InMemoryIdentityRepository);
  } finally {
    await application.close();
  }
});

function cloudDependencies() {
  const identities = new InMemoryIdentityRepository();
  const clock = new FakeClock(0);

  return {
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations: new InMemoryOrganizationRepository(),
    identities,
    passwords: new FastPasswordHasher(),
    pins: new FastPinHasher(),
    secondFactor: new FastSecondFactor(),
    clock,
    signatures: new FastSignatureVerifier(),
    ...authorizationDependencies(identities, clock),
  };
}
