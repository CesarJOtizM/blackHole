import { InvalidCashAmount } from "#domain/cash-shift.js";

const PART_ID_PREFIX = "part_";

export class SplitImbalance extends Error {
  constructor() {
    super("The parts do not add up to the account.");
    this.name = "SplitImbalance";
  }
}

export class InvalidPartId extends Error {
  constructor() {
    super("A part identifier must use the part_ prefix.");
    this.name = "InvalidPartId";
  }
}

export interface SplitLine {
  lineId: string;
  amountCop: number;
  originTableId: string;
}

export interface AccountPart {
  id: string;
  amountCop: number;
  originTableId: string;
  paid: boolean;
  lines: readonly SplitLine[];
}

export interface PayableLine {
  id: string;
  amountCop: number;
  originTableId: string;
}

interface EqualSplit {
  accountCop: number;
  originTableId: string;
  partIds: readonly string[];
}

interface CreatePart {
  id: string;
  amountCop: number;
  originTableId: string;
}

interface CreateSplit {
  accountCop: number;
  parts: readonly CreatePart[];
}

interface AssignPart {
  id: string;
  lineIds: readonly string[];
}

interface AssignSplit {
  accountCop: number;
  lines: readonly PayableLine[];
  parts: readonly AssignPart[];
}

interface RecordedPart {
  id: string;
  amountCop: number;
  originTableId: string;
  paid: boolean;
  lines: SplitLine[];
}

function assertPartId(id: string): void {
  if (!id.startsWith(PART_ID_PREFIX) || id.length === PART_ID_PREFIX.length) {
    throw new InvalidPartId();
  }
}

function assertCop(amount: number): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new InvalidCashAmount();
  }
}

function assertHasParts(count: number): void {
  if (count < 1) {
    throw new SplitImbalance();
  }
}

function assertDistinctIds(ids: readonly string[]): void {
  if (new Set(ids).size !== ids.length) {
    throw new SplitImbalance();
  }
}

function sumCop(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}

function assertBalanced(accountCop: number, amounts: readonly number[]): void {
  if (sumCop(amounts) !== accountCop) {
    throw new SplitImbalance();
  }
}

function recordedPart(
  id: string,
  amountCop: number,
  originTableId: string,
  lines: readonly SplitLine[],
): RecordedPart {
  assertPartId(id);
  assertCop(amountCop);

  return {
    id,
    amountCop,
    originTableId,
    paid: false,
    lines: lines.map((line) => ({ ...line })),
  };
}

function equalAmounts(accountCop: number, partCount: number): number[] {
  const base = Math.floor(accountCop / partCount);
  const extra = accountCop % partCount;

  return Array.from({ length: partCount }, (_, index) =>
    index < extra ? base + 1 : base,
  );
}

function copiedLine(line: PayableLine): SplitLine {
  return {
    lineId: line.id,
    amountCop: line.amountCop,
    originTableId: line.originTableId,
  };
}

function lineById(lines: readonly PayableLine[]): Map<string, PayableLine> {
  const indexed = new Map<string, PayableLine>();

  for (const line of lines) {
    assertCop(line.amountCop);

    if (indexed.has(line.id)) {
      throw new SplitImbalance();
    }

    indexed.set(line.id, line);
  }

  return indexed;
}

function linesForPart(
  part: AssignPart,
  indexed: ReadonlyMap<string, PayableLine>,
  used: Set<string>,
): SplitLine[] {
  if (part.lineIds.length === 0) {
    throw new SplitImbalance();
  }

  return part.lineIds.map((lineId) => {
    const line = indexed.get(lineId);

    if (!line || used.has(lineId)) {
      throw new SplitImbalance();
    }

    used.add(lineId);

    return copiedLine(line);
  });
}

function assignedParts(input: AssignSplit): RecordedPart[] {
  const indexed = lineById(input.lines);
  const used = new Set<string>();
  const parts = input.parts.map((part) => {
    const lines = linesForPart(part, indexed, used);
    const originTableId = lines[0]?.originTableId;

    if (originTableId === undefined) {
      throw new SplitImbalance();
    }

    return recordedPart(
      part.id,
      sumCop(lines.map((line) => line.amountCop)),
      originTableId,
      lines,
    );
  });

  if (used.size !== indexed.size) {
    throw new SplitImbalance();
  }

  return parts;
}

export class AccountSplit {
  private readonly recordedParts: RecordedPart[];

  private constructor(parts: readonly RecordedPart[]) {
    this.recordedParts = parts.map((part) => ({
      ...part,
      lines: part.lines.map((line) => ({ ...line })),
    }));
  }

  private static accept(
    accountCop: number,
    parts: readonly RecordedPart[],
  ): AccountSplit {
    assertBalanced(
      accountCop,
      parts.map((part) => part.amountCop),
    );

    return new AccountSplit(parts);
  }

  static equal(input: EqualSplit): AccountSplit {
    assertCop(input.accountCop);
    assertHasParts(input.partIds.length);
    assertDistinctIds(input.partIds);

    const amounts = equalAmounts(input.accountCop, input.partIds.length);
    const parts = input.partIds.map((id, index) => {
      const amountCop = amounts[index];

      if (amountCop === undefined) {
        throw new SplitImbalance();
      }

      return recordedPart(id, amountCop, input.originTableId, []);
    });

    return AccountSplit.accept(input.accountCop, parts);
  }

  static create(input: CreateSplit): AccountSplit {
    assertCop(input.accountCop);
    assertHasParts(input.parts.length);
    assertDistinctIds(input.parts.map((part) => part.id));

    const parts = input.parts.map((part) =>
      recordedPart(part.id, part.amountCop, part.originTableId, []),
    );

    return AccountSplit.accept(input.accountCop, parts);
  }

  static assign(input: AssignSplit): AccountSplit {
    assertCop(input.accountCop);
    assertHasParts(input.parts.length);
    assertDistinctIds(input.parts.map((part) => part.id));

    return AccountSplit.accept(input.accountCop, assignedParts(input));
  }

  pay(partId: string): void {
    assertPartId(partId);

    const part = this.recordedParts.find(
      (candidate) => candidate.id === partId,
    );

    if (!part) {
      throw new InvalidPartId();
    }

    part.paid = true;
  }

  get open(): boolean {
    return this.recordedParts.some((candidate) => !candidate.paid);
  }

  get parts(): readonly AccountPart[] {
    return this.recordedParts.map((part) => ({
      id: part.id,
      amountCop: part.amountCop,
      originTableId: part.originTableId,
      paid: part.paid,
      lines: part.lines.map((line) => ({ ...line })),
    }));
  }
}
