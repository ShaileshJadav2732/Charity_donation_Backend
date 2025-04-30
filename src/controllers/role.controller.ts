import { Request, Response } from "express";

export const getAdminData = (req: Request, res: Response) => {
  res.send("Hello Admin");
};

export const getOrgData = (req: Request, res: Response) => {
  res.send("Hello Organization");
};
