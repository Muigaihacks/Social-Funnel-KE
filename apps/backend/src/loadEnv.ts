import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env");
// override: true — empty shell vars (e.g. JWT_SECRET=) must not block values from .env
dotenv.config({ path: envPath, override: true });
