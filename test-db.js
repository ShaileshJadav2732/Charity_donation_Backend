const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/charity_donation_db';

// Define User schema
const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
    },
    role: {
      type: String,
      enum: ['donor', 'organization', 'admin'],
      default: 'donor',
      required: true,
    },
    profileCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Create User model
const User = mongoose.model('User', UserSchema);

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected successfully');
    return true;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    return false;
  }
}

// Test function to create a user
async function createTestUser() {
  try {
    // Create a test user
    const testUser = new User({
      email: 'test@example.com',
      firebaseUid: 'test-firebase-uid-' + Date.now(),
      role: 'donor',
      profileCompleted: false,
    });

    // Save the user to the database
    const savedUser = await testUser.save();
    console.log('Test user created successfully:', savedUser);
    return savedUser;
  } catch (error) {
    console.error('Error creating test user:', error);
    return null;
  }
}

// Main function
async function main() {
  // Connect to the database
  const connected = await connectDB();
  if (!connected) {
    console.error('Failed to connect to MongoDB');
    process.exit(1);
  }

  // Create a test user
  const user = await createTestUser();
  if (!user) {
    console.error('Failed to create test user');
    process.exit(1);
  }

  // Disconnect from the database
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

// Run the main function
main().catch(console.error);
