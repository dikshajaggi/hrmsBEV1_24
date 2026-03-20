// src/services/notification.service.js

import prisma from "../../db/db.config";
import { emitNotification } from "./socket";

export async function createNotification({
  type,
  title,
  message,
  userId = null,
  role = null,
  metadata = {}
}) {
  const notification = await prisma.notification.create({
    data: {
      type,
      title,
      message,
      userId,
      role,
      metadata
    }
  });

  // Emit via socket
  emitNotification(notification);

  return notification;
}