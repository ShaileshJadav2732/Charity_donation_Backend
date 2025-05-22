import app from "./app";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Set port
const PORT = process.env.PORT || 8080;

// Start server
app.listen(PORT, () => {
	console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
