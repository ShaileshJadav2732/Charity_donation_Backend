import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
	_id: string;
	conversationId: mongoose.Types.ObjectId;
	sender: mongoose.Types.ObjectId;
	recipient: mongoose.Types.ObjectId;
	content: string;
	messageType: 'text' | 'image' | 'file' | 'system';
	attachments?: {
		url: string;
		type: string;
		name: string;
		size: number;
		cloudinaryPublicId?: string;
	}[];
	isRead: boolean;
	readAt?: Date;
	editedAt?: Date;
	deletedAt?: Date;
	replyTo?: mongoose.Types.ObjectId; // ID of message being replied to
	createdAt: Date;
	updatedAt: Date;
}

const MessageSchema: Schema<IMessage> = new Schema(
	{
		conversationId: {
			type: Schema.Types.ObjectId,
			ref: 'Conversation',
			required: true,
			index: true,
		},
		sender: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			index: true,
		},
		recipient: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			index: true,
		},
		content: {
			type: String,
			required: true,
			trim: true,
			maxlength: 5000,
		},
		messageType: {
			type: String,
			enum: ['text', 'image', 'file', 'system'],
			default: 'text',
		},
		attachments: [{
			url: {
				type: String,
				required: true,
			},
			type: {
				type: String,
				required: true,
			},
			name: {
				type: String,
				required: true,
			},
			size: {
				type: Number,
				required: true,
			},
			cloudinaryPublicId: {
				type: String,
			},
		}],
		isRead: {
			type: Boolean,
			default: false,
			index: true,
		},
		readAt: {
			type: Date,
		},
		editedAt: {
			type: Date,
		},
		deletedAt: {
			type: Date,
		},
		replyTo: {
			type: Schema.Types.ObjectId,
			ref: 'Message',
		},
	},
	{
		timestamps: true,
	}
);

// Indexes for better query performance
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ sender: 1, createdAt: -1 });
MessageSchema.index({ recipient: 1, isRead: 1 });
MessageSchema.index({ conversationId: 1, isRead: 1 });

// Virtual for populated sender info
MessageSchema.virtual('senderInfo', {
	ref: 'User',
	localField: 'sender',
	foreignField: '_id',
	justOne: true,
});

// Virtual for populated recipient info
MessageSchema.virtual('recipientInfo', {
	ref: 'User',
	localField: 'recipient',
	foreignField: '_id',
	justOne: true,
});

// Ensure virtual fields are serialized
MessageSchema.set('toJSON', { virtuals: true });
MessageSchema.set('toObject', { virtuals: true });

export default mongoose.model<IMessage>('Message', MessageSchema);
