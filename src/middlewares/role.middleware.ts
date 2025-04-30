import { Request, Response, NextFunction } from "express";

export enum UserRole {
  ADMIN = "admin",
  DONOR = "donor",
  ORGANIZATION = "organization",
}

export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role as UserRole;

    if (!roles.includes(userRole)) {
      return res
        .status(403)
        .json({ message: "Access denied: Insufficient role" });
    }

    next();
  };
};
