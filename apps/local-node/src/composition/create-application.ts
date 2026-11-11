import "reflect-metadata";

import type { RecipeCopyRepository } from "@blackhole/inventory/application/ports/recipe-copy-repository";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";

import {
  ApplicationModule,
  registerRecipeCopies,
} from "#src/composition/application-module.js";

export interface NodeApplicationDependencies {
  recipeCopies?: RecipeCopyRepository;
}

export async function createApplication(
  dependencies: NodeApplicationDependencies = {},
): Promise<NestFastifyApplication> {
  const root = dependencies.recipeCopies
    ? registerRecipeCopies(dependencies.recipeCopies)
    : ApplicationModule;
  const application = await NestFactory.create<NestFastifyApplication>(
    root,
    new FastifyAdapter(),
  );

  await application.init();

  return application;
}
