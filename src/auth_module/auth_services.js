import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../../db/db.config.js";
import { createRefreshToken } from "./auth_utils.js";
import { UserStatus, NotificationType } from "@prisma/client";

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
      roles: { include: { role: true } },
      employee: {
        include: {
          designation: true,
          team: true,
          manager: {
            include: {
              user: true
            }
          }
        }
      }
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
    expiresIn: ACCESS_TOKEN_EXPIRY,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      roles,

      designation: user.employee?.designation?.name,
      team: user.employee?.team?.name,

      manager: user.employee?.manager?.user?.fullName
    }
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
  console.log(req.user, "logoutttt")
  const user = req.user
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
if (!user.passwordHash && user.isFirstLogin) {
  return ({
    requiresFirstLogin: true,
    userId: user.id
  })
}}

/* =========================
   ACTIVATE ACCOUNT
========================= */
export async function completeFirstLogin(token, newPassword) {

  let payload;
console.log("Incoming token:", token);
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    throw new Error("Invalid or expired link");
  }

  if (payload.type !== "FIRST_LOGIN") {
    throw new Error("Invalid token");
  }

  const userId = payload.sub;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      employee: {
        include: {
          team: true,
          manager: {
            include: {
              user: true
            }
          }
        }
      }
    }
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new Error("Account not approved yet");
  }

  if (!user.isFirstLogin) {
    throw new Error("First login already completed");
  }

  if (!newPassword || newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      isFirstLogin: false
    }
  });

   await createNotification({
    type: NotificationType.FIRST_LOGIN,
    title: "New Employee Onboarded",
    message: `${user.fullName} completed first login`,
    role: "ADMIN",
    metadata: {
      userId: user.id,
      employeeId: user.employee?.id,
      team: user.employee?.team?.name
    }
  });

  // 🔥 OPTIONAL: Notify Manager
  if (user.employee?.manager?.userId) {
    await createNotification({
      type: NotificationType.FIRST_LOGIN,
      title: "Team Member Activated",
      message: `${user.fullName} from your team is now active`,
      userId: user.employee.manager.userId
    });
  }

  return { success: true };
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

