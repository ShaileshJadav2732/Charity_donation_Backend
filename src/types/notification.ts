import { IUser } from "types";
export interface AuthUser extends IUser {
	id: string;
}

export interface AuthRequest extends Request {
	user?: AuthUser;
}
