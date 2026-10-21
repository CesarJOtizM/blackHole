import { OrganizationRepository } from "@blackhole/platform/application/ports/organization-repository";
import { VenueOperationRepository } from "@blackhole/platform/application/ports/venue-operation-repository";
import { type DynamicModule, Module } from "@nestjs/common";

import { AcceptCloudWriteController } from "#src/accept-cloud-write.controller.js";
import { UpdateStructureController } from "#src/update-structure.controller.js";

export interface CloudApplicationDependencies {
  venueOperations: VenueOperationRepository;
  organizations: OrganizationRepository;
}

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest module registration is static
export class ApplicationModule {
  static register(dependencies: CloudApplicationDependencies): DynamicModule {
    return {
      module: ApplicationModule,
      controllers: [AcceptCloudWriteController, UpdateStructureController],
      providers: [
        {
          provide: VenueOperationRepository,
          useValue: dependencies.venueOperations,
        },
        {
          provide: OrganizationRepository,
          useValue: dependencies.organizations,
        },
      ],
    };
  }
}
