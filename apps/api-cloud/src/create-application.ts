import "reflect-metadata";

import type { VenueOperationRepository } from "@blackhole/platform/application/ports/venue-operation-repository";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";

import { ApplicationModule } from "#src/application-module.js";

export async function createApplication(
  venueOperations: VenueOperationRepository,
): Promise<NestFastifyApplication> {
  const application = await NestFactory.create<NestFastifyApplication>(
    ApplicationModule.register(venueOperations),
    new FastifyAdapter(),
  );

  await application.init();

  return application;
}
