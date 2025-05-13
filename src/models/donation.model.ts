import mongoose, { Schema } from 'mongoose';
import { IDonation } from '../types/interfaces';
import { DonationType, DonationStatus, BloodType, ClothesCondition, FoodType } from '../types/enums';

const donationSchema = new Schema<IDonation>({
	organization: {
		type: Schema.Types.ObjectId,
		ref: 'User',
		required: [true, 'Organization is required']
	},
	type: {
		type: String,
		enum: Object.values(DonationType),
		required: [true, 'Donation type is required']
	},
	status: {
		type: String,
		enum: Object.values(DonationStatus),
		default: DonationStatus.PENDING
	},
	description: {
		type: String,
		required: [true, 'Description is required'],
		trim: true
	},
	amount: {
		type: Number,
		min: [0, 'Amount cannot be negative'],
		validate: {
			validator: function (this: IDonation, value: number) {
				return this.type !== DonationType.MONEY || value != null;
			},
			message: 'Amount is required for money donations'
		}
	},
	quantity: {
		type: Number,
		min: [0, 'Quantity cannot be negative']
	},
	unit: {
		type: String,
		trim: true
	},
	bloodType: {
		type: String,
		enum: Object.values(BloodType),
		validate: {
			validator: function (this: IDonation, value: BloodType) {
				return this.type !== DonationType.BLOOD || value != null;
			},
			message: 'Blood type is required for blood donations'
		}
	},
	lastDonationDate: {
		type: Date
	},
	healthConditions: [{
		type: String,
		trim: true
	}],
	clothesType: {
		type: String,
		trim: true,
		validate: {
			validator: function (this: IDonation, value: string) {
				return this.type !== DonationType.CLOTHES || value != null;
			},
			message: 'Clothes type is required for clothes donations'
		}
	},
	condition: {
		type: String,
		enum: Object.values(ClothesCondition),
		validate: {
			validator: function (this: IDonation, value: ClothesCondition) {
				return this.type !== DonationType.CLOTHES || value != null;
			},
			message: 'Condition is required for clothes donations'
		}
	},
	size: {
		type: String,
		trim: true
	},
	foodType: {
		type: String,
		enum: Object.values(FoodType),
		validate: {
			validator: function (this: IDonation, value: FoodType) {
				return this.type !== DonationType.FOOD || value != null;
			},
			message: 'Food type is required for food donations'
		}
	},
	expiryDate: {
		type: Date,
		validate: {
			validator: function (this: IDonation, value: Date) {
				return this.type !== DonationType.FOOD || value != null;
			},
			message: 'Expiry date is required for food donations'
		}
	},
	storageInstructions: {
		type: String,
		trim: true
	},
	dimensions: {
		type: String,
		trim: true
	},
	weight: {
		type: Number,
		min: [0, 'Weight cannot be negative']
	},
	scheduledDate: {
		type: Date
	},
	scheduledTime: {
		type: String,
		trim: true
	},
	isPickup: {
		type: Boolean,
		required: [true, 'Pickup preference is required']
	},
	pickupAddress: {
		street: {
			type: String,
			required: [true, 'Street address is required for pickup'],
			trim: true
		},
		city: {
			type: String,
			required: [true, 'City is required for pickup'],
			trim: true
		},
		state: {
			type: String,
			required: [true, 'State is required for pickup'],
			trim: true
		},
		zipCode: {
			type: String,
			required: [true, 'ZIP code is required for pickup'],
			trim: true
		},
		country: {
			type: String,
			required: [true, 'Country is required for pickup'],
			trim: true
		}
	},
	dropoffAddress: {
		street: {
			type: String,
			required: [true, 'Street address is required for dropoff'],
			trim: true
		},
		city: {
			type: String,
			required: [true, 'City is required for dropoff'],
			trim: true
		},
		state: {
			type: String,
			required: [true, 'State is required for dropoff'],
			trim: true
		},
		zipCode: {
			type: String,
			required: [true, 'ZIP code is required for dropoff'],
			trim: true
		},
		country: {
			type: String,
			required: [true, 'Country is required for dropoff'],
			trim: true
		}
	},
	contactPhone: {
		type: String,
		required: [true, 'Contact phone is required'],
		trim: true
	},
	contactEmail: {
		type: String,
		required: [true, 'Contact email is required'],
		trim: true,
		match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
	},
	notes: {
		type: String,
		trim: true
	}
}, {
	timestamps: true
});

// Validate that either pickup or dropoff address is provided based on isPickup
donationSchema.pre('validate', function (next) {
	if (this.isPickup && !this.pickupAddress) {
		this.invalidate('pickupAddress', 'Pickup address is required when isPickup is true');
	}
	if (!this.isPickup && !this.dropoffAddress) {
		this.invalidate('dropoffAddress', 'Dropoff address is required when isPickup is false');
	}
	next();
});

export const Donation = mongoose.model<IDonation>('Donation', donationSchema);
