import { Document } from "mongoose";
import * as express from "express";

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

export { };
