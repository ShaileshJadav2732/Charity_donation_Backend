import mongoose from "mongoose";

/**
 * Validates if the provided string is a valid MongoDB ObjectId
 * @param id The string to validate
 * @returns true if the string is a valid ObjectId, false otherwise
 */
export const validateObjectId = (id: string): boolean => {
	if (!id || typeof id !== 'string') {
		return false;
	}

	return mongoose.Types.ObjectId.isValid(id);
};
