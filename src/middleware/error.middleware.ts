import { Request, Response, NextFunction } from "express";

export const errorHandler = (
	err: Error,
	req: Request,
	res: Response,
	next: NextFunction
) => {
	console.error("Error:", err);

	if (err.name === "ValidationError") {
		return res.status(400).json({
			message: "Validation Error",
			error: err.message,
		});
	}

	if (err.name === "CastError") {
		return res.status(400).json({
			message: "Invalid ID format",
			error: err.message,
		});
	}

	if (err.name === "JsonWebTokenError") {
		return res.status(401).json({
			message: "Invalid token",
			error: err.message,
		});
	}

	res.status(500).json({
		message: "Server Error",
		error:
			process.env.NODE_ENV === "production"
				? "Internal server error"
				: err.message,
	});
};
