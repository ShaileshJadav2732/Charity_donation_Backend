import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model";
import { UserRole } from "../types/enums";
import { AuthRequest, IUser } from "../types/interfaces";

// Extend Express Request type to include user
declare global {
   namespace Express {
      interface Request {
         user?: User;
      }
   }
}

// Protect routes
export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
   try {
      let token;

      // Get token from Authorization header
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer")) {
         token = authHeader.split(" ")[1];
      }

      if (!token) {
         return res.status(401).json({
            success: false,
            error: "Not authorized to access this route",
         });
      }

      try {
         // Verify token
         const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };

         // Get user from token
         const user = await User.findById(decoded.id).select("+password");

         if (!user) {
            return res.status(401).json({
               success: false,
               error: "User not found",
            });
         }

         // Add user to request object
         req.user = user as IUser;
         next();
      } catch (error) {
         return res.status(401).json({
            success: false,
            error: "Not authorized to access this route",
         });
      }
   } catch (error) {
      next(error);
   }
};

// Grant access to specific roles
export const authorize = (...roles: UserRole[]) => {
   return (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
         return res.status(401).json({
            success: false,
            error: "Not authorized to access this route",
         });
      }

      if (!roles.includes(req.user.role)) {
         return res.status(403).json({
            success: false,
            error: `User role ${req.user.role} is not authorized to access this route`,
         });
      }

      next();
   };
};

// Verify organization
export const verifyOrganization = async (req: AuthRequest, res: Response, next: NextFunction) => {
   try {
      if (!req.user) {
         return res.status(401).json({
            success: false,
            error: "Not authorized to access this route",
         });
      }

      if (req.user.role !== UserRole.ORGANIZATION) {
         return res.status(403).json({
            success: false,
            error: "Only organizations can access this route",
         });
      }

      if (!req.user.isVerified) {
         return res.status(403).json({
            success: false,
            error: "Organization account is not verified",
         });
      }

      next();
   } catch (error) {
      next(error);
   }
}; 