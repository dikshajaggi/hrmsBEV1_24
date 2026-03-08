import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../../db/db.config.js";
import { createRefreshToken } from "./auth_utils.js";
import { UserStatus } from "@prisma/client";

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRY = "240m";

/* =========================
   REGISTER (NO PASSWORD)
========================= */
export async function registerUser(data) {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: data.email }, { username: data.username }]
    }
  });

if (existingUser) {
  if (existingUser.status === UserStatus.REJECTED) {
    // 🔥 revive account
    return prisma.user.update({
      where: { id: existingUser.id },
      data: {
        fullName: data.fullName,
        status: UserStatus.PENDING_APPROVAL,
        isActive: false,
        isFirstLogin: true,
        passwordHash: null
      }
    });
  }

  if (existingUser.status !== UserStatus.REJECTED) {
    throw new Error("User already exists");
  }
}

  return prisma.user.create({
    data: {
      username: data.username,
      email: data.email,
      fullName: data.fullName,
      passwordHash: null,
      status: UserStatus.PENDING_APPROVAL,
      isActive: false,
      isFirstLogin: true
    }
  });
}

/* =========================
   LOGIN (ONLY ACTIVATED)
========================= */
export async function loginUser(data, res) {
  const user = await prisma.user.findUnique({
    where: { username: data.username },
    include: {
      roles: { include: { role: true } }
    }
  });

  if (!user) throw new Error("Invalid credentials");

  //  Must be activated
  if (!user.passwordHash && user.isFirstLogin) {
    return {
      requiresFirstLogin: true,
      userId: user.id
    };
  }

  if (!user.isActive || user.status !== UserStatus.ACTIVE) {
    throw new Error("Account not active");
  }

  const passwordValid = await bcrypt.compare(
    data.password,
    user.passwordHash
  );

  if (!passwordValid) throw new Error("Invalid credentials");

  const roles = user.roles.map(r => r.role.code);

  const accessToken = jwt.sign(
    { sub: user.id, roles },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  await createRefreshToken(user.id, res);

  return {
    accessToken,
    expiresIn: ACCESS_TOKEN_EXPIRY
  };
}

/* =========================
   REFRESH TOKEN
========================= */
export async function refreshToken(req, res) {
  const rawToken = req.cookies?.refreshToken;
  if (!rawToken) throw new Error("Refresh token missing");

  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const storedToken = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      revoked: false,
      expiresAt: { gt: new Date() }
    },
    include: {
      user: {
        include: {
          roles: { include: { role: true } }
        }
      }
    }
  });

  if (!storedToken) throw new Error("Invalid refresh token");

  // Rotate token
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revoked: true }
  });

  const roles = storedToken.user.roles.map(r => r.role.code);

  const newAccessToken = jwt.sign(
    { sub: storedToken.user.id, roles },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  await createRefreshToken(storedToken.user.id, res);

  return {
    accessToken: newAccessToken,
    expiresIn: ACCESS_TOKEN_EXPIRY
  };
}

/* =========================
   LOGOUT
========================= */
export async function logoutUser(req, res) {
  const rawToken = req.cookies?.refreshToken;

  if (rawToken) {
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    await prisma.refreshToken.updateMany({
      where: { tokenHash, revoked: false },
      data: { revoked: true }
    });
  }

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: "strict"
  });
}if (!user.passwordHash && user.isFirstLogin) {
  return {
    requiresFirstLogin: true,
    userId: user.id
  };
}

/* =========================
   ACTIVATE ACCOUNT
========================= */
export async function completeFirstLogin(userId, newPassword) {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new Error("User not found");
  }

  // 🔒 HARD BUSINESS RULES
  if (user.status === UserStatus.REJECTED) {
    throw new Error("Account has been rejected by HR");
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new Error("Account not approved yet");
  }

  if (!user.isFirstLogin) {
    throw new Error("First login already completed");
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      isFirstLogin: false
      // ❌ do NOT change isActive here
    }
  });
}


/* =========================
   CHANGE PASSWORD
========================= */
export async function changePassword(userId, oldPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user.passwordHash) {
    throw new Error("Account not activated");
  }

  const valid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!valid) throw new Error("Invalid password");

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  });

  // revoke all sessions
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { revoked: true }
  });
}

