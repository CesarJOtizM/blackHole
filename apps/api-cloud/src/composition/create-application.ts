import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";

import {
  ApplicationModule,
  type CloudApplicationDependencies,
} from "#src/composition/application-module.js";

export async function createApplication(
  dependencies: CloudApplicationDependencies,
): Promise<NestFastifyApplication> {
  const application = await NestFactory.create<NestFastifyApplication>(
    ApplicationModule.register(dependencies),
    new FastifyAdapter(),
  );

  await application.init();

  return application;
}
