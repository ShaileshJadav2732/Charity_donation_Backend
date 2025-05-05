import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Donor from '../models/donor.model';
import User from '../models/user.model';

// Get donor profile
export const getDonorProfile = async (req: AuthRequest, res: Response) => {
  try {
    const donor = await Donor.findOne({ user: req.user._id }).populate('user', 'username email displayName photoURL');

    if (!donor) {
      return res.status(404).json({ message: 'Donor profile not found' });
    }

    res.status(200).json(donor);
  } catch (error) {
    console.error('Get donor profile error:', error);
    res.status(500).json({ message: 'Failed to fetch donor profile' });
  }
};

// Complete donor profile
export const completeDonorProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { profilePhoto, fullAddress, phone, donationPreferences, availability } = req.body;

    // Validate required fields
    if (!profilePhoto || !fullAddress || !phone || !donationPreferences || !availability) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Find donor
    let donor = await Donor.findOne({ user: req.user._id });

    if (!donor) {
      // Create donor profile if not exists
      donor = await Donor.create({
        user: req.user._id,
        profilePhoto,
        fullAddress,
        phone,
        donationPreferences,
        availability,
        isProfileCompleted: true,
      });
    } else {
      // Update existing profile
      donor.profilePhoto = profilePhoto;
      donor.fullAddress = fullAddress;
      donor.phone = phone;
      donor.donationPreferences = donationPreferences;
      donor.availability = availability;
      donor.isProfileCompleted = true;
      await donor.save();
    }

    res.status(200).json({
      message: 'Donor profile completed successfully',
      donor,
    });
  } catch (error) {
    console.error('Complete donor profile error:', error);
    res.status(500).json({ message: 'Failed to complete donor profile' });
  }
};

// Update donor profile
export const updateDonorProfile = async (req: AuthRequest, res: Response) => {
  try {
    const updateData = req.body;

    // Find donor
    const donor = await Donor.findOne({ user: req.user._id });

    if (!donor) {
      return res.status(404).json({ message: 'Donor profile not found' });
    }

    // Update fields
    Object.keys(updateData).forEach((key) => {
      if (key !== 'user' && key !== '_id') {
        (donor as any)[key] = updateData[key];
      }
    });

    await donor.save();

    res.status(200).json({
      message: 'Donor profile updated successfully',
      donor,
    });
  } catch (error) {
    console.error('Update donor profile error:', error);
    res.status(500).json({ message: 'Failed to update donor profile' });
  }
};