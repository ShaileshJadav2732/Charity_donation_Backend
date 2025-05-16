import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";
import mongoose from "mongoose";
import Donation from "../models/donation.model";
import { DonationStatus, DonationType } from "../models/donation.model";
import Cause from "../models/cause.model";
import Campaign from "../models/campaign.model";
import Feedback from "../models/feedback.model";
import { IUser } from "../types";

interface AuthRequest extends Request {
   user?: IUser;
}

// Get organization analytics overview
export const getOrganizationAnalyticsOverview = catchAsync(async (req: AuthRequest, res: Response) => {
   const organizationId = req.user?._id;

   if (!organizationId) {
      throw new AppError("Unauthorized: Authentication required", 401);
   }

   // Get total donations with monthly breakdown for last 12 months
   const today = new Date();
   const twelveMonthsAgo = new Date(today);
   twelveMonthsAgo.setMonth(today.getMonth() - 11);

   // Monthly donation trends for the past 12 months
   const monthlyDonations = await Donation.aggregate([
      {
         $match: {
            organization: new mongoose.Types.ObjectId(organizationId),
            type: DonationType.MONEY,
            createdAt: { $gte: twelveMonthsAgo },
            status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] }
         }
      },
      {
         $group: {
            _id: {
               year: { $year: "$createdAt" },
               month: { $month: "$createdAt" }
            },
            count: { $sum: 1 },
            total: { $sum: "$amount" }
         }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
   ]);

   // Fill in missing months with zero values
   const monthlyDonationTrends = fillMissingMonths(monthlyDonations, twelveMonthsAgo, today);

   // Get donation type distribution
   const donationTypeDistribution = await Donation.aggregate([
      {
         $match: {
            organization: new mongoose.Types.ObjectId(organizationId),
            status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] }
         }
      },
      {
         $group: {
            _id: "$type",
            count: { $sum: 1 },
            total: { $sum: { $ifNull: ["$amount", 0] } }
         }
      }
   ]);

   // Top performing causes by raised amount
   const topCauses = await Cause.find({ organizationId })
      .sort({ raisedAmount: -1 })
      .limit(5)
      .select('title targetAmount raisedAmount');

   // Donor retention metrics
   const donorRetention = await calculateDonorRetention(organizationId);

   // Average donation amount trend
   const avgDonationTrend = await Donation.aggregate([
      {
         $match: {
            organization: new mongoose.Types.ObjectId(organizationId),
            type: DonationType.MONEY,
            createdAt: { $gte: twelveMonthsAgo },
            status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] }
         }
      },
      {
         $group: {
            _id: {
               year: { $year: "$createdAt" },
               month: { $month: "$createdAt" }
            },
            avgAmount: { $avg: "$amount" }
         }
      },
      {
         $project: {
            _id: 0,
            year: "$_id.year",
            month: "$_id.month",
            avgAmount: { $round: ["$avgAmount", 2] }
         }
      },
      { $sort: { "year": 1, "month": 1 } }
   ]);

   // Current year vs previous year comparison
   const thisYear = new Date(today.getFullYear(), 0, 1);
   const lastYear = new Date(today.getFullYear() - 1, 0, 1);

   const [currentYearDonations, previousYearDonations] = await Promise.all([
      Donation.aggregate([
         {
            $match: {
               organization: new mongoose.Types.ObjectId(organizationId),
               type: DonationType.MONEY,
               createdAt: { $gte: thisYear },
               status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] }
            }
         },
         {
            $group: {
               _id: null,
               total: { $sum: "$amount" },
               count: { $sum: 1 }
            }
         }
      ]),
      Donation.aggregate([
         {
            $match: {
               organization: new mongoose.Types.ObjectId(organizationId),
               type: DonationType.MONEY,
               createdAt: { $gte: lastYear, $lt: thisYear },
               status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] }
            }
         },
         {
            $group: {
               _id: null,
               total: { $sum: "$amount" },
               count: { $sum: 1 }
            }
         }
      ])
   ]);

   // Calculate year-over-year growth
   const currentYearTotal = currentYearDonations[0]?.total || 0;
   const previousYearTotal = previousYearDonations[0]?.total || 0;
   const yoyGrowth = previousYearTotal === 0
      ? 100
      : ((currentYearTotal - previousYearTotal) / previousYearTotal) * 100;

   // Feedback sentiment analysis
   const feedbackAnalysis = await Feedback.aggregate([
      { $match: { organization: new mongoose.Types.ObjectId(organizationId) } },
      {
         $group: {
            _id: null,
            totalFeedback: { $sum: 1 },
            averageRating: { $avg: "$rating" },
            ratingDistribution: {
               $push: "$rating"
            }
         }
      },
      {
         $project: {
            _id: 0,
            totalFeedback: 1,
            averageRating: { $round: ["$averageRating", 1] },
            positiveRatings: {
               $size: {
                  $filter: {
                     input: "$ratingDistribution",
                     cond: { $gte: ["$$this", 4] }
                  }
               }
            },
            neutralRatings: {
               $size: {
                  $filter: {
                     input: "$ratingDistribution",
                     cond: { $eq: ["$$this", 3] }
                  }
               }
            },
            negativeRatings: {
               $size: {
                  $filter: {
                     input: "$ratingDistribution",
                     cond: { $lte: ["$$this", 2] }
                  }
               }
            }
         }
      }
   ]);

   // Map feedback analysis to sentiment percentages
   const feedbackSentiment = feedbackAnalysis.length > 0
      ? {
         totalFeedback: feedbackAnalysis[0].totalFeedback,
         averageRating: feedbackAnalysis[0].averageRating,
         sentiment: {
            positive: (feedbackAnalysis[0].positiveRatings / feedbackAnalysis[0].totalFeedback) * 100,
            neutral: (feedbackAnalysis[0].neutralRatings / feedbackAnalysis[0].totalFeedback) * 100,
            negative: (feedbackAnalysis[0].negativeRatings / feedbackAnalysis[0].totalFeedback) * 100
         }
      }
      : {
         totalFeedback: 0,
         averageRating: 0,
         sentiment: { positive: 0, neutral: 0, negative: 0 }
      };

   res.status(200).json({
      success: true,
      data: {
         monthlyDonationTrends,
         donationTypeDistribution,
         topCauses,
         donorRetention,
         avgDonationTrend,
         yearComparison: {
            currentYear: currentYearTotal,
            previousYear: previousYearTotal,
            yoyGrowth: Math.round(yoyGrowth * 100) / 100
         },
         feedbackSentiment
      }
   });
});

