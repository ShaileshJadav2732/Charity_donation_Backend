import mongoose, { Schema, Document } from "mongoose";

export interface IFeedback extends Document {
	donor: mongoose.Types.ObjectId;
	organization: mongoose.Types.ObjectId;
	campaign?: mongoose.Types.ObjectId;
	cause?: mongoose.Types.ObjectId;
	rating: number;
	comment: string;
	isPublic: boolean;
	status: "pending" | "approved" | "rejected";
	createdAt: Date;
	updatedAt: Date;
}

const FeedbackSchema: Schema = new Schema(
	{
		donor: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: [true, "Donor is required"],
		},
		organization: {
			type: Schema.Types.ObjectId,
			ref: "Organization",
			required: [true, "Organization is required"],
		},
		campaign: {
			type: Schema.Types.ObjectId,
			ref: "Campaign",
		},
		cause: {
			type: Schema.Types.ObjectId,
			ref: "Cause",
		},
		rating: {
			type: Number,
			required: [true, "Rating is required"],
			min: [1, "Rating must be at least 1"],
			max: [5, "Rating cannot be more than 5"],
		},
		comment: {
			type: String,
			required: [true, "Comment is required"],
			trim: true,
			minlength: [10, "Comment must be at least 10 characters long"],
			maxlength: [500, "Comment cannot exceed 500 characters"],
		},
		isPublic: {
			type: Boolean,
			default: true,
		},
		status: {
			type: String,
			enum: ["pending", "approved", "rejected"],
			default: "pending",
		},
	},
	{
		timestamps: true,
	}
);

// Indexes for better query performance
FeedbackSchema.index({ donor: 1, organization: 1 });
FeedbackSchema.index({ organization: 1, status: 1 });
FeedbackSchema.index({ campaign: 1, status: 1 });
FeedbackSchema.index({ cause: 1, status: 1 });
FeedbackSchema.index({ rating: -1 });
FeedbackSchema.index({ createdAt: -1 });

export default mongoose.model<IFeedback>("Feedback", FeedbackSchema);
