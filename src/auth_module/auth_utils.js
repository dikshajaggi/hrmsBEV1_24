import crypto from "crypto"
import prisma from "../../db/db.config.js";
import jwt from "jsonwebtoken";


export const createRefreshToken = async(userId, res) => {
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


export const createFirstLoginToken = (userId) => {
  return jwt.sign(
    { sub: userId, type: "FIRST_LOGIN" },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );
}