// Get detailed cause analytics
export const getCauseAnalytics = catchAsync(async (req: AuthRequest, res: Response) => {
   const { causeId } = req.params;
   const organizationId = req.user?._id;

   if (!organizationId) {
      throw new AppError("Unauthorized: Authentication required", 401);
   }

   // Validate causeId
   if (!mongoose.Types.ObjectId.isValid(causeId)) {
      throw new AppError("Invalid cause ID format", 400);
   }

   // Verify the cause belongs to the organization
   const cause = await Cause.findOne({
      _id: causeId,
      organizationId
   });

   if (!cause) {
      throw new AppError("Cause not found or not owned by this organization", 404);
   }

   // Get donation timeline for this cause
   const today = new Date();
   const sixMonthsAgo = new Date(today);
   sixMonthsAgo.setMonth(today.getMonth() - 5);

   const causeDonations = await Donation.aggregate([
      {
         $match: {
            cause: new mongoose.Types.ObjectId(causeId),
            createdAt: { $gte: sixMonthsAgo },
            status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] }
         }
      },
      {
         $group: {
            _id: {
               year: { $year: "$createdAt" },
               month: { $month: "$createdAt" }
            },
            count: { $sum: 1 },
            total: { $sum: "$amount" }
         }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
   ]);

   // Fill in missing months
   const monthlyDonations = fillMissingMonths(causeDonations, sixMonthsAgo, today);

   // Get donation type breakdown for this cause
   const donationTypeBreakdown = await Donation.aggregate([
      {
         $match: {
            cause: new mongoose.Types.ObjectId(causeId),
            status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] }
         }
      },
      {
         $group: {
            _id: "$type",
            count: { $sum: 1 },
            total: { $sum: { $ifNull: ["$amount", 0] } }
         }
      }
   ]);

   // Calculate funding progress
   const fundingProgress = {
      target: cause.targetAmount,
      raised: cause.raisedAmount,
      percentage: (cause.raisedAmount / cause.targetAmount) * 100
   };

   res.status(200).json({
      success: true,
      data: {
         causeDetails: {
            id: cause._id,
            title: cause.title,
            description: cause.description,
            targetAmount: cause.targetAmount,
            raisedAmount: cause.raisedAmount,
            imageUrl: cause.imageUrl,
            tags: cause.tags,
            createdAt: cause.createdAt
         },
         monthlyDonations,
         donationTypeBreakdown,
         fundingProgress
      }
   });
});

