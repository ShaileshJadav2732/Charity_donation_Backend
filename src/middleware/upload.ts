import { Request, Response, NextFunction } from 'express';

// Simple middleware that just passes through
export const upload = {
   single: () => (req: Request, res: Response, next: NextFunction) => {
      // For now, we'll just pass through without handling files
      // This allows the application to run while we fix the dependency issues
      console.log('File upload temporarily disabled');
      next();
   }
};

// Simple error handler
export const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
   console.log('Upload error (temporarily disabled):', err?.message || 'Unknown error');
   // Always pass through for now
   next();
}; 