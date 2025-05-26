import { Request, Response } from "express";
import Feedback from "../models/feedback.model";

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

		const query = {
			organization: organizationId,
			...(status && { status }),
			...(req.user?.role !== "admin" && { isPublic: true }),
		};

		const feedback = await Feedback.find(query)
			.populate("donor", "firstName lastName")
			.sort({ createdAt: -1 })
			.skip((Number(page) - 1) * Number(limit))
			.limit(Number(limit));

		const total = await Feedback.countDocuments(query);

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

// Update feedback status (admin only)
export const updateFeedbackStatus = async (req: Request, res: Response) => {
	try {
		const { feedbackId } = req.params;
		const { status } = req.body;

		const feedback = await Feedback.findByIdAndUpdate(
			feedbackId,
			{ status },
			{ new: true }
		);

		if (!feedback) {
			return res.status(404).json({
				success: false,
				error: "Feedback not found",
			});
		}

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
