export abstract class SecondFactor {
  abstract enroll(code: string): Promise<string>;

  abstract verify(code: string): Promise<string>;
}
