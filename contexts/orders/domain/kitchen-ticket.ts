import { ComboNotSent } from "#domain/check.js";

const ITEM_KIND = {
  COMBO: "combo",
} as const;

const DELETE = 127;
const UNIT_SEPARATOR = 31;

interface RenderTicket {
  stationName: string;
  tableId: string;
  productName: string;
  note?: string;
  kind?: string;
}

function plain(value: string): string {
  let text = "";

  for (const character of value) {
    const code = character.codePointAt(0);

    if (code === undefined || code <= UNIT_SEPARATOR || code === DELETE) {
      continue;
    }

    text += character;
  }

  return text;
}

export class KitchenTicket {
  readonly text: string;

  private constructor(text: string) {
    this.text = text;
  }

  static render(input: RenderTicket): KitchenTicket {
    if (input.kind === ITEM_KIND.COMBO) {
      throw new ComboNotSent();
    }

    const lines = [
      plain(input.stationName),
      plain(input.tableId),
      plain(input.productName),
    ];
    const note = input.note === undefined ? "" : plain(input.note);

    if (note !== "") {
      lines.push(note);
    }

    return new KitchenTicket(lines.join("\n"));
  }
}
