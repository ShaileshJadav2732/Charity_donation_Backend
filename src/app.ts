import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import connectDB from "./config/db";
import roleRoutes from "./routes/role.routes";
import userRoutes from "./routes/user.routes";

import donorRoutes from "./routes/donor.routes";
import adminRoutes from "./routes/admin.routes";
import organizationRoutes from "./routes/organization.routes";


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

connectDB();
// app.use("/api/users", userRoutes);

app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);

app.use("/api/donor", donorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/org", organizationRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
