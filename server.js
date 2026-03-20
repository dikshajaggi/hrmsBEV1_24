import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import router from "./routes.js";
import http from "http"; 
import { initSocket } from "./src/notifications_module/socket.js"

const app = express();
const PORT = process.env.PORT || 5000;

//  Security
app.use(helmet({
  crossOriginResourcePolicy: false
}));

app.use(cors({
  origin: "http://localhost:5174",
  credentials: true,
}));

app.use(express.json());

// Routes
app.use(router);

//  HTTP SERVER (IMPORTANT)
const server = http.createServer(app);

//  INIT SOCKET
initSocket(server);

//  not using app.listen anymore
server.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
});