export abstract class Secrets {
  abstract read(name: string): Promise<string>;
}
