import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { ingestRouter } from "./routes/ingest.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { automationRouter } from "./routes/automation.js";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Allow frontend to load resources
}));

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.some(allowed => origin.startsWith(allowed as string))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());

const PORT = process.env.PORT ?? 4000;

// Health
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "acquisition-os-backend" });
});

// API v1
app.use("/api/v1", ingestRouter);
app.use("/api/v1/webhooks", webhooksRouter);
app.use("/api/v1/automation", automationRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/admin", adminRouter);

app.listen(PORT, () => {
  console.log(`Acquisition OS backend listening on http://localhost:${PORT}`);
});
