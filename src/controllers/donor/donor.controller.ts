import { Request, Response } from "express";

export const getDonorData = (req: Request, res: Response) => {
  res.send("Hello Donor");
};
