import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;


export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  // 1️⃣ Token missing
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // 2️⃣ Verify token
    const payload = jwt.verify(token, JWT_SECRET);

    // 3️⃣ Attach identity
    req.user = {
      id: Number(payload.sub),
      roles: payload.roles
    };

    next();
  } catch (err) {
    // 4️⃣ Invalid / expired token
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
