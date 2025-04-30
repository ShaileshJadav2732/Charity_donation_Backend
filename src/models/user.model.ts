import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  username: string;
  password: string;
  role: "admin" | "org" | "user";
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "org", "user"],
      default: "user",
    },
  },
  {
    timestamps: true, 
  }
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;
