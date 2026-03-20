import { Server } from "socket.io";

let io;

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:5174",
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    console.log(" User connected:", socket.id);

    //  JOIN ROOMS
    socket.on("join", ({ userId, role }) => {
      if (userId) {
        socket.join(`user-${userId}`);
      }

      if (role) {
        socket.join(role.toLowerCase()); // admin / manager / employee
      }

      console.log(`User joined rooms: user-${userId}, ${role}`);
    });

    socket.on("disconnect", () => {
      console.log(" User disconnected:", socket.id);
    });
  });
}

export function emitNotification(notification) {
  if (!io) return;

  console.log(" Emitting notification:", notification.type);

  if (notification.userId) {
    io.to(`user-${notification.userId}`).emit("notification", notification);
  } else if (notification.role) {
    io.to(notification.role.toLowerCase()).emit("notification", notification);
  } else {
    io.emit("notification", notification);
  }
}