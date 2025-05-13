import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.model";

export const authenticate = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const token = req.header("Authorization")?.replace("Bearer ", "");

		if (!token) {
			return res.status(401).json({ message: "Authentication required" });
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
			_id: string;
		};

		const user = await User.findById(decoded._id);

		if (!user) {
			return res.status(401).json({ message: "User not found" });
		}

		req.user = user;
		next();
	} catch (error) {
		res.status(401).json({ message: "Invalid authentication token" });
	}
};
