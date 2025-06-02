import { Document } from "mongoose";

declare global {
	namespace Express {
		interface Request {
			user?: {
				_id: string;
				role: string;
				email: string;
			} & Document;
			cloudinaryUrl?: string;
			cloudinaryPublicId?: string;
		}
	}
}
