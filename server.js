import "dotenv/config"
import express from "express"
import cors from "cors";
import helmet from "helmet";
import router from "./routes.js";


const app = express()
const PORT = process.env.PORT || 5000


app.use(helmet({
  crossOriginResourcePolicy: false
}));

app.use(cors({
  origin: "http://localhost:5174", 
  credentials: true,              // allows cookies/auth headers if needed
}));

app.use(express.json())

app.use(router)

app.listen(PORT, () => console.log(`server is running on port ${PORT}`))