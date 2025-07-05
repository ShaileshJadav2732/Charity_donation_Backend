import mongoose, { Schema, Document } from "mongoose";

export interface IConversation extends Document {
	_id: string;
	participants: {
		user: mongoose.Types.ObjectId;
		lastReadAt?: Date;
		isTyping?: boolean;
	}[];
	lastMessage?: mongoose.Types.ObjectId;
	relatedDonation?: mongoose.Types.ObjectId;
	relatedCause?: mongoose.Types.ObjectId;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

const ConversationSchema: Schema<IConversation> = new Schema(
	{
		participants: [
			{
				user: {
					type: Schema.Types.ObjectId,
					ref: "User",
					required: true,
				},
				lastReadAt: {
					type: Date,
					default: Date.now,
				},
				isTyping: {
					type: Boolean,
					default: false,
				},
			},
		],
		lastMessage: {
			type: Schema.Types.ObjectId,
			ref: "Message",
		},
		relatedDonation: {
			type: Schema.Types.ObjectId,
			ref: "Donation",
		},
		relatedCause: {
			type: Schema.Types.ObjectId,
			ref: "Cause",
		},
		isActive: {
			type: Boolean,
			default: true,
			index: true,
		},
	},
	{
		timestamps: true,
	}
);

// Indexes for better query performance
ConversationSchema.index({ "participants.user": 1, isActive: 1 });
ConversationSchema.index({ updatedAt: -1 });
ConversationSchema.index({ relatedDonation: 1 });
ConversationSchema.index({ relatedCause: 1 });

ConversationSchema.index({
	"participants.user": 1,
	isActive: 1,
	updatedAt: -1,
});

// Virtual for populated participants
ConversationSchema.virtual("participantUsers", {
	ref: "User",
	localField: "participants.user",
	foreignField: "_id",
});

// Virtual for populated last message
ConversationSchema.virtual("lastMessageInfo", {
	ref: "Message",
	localField: "lastMessage",
	foreignField: "_id",
	justOne: true,
});

// Virtual for populated related donation
ConversationSchema.virtual("donationInfo", {
	ref: "Donation",
	localField: "relatedDonation",
	foreignField: "_id",
	justOne: true,
});

// Virtual for populated related cause
ConversationSchema.virtual("causeInfo", {
	ref: "Cause",
	localField: "relatedCause",
	foreignField: "_id",
	justOne: true,
});

// Method to check if user is participant
ConversationSchema.methods.isParticipant = function (userId: string) {
	return this.participants.some((p: any) => p.user.toString() === userId);
};

// Method to get other participant
ConversationSchema.methods.getOtherParticipant = function (userId: string) {
	return this.participants.find((p: any) => p.user.toString() !== userId);
};

// Method to update last read time for a user
ConversationSchema.methods.updateLastRead = function (userId: string) {
	const participant = this.participants.find(
		(p: any) => p.user.toString() === userId
	);
	if (participant) {
		participant.lastReadAt = new Date();
	}
	return this.save();
};

// Method to set typing status for a user
ConversationSchema.methods.setTypingStatus = function (
	userId: string,
	isTyping: boolean
) {
	const participant = this.participants.find(
		(p: any) => p.user.toString() === userId
	);
	if (participant) {
		participant.isTyping = isTyping;
	}
	return this.save();
};

// Static method to find conversation between two users
ConversationSchema.statics.findBetweenUsers = function (
	user1Id: string,
	user2Id: string
) {
	return this.findOne({
		isActive: true,
		"participants.user": { $all: [user1Id, user2Id] },
		$expr: { $eq: [{ $size: "$participants" }, 2] },
	});
};

// Ensure virtual fields are serialized
ConversationSchema.set("toJSON", { virtuals: true });
ConversationSchema.set("toObject", { virtuals: true });

export default mongoose.model<IConversation>(
	"Conversation",
	ConversationSchema
);
