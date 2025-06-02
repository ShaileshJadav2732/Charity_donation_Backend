import mongoose, { Schema, Document } from 'mongoose';
import { IDonorProfile } from '../types';

const DonorProfileSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    profileImage: {
      type: String,
    },
    cloudinaryPublicId: {
      type: String,
    },
    coverImage: {
      type: String,
    },
    coverImageCloudinaryId: {
      type: String,
    },
    bio: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IDonorProfile & Document>('DonorProfile', DonorProfileSchema);