// Get donor analytics
export const getDonorAnalytics = catchAsync(async (req: AuthRequest, res: Response) => {
   const organizationId = req.user?._id;

   if (!organizationId) {
      throw new AppError("Unauthorized: Authentication required", 401);
   }

   // Get donor demographics
   const donorDemographics = await Donation.aggregate([
      {
         $match: {
            organization: new mongoose.Types.ObjectId(organizationId),
            status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] }
         }
      },
      {
         $group: {
            _id: "$donor",
            totalDonated: { $sum: { $ifNull: ["$amount", 0] } },
            donationCount: { $sum: 1 },
            firstDonation: { $min: "$createdAt" },
            lastDonation: { $max: "$createdAt" }
         }
      },
      {
         $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "donorInfo"
         }
      },
      { $unwind: "$donorInfo" },
      {
         $group: {
            _id: null,
            totalDonors: { $sum: 1 },
            newDonorsThisMonth: {
               $sum: {
                  $cond: [
                     {
                        $gte: [
                           "$firstDonation",
                           new Date(new Date().setDate(1)) // First day of current month
                        ]
                     },
                     1,
                     0
                  ]
               }
            },
            repeatDonors: {
               $sum: { $cond: [{ $gt: ["$donationCount", 1] }, 1, 0] }
            },
            totalDonated: { $sum: "$totalDonated" }
         }
      },
      {
         $project: {
            _id: 0,
            totalDonors: 1,
            newDonorsThisMonth: 1,
            repeatDonors: 1,
            repeatDonorPercentage: {
               $round: [{ $multiply: [{ $divide: ["$repeatDonors", "$totalDonors"] }, 100] }, 1]
            },
            averageDonationPerDonor: {
               $round: [{ $divide: ["$totalDonated", "$totalDonors"] }, 2]
            }
         }
      }
   ]);

   // Top donors by donation amount
   const topDonors = await Donation.aggregate([
      {
         $match: {
            organization: new mongoose.Types.ObjectId(organizationId),
            type: DonationType.MONEY,
            status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] }
         }
      },
      {
         $group: {
            _id: "$donor",
            totalDonated: { $sum: "$amount" },
            donationCount: { $sum: 1 },
            lastDonation: { $max: "$createdAt" }
         }
      },
      {
         $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "donorInfo"
         }
      },
      { $unwind: "$donorInfo" },
      {
         $project: {
            _id: 0,
            donorId: "$_id",
            firstName: "$donorInfo.firstName",
            lastName: "$donorInfo.lastName",
            email: "$donorInfo.email",
            totalDonated: 1,
            donationCount: 1,
            lastDonation: 1
         }
      },
      { $sort: { totalDonated: -1 } },
      { $limit: 10 }
   ]);

   res.status(200).json({
      success: true,
      data: {
         donorMetrics: donorDemographics[0] || {
            totalDonors: 0,
            newDonorsThisMonth: 0,
            repeatDonors: 0,
            repeatDonorPercentage: 0,
            averageDonationPerDonor: 0
         },
         topDonors
      }
   });
});

// Helper function to fill in missing months in time series data
function fillMissingMonths(data, startDate, endDate) {
   const result = [];
   const monthsMap = new Map();

   // Convert aggregation result to a map keyed by year-month
   data.forEach(item => {
      const key = `${item._id.year}-${item._id.month}`;
      monthsMap.set(key, {
         year: item._id.year,
         month: item._id.month,
         count: item.count,
         total: item.total
      });
   });

   // Generate all months between start and end date
   let currentDate = new Date(startDate);
   while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const key = `${year}-${month}`;

      if (monthsMap.has(key)) {
         result.push(monthsMap.get(key));
      } else {
         result.push({
            year,
            month,
            count: 0,
            total: 0
         });
      }

      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
   }

   return result;
}

// Helper function to calculate donor retention
async function calculateDonorRetention(organizationId) {
   const today = new Date();
   const thisYear = new Date(today.getFullYear(), 0, 1);
   const lastYear = new Date(today.getFullYear() - 1, 0, 1);

   // Get donors from this year
   const thisYearDonors = await Donation.distinct("donor", {
      organization: organizationId,
      createdAt: { $gte: thisYear },
      status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] }
   });

   // Get donors from last year
   const lastYearDonors = await Donation.distinct("donor", {
      organization: organizationId,
      createdAt: { $gte: lastYear, $lt: thisYear },
      status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] }
   });

   // Calculate retention
   const lastYearDonorsMap = new Set(lastYearDonors.map(id => id.toString()));

   let retainedCount = 0;
   thisYearDonors.forEach(donorId => {
      if (lastYearDonorsMap.has(donorId.toString())) {
         retainedCount++;
      }
   });

   const retentionRate = lastYearDonors.length > 0
      ? (retainedCount / lastYearDonors.length) * 100
      : 0;

   return {
      thisYearDonorCount: thisYearDonors.length,
      lastYearDonorCount: lastYearDonors.length,
      retainedDonorCount: retainedCount,
      retentionRate: Math.round(retentionRate * 10) / 10, // Round to 1 decimal place
      newDonorCount: thisYearDonors.length - retainedCount
   };
} 