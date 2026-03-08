import crypto from "crypto"
import prisma from "../../db/db.config.js";

export async function createRefreshToken(userId, res) {
  const rawToken = crypto.randomBytes(64).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
console.log(Object.keys(prisma), "keys");

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  });

  res.cookie("refreshToken", rawToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict"
  });

  return rawToken;
}
