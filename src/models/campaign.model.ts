// backend/models/campaign.model.ts
import mongoose, { Schema, Document } from "mongoose";
import { ICampaign } from '../types/interfaces';
import { CampaignStatus, CampaignType, CauseCategory } from '../types/enums';

export interface ICampaignUpdate extends Document {
	campaign: mongoose.Types.ObjectId;
	title: string;
	content: string;
	image?: string;
	createdAt: Date;
}

const CampaignUpdateSchema: Schema = new Schema(
	{
		campaign: {
			type: Schema.Types.ObjectId,
			ref: "Campaign",
			required: true,
		},
		title: {
			type: String,
			required: true,
			trim: true,
		},
		content: {
			type: String,
			required: true,
		},
		image: {
			type: String,
		},
	},
	{
		timestamps: true,
	}
);

const campaignSchema = new Schema<ICampaign>({
	organization: {
		type: Schema.Types.ObjectId,
		ref: 'User',
		required: [true, 'Organization is required']
	},
	title: {
		type: String,
		required: [true, 'Title is required'],
		trim: true
	},
	description: {
		type: String,
		required: [true, 'Description is required'],
		trim: true
	},
	type: {
		type: String,
		enum: Object.values(CampaignType),
		required: [true, 'Campaign type is required']
	},
	status: {
		type: String,
		enum: Object.values(CampaignStatus),
		default: CampaignStatus.DRAFT
	},
	category: {
		type: String,
		enum: Object.values(CauseCategory),
		required: [true, 'Category is required']
	},
	startDate: {
		type: Date,
		required: [true, 'Start date is required'],
		validate: {
			validator: function (this: ICampaign, value: Date) {
				return value >= new Date();
			},
			message: 'Start date must be in the future'
		}
	},
	endDate: {
		type: Date,
		validate: {
			validator: function (this: ICampaign, value: Date) {
				return !value || value > this.startDate;
			},
			message: 'End date must be after start date'
		}
	},
	targetAmount: {
		type: Number,
		min: [0, 'Target amount cannot be negative'],
		validate: {
			validator: function (this: ICampaign, value: number) {
				return this.type !== CampaignType.FUNDRAISING || value != null;
			},
			message: 'Target amount is required for fundraising campaigns'
		}
	},
	currentAmount: {
		type: Number,
		default: 0,
		min: [0, 'Current amount cannot be negative']
	},
	image: {
		type: String,
		trim: true
	},
	location: {
		type: {
			type: String,
			enum: ['Point'],
			default: 'Point'
		},
		coordinates: {
			type: [Number],
			required: [true, 'Coordinates are required for location'],
			validate: {
				validator: function (coords: number[]) {
					return coords.length === 2 &&
						coords[0] >= -180 && coords[0] <= 180 &&
						coords[1] >= -90 && coords[1] <= 90;
				},
				message: 'Invalid coordinates. Longitude must be between -180 and 180, latitude between -90 and 90'
			}
		}
	},
	requirements: [{
		type: String,
		trim: true
	}],
	updates: [{
		title: {
			type: String,
			required: [true, 'Update title is required'],
			trim: true
		},
		description: {
			type: String,
			required: [true, 'Update description is required'],
			trim: true
		},
		date: {
			type: Date,
			default: Date.now
		}
	}]
}, {
	timestamps: true
});

// Index for geospatial queries
campaignSchema.index({ location: '2dsphere' });

// Index for common queries
campaignSchema.index({ organization: 1, status: 1 });
campaignSchema.index({ type: 1, status: 1 });
campaignSchema.index({ category: 1, status: 1 });
campaignSchema.index({ startDate: 1, endDate: 1 });

// Validate that current amount doesn't exceed target amount for fundraising campaigns
campaignSchema.pre('save', function (next) {
	if (this.type === CampaignType.FUNDRAISING &&
		this.targetAmount != null &&
		this.currentAmount > this.targetAmount) {
		this.invalidate('currentAmount', 'Current amount cannot exceed target amount');
	}
	next();
});

CampaignUpdateSchema.index({ campaign: 1 });
CampaignUpdateSchema.index({ createdAt: -1 });

export const CampaignUpdate = mongoose.model<ICampaignUpdate>("CampaignUpdate", CampaignUpdateSchema);
export const Campaign = mongoose.model<ICampaign>('Campaign', campaignSchema);
