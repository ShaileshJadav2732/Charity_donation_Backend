import express from "express";
import { processVoiceCommand } from "../controllers/voiceCommand.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

router.use(authenticate);

router.post("/process", processVoiceCommand);

export default router;
