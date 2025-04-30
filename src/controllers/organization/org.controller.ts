import { Request, Response } from "express";

export const getOrgData = (req: Request, res: Response) => {
  res.send("Hello Organization");
};
