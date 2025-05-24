import app from "./app";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import { setupSocketIO } from "./socket/socketHandler";

// Load environment variables
dotenv.config();

// Set port
const PORT = process.env.PORT || 8080;

// Create HTTP server
const server = createServer(app);

// Setup Socket.IO
const io = new Server(server, {
	cors: {
		origin: ["http://localhost:3000", "http://localhost:3001"],
		methods: ["GET", "POST"],
		credentials: true,
	},
});

// Setup socket handlers
setupSocketIO(io);

// Make io available globally
app.set("io", io);

// Start server
server.listen(PORT, () => {
	console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
	console.log(`Socket.IO server initialized`);
});
