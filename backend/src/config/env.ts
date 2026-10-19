
const portValue = process.env.PORT ?? "4000";
const parsedPort = Number(portValue);

if (
  !Number.isInteger(parsedPort) ||
  parsedPort < 1 ||
  parsedPort > 65535
) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

export const PORT = parsedPort;
