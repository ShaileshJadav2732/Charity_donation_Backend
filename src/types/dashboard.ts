import { IUser } from "../types";
export interface AuthRequest extends Omit<Request, "user"> {
	user?: IUser;
}

export interface DashboardStatsResponse {
	success: boolean;
	data?: any;
	error?: string;
}

export interface DonationStats {
	totalAmount: number;
	totalDonations: number;
	averageDonation: number;
}

export interface CampaignStats {
	totalCampaigns: number;
	activeCampaigns: number;
	completedCampaigns: number;
	cancelledCampaigns: number;
	totalTargetAmount: number;
	totalRaisedAmount: number;
	avgSupporters: number;
	achievementRate: number;
}

export interface CauseStats {
	totalCauses: number;
	totalTargetAmount: number;
	totalRaisedAmount: number;
	achievementRate: number;
}
