import express from "express";
import { ingestRouter } from "./routes/ingest.js";
import { webhooksRouter } from "./routes/webhooks.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT ?? 4000;

// Health
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "acquisition-os-backend" });
});

// API v1
app.use("/api/v1", ingestRouter);
app.use("/api/v1/webhooks", webhooksRouter);

app.listen(PORT, () => {
  console.log(`Acquisition OS backend listening on http://localhost:${PORT}`);
});
