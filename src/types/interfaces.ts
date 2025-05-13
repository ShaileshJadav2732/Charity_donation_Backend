import { Request } from 'express';
import { Document } from 'mongoose';
import {
   DonationType,
   DonationStatus,
   BloodType,
   ClothesCondition,
   FoodType,
   CampaignStatus,
   CampaignType,
   UserRole,
   CauseCategory
} from './enums';

export interface IUser extends Document {
   email: string;
   password: string;
   name: string;
   role: UserRole;
   organization?: string;
   phone?: string;
   address?: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
   };
   isVerified: boolean;
   comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IDonation extends Document {
   organization: IUser['_id'];
   type: DonationType;
   status: DonationStatus;
   description: string;
   amount?: number;
   quantity?: number;
   unit?: string;
   bloodType?: BloodType;
   lastDonationDate?: Date;
   healthConditions?: string[];
   clothesType?: string;
   condition?: ClothesCondition;
   size?: string;
   foodType?: FoodType;
   expiryDate?: Date;
   storageInstructions?: string;
   dimensions?: string;
   weight?: number;
   scheduledDate?: Date;
   scheduledTime?: string;
   isPickup: boolean;
   pickupAddress?: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
   };
   dropoffAddress?: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
   };
   contactPhone: string;
   contactEmail: string;
   notes?: string;
   createdAt: Date;
   updatedAt: Date;
}

export interface ICampaign extends Document {
   organization: IUser['_id'];
   title: string;
   description: string;
   type: CampaignType;
   status: CampaignStatus;
   category: CauseCategory;
   startDate: Date;
   endDate?: Date;
   targetAmount?: number;
   currentAmount: number;
   image?: string;
   location?: {
      type: string;
      coordinates: number[];
   };
   requirements?: string[];
   updates: {
      title: string;
      description: string;
      date: Date;
   }[];
   createdAt: Date;
   updatedAt: Date;
}

export interface ICause extends Document {
   title: string;
   description: string;
   category: CauseCategory;
   image?: string;
   organization: IUser['_id'];
   campaigns: ICampaign['_id'][];
   isActive: boolean;
   createdAt: Date;
   updatedAt: Date;
}

export interface AuthRequest extends Request {
   user?: IUser;
   file?: Express.Multer.File;
   params: {
      id?: string;
      [key: string]: string | undefined;
   };
   body: {
      title?: string;
      description?: string;
      category?: CauseCategory;
      [key: string]: any;
   };
}

export interface CloudinaryUploadResult {
   secure_url: string;
   public_id: string;
} 