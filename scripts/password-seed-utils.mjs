import crypto from "crypto";

function isPlainPassword(value) {
  return typeof value === "string" && value.startsWith("plain:");
}

export function hashSeedPassword(value) {
  if (!isPlainPassword(value)) {
    return value;
  }

  const plain = value.slice("plain:".length);
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function normalizeSeedUser(user) {
  if (!user || typeof user !== "object") {
    return user;
  }

  return {
    ...user,
    password: hashSeedPassword(user.password)
  };
}
