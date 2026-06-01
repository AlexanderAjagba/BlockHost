import express from "express";
import "./config/firebaseAdmin";
import meRouter from "./routes/me";

const app = express();
const port = Number(process.env.PORT) || 4000;
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", frontendOrigin);
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/me", meRouter);

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
