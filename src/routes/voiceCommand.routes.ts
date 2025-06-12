import express from "express";
import {
	processVoiceCommand,
	getVoiceCommandHelp,
	testVoiceCommand,
} from "../controllers/voiceCommand.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @route   POST /api/voice-commands/process
 * @desc    Process voice command for donation
 * @access  Private (authenticated users only)
 */
router.post("/process", processVoiceCommand);

/**
 * @route   GET /api/voice-commands/help
 * @desc    Get voice command examples and help
 * @access  Private (authenticated users only)
 */
router.get("/help", getVoiceCommandHelp);

/**
 * @route   POST /api/voice-commands/test
 * @desc    Test voice command parsing (development only)
 * @access  Private (authenticated users only)
 */
router.post("/test", testVoiceCommand);

export default router;
