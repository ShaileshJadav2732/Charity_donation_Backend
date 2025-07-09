import { Socket } from "socket.io";
import mongoose, { Document } from "mongoose";
export interface AuthenticatedSocket extends Socket {
	userId?: string;
	userRole?: string;
}

export interface TypingData {
	conversationId: string;
	userId: string;
	userName: string;
	isTyping: boolean;
}

export interface AuthenticatedSocket extends Socket {
	userId?: string;
	userRole?: string;
}

export interface JwtPayload {
	id: string;
	role: string;
}
export interface IConversation extends Document {
	_id: string;
	participants: {
		user: mongoose.Types.ObjectId;
		lastReadAt?: Date;
		isTyping?: boolean;
	}[];
	lastMessage?: mongoose.Types.ObjectId;
	relatedDonation?: mongoose.Types.ObjectId;
	relatedCause?: mongoose.Types.ObjectId;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}
