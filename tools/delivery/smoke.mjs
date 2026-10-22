const baseUrl = process.env.SMOKE_BASE_URL;

if (!baseUrl) {
  console.error("SMOKE_BASE_URL is required");
  process.exit(1);
}

const health = await fetch(new URL("/health", baseUrl));
const healthBody = await health.json();

if (health.status !== 200 || healthBody.status !== "ok") {
  console.error(`GET /health failed: ${health.status}`);
  process.exit(1);
}

const writeId = crypto.randomUUID();
const write = await fetch(new URL("/venues/venue-smoke/writes", baseUrl), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ writeId, generation: 1 }),
});

if (write.status !== 200) {
  console.error(`AcceptCloudWrite failed: ${write.status}`);
  process.exit(1);
}

console.log("smoke passed");
