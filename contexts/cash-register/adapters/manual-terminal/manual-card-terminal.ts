import {
  type CardCapture,
  CardTerminal,
} from "#application/ports/card-terminal.js";

export class ManualCardTerminal extends CardTerminal {
  override async capture(card: CardCapture): Promise<CardCapture> {
    return {
      terminal: card.terminal,
      approvalNumber: card.approvalNumber,
      brand: card.brand,
      last4: card.last4,
    };
  }
}
