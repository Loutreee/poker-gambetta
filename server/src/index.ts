import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { ledgerRouter } from "./routes/ledger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors({
  origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/ledger", ledgerRouter);

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
