const COLUMNS_BY_PAPER_MM = {
  80: 48,
  58: 32,
};

const DRAWER_PULSE = Uint8Array.of(0x1b, 0x70, 0x00, 0x19, 0xfa);

export function renderEscPos(job) {
  const columns = columnsFor(job.paperMm);
  const text = job.lines.flatMap((line) => wrapLine(line, columns)).join("\n");
  const textBytes = new TextEncoder().encode(text);

  if (job.kickDrawer !== true) {
    return textBytes;
  }

  const rendered = new Uint8Array(textBytes.length + DRAWER_PULSE.length);
  rendered.set(textBytes, 0);
  rendered.set(DRAWER_PULSE, textBytes.length);
  return rendered;
}

function columnsFor(paperMm) {
  if (!Object.hasOwn(COLUMNS_BY_PAPER_MM, paperMm)) {
    throw new Error("paperMm must be 80 or 58");
  }

  return COLUMNS_BY_PAPER_MM[paperMm];
}

function wrapLine(line, columns) {
  if (line.length === 0) {
    return [""];
  }

  const wrapped = [];

  for (let index = 0; index < line.length; index += columns) {
    wrapped.push(line.slice(index, index + columns));
  }

  return wrapped;
}
