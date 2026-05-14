import express from "express";
import "./config/firebaseAdmin";

const app = express();
const port = Number(process.env.PORT) || 4000;

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
