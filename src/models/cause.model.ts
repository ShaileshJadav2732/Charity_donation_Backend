import mongoose, { Schema } from 'mongoose';
import { ICause } from '../types/interfaces';
import { CauseCategory } from '../types/enums';

const causeSchema = new Schema<ICause>({
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
	category: {
		type: String,
		enum: Object.values(CauseCategory),
		required: [true, 'Category is required']
	},
	image: {
		type: String,
		trim: true
	},
	organization: {
		type: Schema.Types.ObjectId,
		ref: 'User',
		required: [true, 'Organization is required']
	},
	campaigns: [{
		type: Schema.Types.ObjectId,
		ref: 'Campaign'
	}],
	isActive: {
		type: Boolean,
		default: true
	}
}, {
	timestamps: true
});

// Index for common queries
causeSchema.index({ organization: 1, isActive: 1 });
causeSchema.index({ category: 1, isActive: 1 });
causeSchema.index({ title: 'text', description: 'text' });

// Validate that the organization exists and is an organization account
causeSchema.pre('save', async function (next) {
	try {
		const User = mongoose.model('User');
		const organization = await User.findById(this.organization);

		if (!organization) {
			this.invalidate('organization', 'Organization not found');
		}

		next();
	} catch (error) {
		next(error as Error);
	}
});

export const Cause = mongoose.model<ICause>('Cause', causeSchema);
