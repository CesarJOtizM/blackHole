export interface CardCapture {
  terminal: string;
  approvalNumber: string;
  brand: string;
  last4: string;
}

export abstract class CardTerminal {
  abstract capture(card: CardCapture): Promise<CardCapture>;
}
