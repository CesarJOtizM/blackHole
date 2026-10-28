import {
  CorrectClockEntry,
  CorrectionReasonRequired,
  UnknownClockEntry,
} from "@blackhole/attendance/application/correct-clock-entry";
import { PlatformAttendanceAudit } from "@blackhole/attendance/application/correct-clock-entry/platform-attendance-audit";
import {
  AttendanceExportDenied,
  ExportHours,
} from "@blackhole/attendance/application/export-hours";
import { AttendancePolicyRepository } from "@blackhole/attendance/application/ports/attendance-policy-repository";
import { ClockEntryCorrectionRepository } from "@blackhole/attendance/application/ports/clock-entry-correction-repository";
import { ClockEntryRepository } from "@blackhole/attendance/application/ports/clock-entry-repository";
import { HoursWorkbook } from "@blackhole/attendance/application/ports/hours-workbook";
import {
  PinCheckRejected,
  PlatformPinCheck,
} from "@blackhole/attendance/application/ports/pin-check";
import {
  AttendanceReadDenied,
  ReadAttendance,
} from "@blackhole/attendance/application/read-attendance";
import {
  CommandIdTaken,
  RecordClockEntry,
} from "@blackhole/attendance/application/record-clock-entry";
import {
  InvalidAttendancePolicy,
  SetVenueAttendancePolicy,
} from "@blackhole/attendance/application/set-venue-attendance-policy";
import {
  SecondClockIn,
  ShiftTransitionRejected,
} from "@blackhole/attendance/domain";
import {
  type AttendanceRead,
  attendancePolicyBody,
  attendanceRead,
  type ClockEntryRecorded,
  clockEntryRecorded,
  correctClockEntryBody,
  exportHoursBody,
  recordClockEntryBody,
} from "@blackhole/contracts";
import { RecordAuditEvent } from "@blackhole/platform/application/entry-port";
import { AuditDigest } from "@blackhole/platform/application/ports/audit-digest";
import { AuditRepository } from "@blackhole/platform/application/ports/audit-repository";
import { AuthorizationClock } from "@blackhole/platform/application/ports/authorization-clock";
import { AuthorizationRepository } from "@blackhole/platform/application/ports/authorization-repository";
import { Clock } from "@blackhole/platform/application/ports/clock";
import { IdentityReader } from "@blackhole/platform/application/ports/identity-reader";
import { IdentityRepository } from "@blackhole/platform/application/ports/identity-repository";
import { OrganizationRepository } from "@blackhole/platform/application/ports/organization-repository";
import {
  PinConfirmationLocked,
  PinConfirmationRejected,
  PinVerifier,
} from "@blackhole/platform/application/ports/pin-verifier";
import { SessionReader } from "@blackhole/platform/application/ports/session-reader";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Put,
  StreamableFile,
} from "@nestjs/common";

import {
  AttendanceCorrectDenied,
  assertPinDevice,
  ClockRejected,
  cashRegisterIdFor,
  PlatformAttendanceClock,
  permissionEvaluator,
  SessionAttendanceAccess,
} from "#src/composition/attendance-access.js";

const SESSION_HEADER = "x-session-id";

export const routePermissions = {
  "POST clock-entries": "pin",
  "POST clock-entries/:entryId/corrections": "attendance.correct",
  "PUT attendance/policy": "attendance.correct",
  "POST attendance/export": "attendance.correct",
} as const;

const DOMAIN_REJECTION = [
  SecondClockIn,
  ShiftTransitionRejected,
  InvalidAttendancePolicy,
  CorrectionReasonRequired,
  UnknownClockEntry,
  CommandIdTaken,
] as const;

const CLOCK_REJECTION = [
  ClockRejected,
  PinCheckRejected,
  PinConfirmationRejected,
  PinConfirmationLocked,
] as const;

@Controller("tenants/:tenantId/venues/:venueId")
export class AttendanceController {
  constructor(
    @Inject(Clock)
    private readonly clock: Clock,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(IdentityRepository)
    private readonly identities: IdentityRepository,
    @Inject(IdentityReader)
    private readonly identityViews: IdentityReader,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
    @Inject(AuthorizationClock)
    private readonly authorizationClock: AuthorizationClock,
    @Inject(OrganizationRepository)
    private readonly organizations: OrganizationRepository,
    @Inject(PinVerifier)
    private readonly pins: PinVerifier,
    @Inject(AuditRepository)
    private readonly audits: AuditRepository,
    @Inject(AuditDigest)
    private readonly digests: AuditDigest,
    @Inject(ClockEntryRepository)
    private readonly entries: ClockEntryRepository,
    @Inject(ClockEntryCorrectionRepository)
    private readonly corrections: ClockEntryCorrectionRepository,
    @Inject(AttendancePolicyRepository)
    private readonly policies: AttendancePolicyRepository,
    @Inject(HoursWorkbook)
    private readonly workbook: HoursWorkbook,
  ) {}

  @Post("clock-entries")
  @HttpCode(HttpStatus.OK)
  async clockIn(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<ClockEntryRecorded> {
    const session = await this.session(tenantId, sessionHeader);
    const parsed = recordClockEntryBody.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException();
    }

    try {
      await assertPinDevice(this.identities, tenantId, venueId, session);
      const recorded = await new RecordClockEntry(
        new PlatformAttendanceClock(this.clock),
        new PlatformPinCheck(this.pins),
        this.entries,
        this.policies,
      ).execute({
        tenantId,
        venueId,
        userId: session.userId,
        deviceId: session.deviceId,
        sessionId: session.sessionId,
        pin: parsed.data.pin,
        kind: parsed.data.kind,
        coordinates: parsed.data.coordinates,
        commandId: parsed.data.commandId,
        cashRegisterId: await cashRegisterIdFor(
          this.authorizations,
          this.organizations,
          tenantId,
          session.userId,
          venueId,
          this.clock.now(),
        ),
      });

      return clockEntryRecorded.parse({
        id: recorded.entry.id,
        kind: recorded.entry.kind,
        presence: recorded.entry.presence,
        occurredAt: recorded.entry.occurredAt,
        cashRegisterId: recorded.entry.cashRegisterId,
      });
    } catch (error: unknown) {
      this.rethrow(error);
    }
  }

