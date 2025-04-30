import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import connectDB from "./config/db";
import roleRoutes from "./routes/role.routes";
import userRoutes from "./routes/user.routes";
dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// app.use("/api/users", userRoutes);

app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
