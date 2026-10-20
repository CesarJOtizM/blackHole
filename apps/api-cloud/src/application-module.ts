import { VenueOperationRepository } from "@blackhole/platform/application/ports/venue-operation-repository";
import { type DynamicModule, Module } from "@nestjs/common";

import { AcceptCloudWriteController } from "#src/accept-cloud-write.controller.js";

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest module registration is static
export class ApplicationModule {
  static register(venueOperations: VenueOperationRepository): DynamicModule {
    return {
      module: ApplicationModule,
      controllers: [AcceptCloudWriteController],
      providers: [
        {
          provide: VenueOperationRepository,
          useValue: venueOperations,
        },
      ],
    };
  }
}
