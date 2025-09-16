import app from "./app";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import { setupSocketIO } from "./socket/socketHandler";

dotenv.config();

const PORT = process.env.PORT || 8080;

const server = createServer(app);

const io = new Server(server, {
	cors: {
		origin: process.env.FRONTEND_URL,
		credentials: true,
	},
	pingTimeout: 60000,
	pingInterval: 25000,
	connectTimeout: 45000,
	transports: ["websocket", "polling"],
	allowEIO3: true,
});

setupSocketIO(io);

app.set("io", io);

// Start server
server.listen(PORT, () => {
	console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
	console.log(`Socket.IO server initialized`);
});
