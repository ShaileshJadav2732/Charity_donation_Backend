import { Request, Response } from "express";
import Feedback from "../models/feedback.model";
import Organization from "../models/organization.model";

// Create new feedback
export const createFeedback = async (req: Request, res: Response) => {
	try {
		const { organizationId, campaignId, causeId, rating, comment, isPublic } =
			req.body;

		const feedback = await Feedback.create({
			donor: req.user!._id,
			organization: organizationId,
			campaign: campaignId,
			cause: causeId,
			rating,
			comment,
			isPublic,
		});

		// Send real-time notification to organization
		if ((req as any).notificationService && organizationId) {
			try {
				await (req as any).notificationService.createFeedbackNotification(
					organizationId,
					{
						feedbackId: feedback._id.toString(),
						senderName: (req.user as any)?.name || "Anonymous User",
						type: "received",
						subject: `${rating}-star feedback`,
					}
				);
			} catch (notificationError) {
				console.error(
					"Failed to send feedback notification:",
					notificationError
				);
			}
		}

		res.status(201).json({
			success: true,
			data: feedback,
		});
	} catch (error: any) {
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
};

// Get all feedback for an organization
export const getOrganizationFeedback = async (req: Request, res: Response) => {
	try {
		const { organizationId } = req.params;
		const { status, page = 1, limit = 10 } = req.query;

		let actualOrganizationId = organizationId;

		// If organizationId is "me" or matches the user ID, get the organization for the current user
		if (
			organizationId === "me" ||
			(req.user?.role === "organization" &&
				organizationId === req.user._id.toString())
		) {
			const organization = await Organization.findOne({ userId: req.user._id });
			if (!organization) {
				return res.status(404).json({
					success: false,
					error: "Organization profile not found for this user",
				});
			}
			actualOrganizationId = organization._id.toString();
		}

		// Build query - organizations can see all their feedback, others only see public
		const query: any = {
			organization: actualOrganizationId,
			...(status && { status }),
		};

		// Only add isPublic filter if user is not admin and not the organization owner
		if (req.user?.role !== "admin" && req.user?.role !== "organization") {
			query.isPublic = true;
		}

		console.log("Feedback Query Debug:", {
			originalOrganizationId: organizationId,
			actualOrganizationId,
			userRole: req.user?.role,
			userId: req.user?._id,
			query,
			status,
		});

		const feedback = await Feedback.find(query)
			.populate("donor", "firstName lastName name")
			.populate("cause", "title")
			.populate("campaign", "title")
			.sort({ createdAt: -1 })
			.skip((Number(page) - 1) * Number(limit))
			.limit(Number(limit));

		const total = await Feedback.countDocuments(query);

		console.log("Feedback Results:", {
			feedbackCount: feedback.length,
			total,
			sampleFeedback: feedback[0] || null,
		});

		res.status(200).json({
			success: true,
			data: feedback,
			pagination: {
				page: Number(page),
				limit: Number(limit),
				total,
				pages: Math.ceil(total / Number(limit)),
			},
		});
	} catch (error: any) {
		console.error("Get organization feedback error:", error);
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
};

// Get feedback statistics for an organization
export const getFeedbackStats = async (req: Request, res: Response) => {
	try {
		const { organizationId } = req.params;

		const stats = await Feedback.aggregate([
			{ $match: { organization: organizationId } },
			{
				$group: {
					_id: null,
					averageRating: { $avg: "$rating" },
					totalFeedback: { $sum: 1 },
					ratingDistribution: {
						$push: "$rating",
					},
				},
			},
			{
				$project: {
					_id: 0,
					averageRating: { $round: ["$averageRating", 1] },
					totalFeedback: 1,
					ratingDistribution: {
						1: {
							$size: {
								$filter: {
									input: "$ratingDistribution",
									cond: { $eq: ["$$this", 1] },
								},
							},
						},
						2: {
							$size: {
								$filter: {
									input: "$ratingDistribution",
									cond: { $eq: ["$$this", 2] },
								},
							},
						},
						3: {
							$size: {
								$filter: {
									input: "$ratingDistribution",
									cond: { $eq: ["$$this", 3] },
								},
							},
						},
						4: {
							$size: {
								$filter: {
									input: "$ratingDistribution",
									cond: { $eq: ["$$this", 4] },
								},
							},
						},
						5: {
							$size: {
								$filter: {
									input: "$ratingDistribution",
									cond: { $eq: ["$$this", 5] },
								},
							},
						},
					},
				},
			},
		]);

		res.status(200).json({
			success: true,
			data: stats[0] || {
				averageRating: 0,
				totalFeedback: 0,
				ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
			},
		});
	} catch (error: any) {
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
};

// Check if donor has already given feedback for organization/cause
export const checkFeedbackExists = async (req: Request, res: Response) => {
	try {
		const { organizationId, causeId, campaignId } = req.query;

		if (!organizationId) {
			return res.status(400).json({
				success: false,
				error: "Organization ID is required",
			});
		}

		const query: any = {
			donor: req.user!._id,
			organization: organizationId,
		};

		// Add optional filters
		if (causeId) query.cause = causeId;
		if (campaignId) query.campaign = campaignId;

		const existingFeedback = await Feedback.findOne(query);

		res.status(200).json({
			success: true,
			data: {
				exists: !!existingFeedback,
				feedback: existingFeedback || null,
			},
		});
	} catch (error: any) {
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
};

// Update feedback status (organizations and admin)
export const updateFeedbackStatus = async (req: Request, res: Response) => {
	try {
		const { feedbackId } = req.params;
		const { status } = req.body;

		// First find the feedback to check ownership
		const existingFeedback = await Feedback.findById(feedbackId);

		if (!existingFeedback) {
			return res.status(404).json({
				success: false,
				error: "Feedback not found",
			});
		}

		// Check if user is admin or the organization that received the feedback
		if (req.user?.role !== "admin") {
			if (req.user?.role === "organization") {
				// Find the organization document for this user
				const organization = await Organization.findOne({
					userId: req.user._id,
				});
				if (
					!organization ||
					existingFeedback.organization.toString() !==
						organization._id.toString()
				) {
					return res.status(403).json({
						success: false,
						error: "You can only update feedback for your own organization",
					});
				}
			} else {
				return res.status(403).json({
					success: false,
					error: "You can only update feedback for your own organization",
				});
			}
		}

		const feedback = await Feedback.findByIdAndUpdate(
			feedbackId,
			{ status },
			{ new: true }
		)
			.populate("donor", "firstName lastName name")
			.populate("cause", "title")
			.populate("campaign", "title");

		// TODO: Send notification to donor when notification system is implemented
		console.log(`Feedback ${feedbackId} status updated to ${status}`);

		res.status(200).json({
			success: true,
			data: feedback,
		});
	} catch (error: any) {
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
};
