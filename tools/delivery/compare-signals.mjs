const numbers = (argv) => {
  const values = {};

  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];

    if (!name.startsWith("--") || name === "--self-check") {
      continue;
    }

    values[name.slice(2)] = Number(argv[index + 1]);
    index += 1;
  }

  return values;
};

export const worsened = ({
  previousError,
  currentError,
  previousP95,
  currentP95,
}) => {
  const samples = [previousError, currentError, previousP95, currentP95];

  if (samples.some((sample) => !Number.isFinite(sample))) {
    return true;
  }

  return currentError > previousError || currentP95 > previousP95;
};

const selfCheck = () => {
  const risingErrors = worsened({
    previousError: 0.01,
    currentError: 0.02,
    previousP95: 100,
    currentP95: 100,
  });
  const risingLatency = worsened({
    previousError: 0.01,
    currentError: 0.01,
    previousP95: 100,
    currentP95: 120,
  });
  const steady = worsened({
    previousError: 0.01,
    currentError: 0.01,
    previousP95: 100,
    currentP95: 100,
  });
  const missing = worsened({
    previousError: Number.NaN,
    currentError: 0,
    previousP95: 0,
    currentP95: 0,
  });

  if (!risingErrors || !risingLatency || steady || !missing) {
    console.error("self-check did not compare 5xx ratio and p95");
    process.exit(1);
  }
};

if (process.argv.includes("--self-check")) {
  selfCheck();
  console.log("5xx ratio and p95 comparison holds");
} else {
  const sample = numbers(process.argv.slice(2));
  const result = worsened({
    previousError: sample["previous-error"],
    currentError: sample["current-error"],
    previousP95: sample["previous-p95"],
    currentP95: sample["current-p95"],
  });

  console.log(`worsened=${result}`);
}
