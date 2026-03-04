import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { ledgerRouter } from "./routes/ledger.js";
import { sessionRouter } from "./routes/session.js";

const app = express();
const PORT = process.env.PORT ?? 3000;

const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173,http://localhost:5174";
app.use(cors({
  origin: corsOrigin.includes(",") ? corsOrigin.split(",").map((o) => o.trim()) : corsOrigin,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/ledger", ledgerRouter);
app.use("/api/session", sessionRouter);

// En production : servir le front buildé
if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "..", "..", "dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
