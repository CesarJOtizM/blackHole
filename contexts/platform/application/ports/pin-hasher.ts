export abstract class PinHasher {
  abstract hash(pin: string): Promise<string>;
}