  @Post("clock-entries/:entryId/corrections")
  @HttpCode(HttpStatus.OK)
  async correct(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("entryId") entryId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<{ entryId: string }> {
    const session = await this.session(tenantId, sessionHeader);
    const parsed = correctClockEntryBody.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException();
    }

    const decision = await this.permit(tenantId, session.sessionId, venueId);

    try {
      await new CorrectClockEntry(
        this.entries,
        this.corrections,
        new PlatformAttendanceAudit(
          new RecordAuditEvent(this.audits, this.digests, this.clock),
        ),
      ).execute({
        tenantId,
        venueId,
        userId: parsed.data.userId,
        actorId: session.userId,
        authorizerId: decision.selfAuthorized ? session.userId : null,
        deviceId: session.deviceId,
        entryId,
        occurredAt: parsed.data.occurredAt,
        reason: parsed.data.reason,
      });

      return { entryId };
    } catch (error: unknown) {
      this.rethrow(error);
    }
  }

  @Put("attendance/policy")
  @HttpCode(HttpStatus.OK)
  async setPolicy(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const session = await this.session(tenantId, sessionHeader);
    const parsed = attendancePolicyBody.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException();
    }

    const decision = await this.permit(tenantId, session.sessionId, venueId);
    const command = {
      tenantId,
      venueId,
      actorId: session.userId,
      authorizerId: decision.selfAuthorized ? session.userId : null,
      deviceId: session.deviceId,
      ...parsed.data,
    };

    try {
      return await new SetVenueAttendancePolicy(
        this.policies,
        new PlatformAttendanceAudit(
          new RecordAuditEvent(this.audits, this.digests, this.clock),
        ),
      ).execute(command);
    } catch (error: unknown) {
      this.rethrow(error);
    }
  }

  @Get("attendance")
  async read(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
  ): Promise<AttendanceRead> {
    const session = await this.session(tenantId, sessionHeader);

    await this.permit(tenantId, session.sessionId, venueId);

    try {
      return attendanceRead.parse(
        await new ReadAttendance(
          this.entries,
          this.corrections,
          this.policies,
          this.access(session.sessionId),
        ).execute({
          tenantId,
          venueId,
          actorId: session.userId,
        }),
      );
    } catch (error: unknown) {
      this.rethrow(error);
    }
  }

  @Post("attendance/export")
  @HttpCode(HttpStatus.OK)
  async exportHours(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<StreamableFile> {
    const session = await this.session(tenantId, sessionHeader);
    const parsed = exportHoursBody.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException();
    }

    await this.permit(tenantId, session.sessionId, venueId);

    try {
      const bytes = await new ExportHours(
        this.entries,
        this.corrections,
        this.policies,
        this.access(session.sessionId),
        this.workbook,
      ).execute({
        tenantId,
        venueId,
        actorId: session.userId,
        from: parsed.data.from,
        to: parsed.data.to,
      });

      return new StreamableFile(Buffer.from(bytes), {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    } catch (error: unknown) {
      this.rethrow(error);
    }
  }

  private access(sessionId: string): SessionAttendanceAccess {
    return new SessionAttendanceAccess(
      sessionId,
      this.sessions,
      this.organizations,
      permissionEvaluator(
        this.authorizations,
        this.sessions,
        this.identityViews,
        this.authorizationClock,
      ),
    );
  }

  private async permit(tenantId: string, sessionId: string, venueId: string) {
    const session = await this.sessions.find(tenantId, sessionId);
    const allowed = session
      ? await this.access(sessionId).allow({
          tenantId,
          actorId: session.userId,
          venueId,
          permission: "attendance.correct",
        })
      : false;

    if (!session || !allowed) {
      throw new ForbiddenException({ error: "AttendanceCorrectDenied" });
    }

    return { selfAuthorized: false as const };
  }

  private async session(tenantId: string, sessionHeader: unknown) {
    const sessionId = readText(sessionHeader);

    if (sessionId === null) {
      throw new BadRequestException();
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new ForbiddenException({ error: "UnknownSession" });
    }

    return session;
  }

  private rethrow(error: unknown): never {
    const conflict = rejectionName(error, DOMAIN_REJECTION);

    if (conflict !== null) {
      throw new ConflictException({ error: conflict });
    }

    if (
      error instanceof AttendanceReadDenied ||
      error instanceof AttendanceExportDenied ||
      error instanceof AttendanceCorrectDenied
    ) {
      throw new ForbiddenException({ error: "AttendanceCorrectDenied" });
    }

    const forbidden = rejectionName(error, CLOCK_REJECTION);

    if (forbidden !== null) {
      throw new ForbiddenException({ error: forbidden });
    }

    throw error;
  }
}

function readText(header: unknown): string | null {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
}

function rejectionName(
  error: unknown,
  rejections: readonly (new (...args: never[]) => Error)[],
): string | null {
  for (const Rejection of rejections) {
    if (error instanceof Rejection) {
      return error.name;
    }
  }

  return null;
}
