import dotenv from "dotenv";
import path from "path";
import app from "./app.js";
import { connectDB } from "./config/db.js";

const envPath = path.resolve(process.cwd(), "config", "config.env");
dotenv.config({ path: envPath });
console.log(`Loaded env from: ${envPath}`);
connectDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
