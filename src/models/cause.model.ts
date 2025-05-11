import mongoose, { Document, Schema } from "mongoose";

export interface ICause extends Document {
   title: string;
   description: string;
   category: string;
   targetAmount: number;
   raisedAmount: number;
   supporters: number;
   imageUrl: string;
   organizationId: mongoose.Types.ObjectId;
   status: "active" | "completed" | "draft";
   createdAt: Date;
   updatedAt: Date;
}

const causeSchema = new Schema<ICause>(
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
      category: {
         type: String,
         required: [true, "Category is required"],
         enum: ["education", "environment", "humanitarian"],
      },
      targetAmount: {
         type: Number,
         required: [true, "Target amount is required"],
         min: [0, "Target amount cannot be negative"],
      },
      raisedAmount: {
         type: Number,
         default: 0,
         min: [0, "Raised amount cannot be negative"],
      },
      supporters: {
         type: Number,
         default: 0,
         min: [0, "Supporters count cannot be negative"],
      },
      imageUrl: {
         type: String,
         required: [true, "Image URL is required"],
      },
      organizationId: {
         type: Schema.Types.ObjectId,
         ref: "Organization",
         required: [true, "Organization ID is required"],
      },
      status: {
         type: String,
         enum: ["active", "completed", "draft"],
         default: "draft",
      },
   },
   {
      timestamps: true,
   }
);

// Indexes for better query performance
causeSchema.index({ title: "text", description: "text" });
causeSchema.index({ category: 1 });
causeSchema.index({ organizationId: 1 });
causeSchema.index({ status: 1 });

export default mongoose.model<ICause>("Cause", causeSchema); 