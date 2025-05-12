import mongoose, { Document, Schema } from "mongoose";

export interface ICampaign extends Document {
   title: string;
   description: string;
   startDate: Date;
   endDate: Date;
   status: "draft" | "active" | "completed" | "cancelled";
   causes: mongoose.Types.ObjectId[];  // References to causes
   organizations: mongoose.Types.ObjectId[];  // Multiple organizations can be involved
   totalTargetAmount: number;
   totalRaisedAmount: number;
   totalSupporters: number;
   imageUrl: string;
   tags: string[];
   createdAt: Date;
   updatedAt: Date;
}

const campaignSchema = new Schema<ICampaign>(
   {
      title: {
         type: String,
         required: [true, "Title is required"],
         trim: true,
      },
      description: {
         type: String,
         required: [true, "Description is required"],
         trim: true,
      },
      startDate: {
         type: Date,
         required: [true, "Start date is required"],
      },
      endDate: {
         type: Date,
         required: [true, "End date is required"],
      },
      status: {
         type: String,
         enum: ["draft", "active", "completed", "cancelled"],
         default: "draft",
      },
      causes: [{
         type: Schema.Types.ObjectId,
         ref: "Cause",
      }],
      organizations: [{
         type: Schema.Types.ObjectId,
         ref: "Organization",
      }],
      totalTargetAmount: {
         type: Number,
         required: [true, "Total target amount is required"],
         min: [0, "Total target amount cannot be negative"],
      },
      totalRaisedAmount: {
         type: Number,
         default: 0,
         min: [0, "Total raised amount cannot be negative"],
      },
      totalSupporters: {
         type: Number,
         default: 0,
         min: [0, "Total supporters cannot be negative"],
      },
      imageUrl: {
         type: String,
         required: [true, "Image URL is required"],
      },
      tags: [{
         type: String,
         trim: true,
      }],
   },
   {
      timestamps: true,
   }
);

// Indexes for better query performance
campaignSchema.index({ title: "text", description: "text" });
campaignSchema.index({ status: 1 });
campaignSchema.index({ startDate: 1, endDate: 1 });
campaignSchema.index({ organizations: 1 });
campaignSchema.index({ tags: 1 });

export default mongoose.model<ICampaign>("Campaign", campaignSchema); 