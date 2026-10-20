import {
  type AcceptedCloudWrite,
  acceptCloudWriteCommand,
} from "@blackhole/contracts";
import {
  AcceptCloudWrite,
  StaleGeneration,
} from "@blackhole/platform/application/entry-port";
import { VenueOperationRepository } from "@blackhole/platform/application/ports/venue-operation-repository";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from "@nestjs/common";

@Controller("venues/:venueId")
export class AcceptCloudWriteController {
  constructor(
    @Inject(VenueOperationRepository)
    private readonly venueOperations: VenueOperationRepository,
  ) {}

  @Post("writes")
  @HttpCode(HttpStatus.OK)
  async accept(
    @Param("venueId") venueId: string,
    @Body() body: unknown,
  ): Promise<AcceptedCloudWrite> {
    const parsed = acceptCloudWriteCommand.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException();
    }

    const acceptCloudWrite = new AcceptCloudWrite(this.venueOperations);

    try {
      return await acceptCloudWrite.execute({
        venueId,
        writeId: parsed.data.writeId,
        generation: parsed.data.generation,
      });
    } catch (error: unknown) {
      if (error instanceof StaleGeneration) {
        throw new ConflictException({ error: "StaleGeneration" });
      }

      throw error;
    }
  }
}
