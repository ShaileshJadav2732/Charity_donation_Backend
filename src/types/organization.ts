import { DonationType } from "types";
export interface OrganizationResponse {
	id: string;
	userId: string;
	name: string;
	description: string;
	phoneNumber: string;
	email: string;
	website: string | null;
	address: string | null;
	city: string | null;
	state: string | null;
	country: string | null;
	logo: string | null;
	verified: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface DonorResponse {
	id: string;
	name: string;
	email: string;
	phoneNumber: string | null;
	address: {
		street: string | null;
		city: string | null;
		state: string | null;
		country: string | null;
	};
	profileImage: string | null;
	totalDonated: number;
	totalDonations: number;
	lastDonation: Date;
	firstDonation: Date;
	frequency: string;
	impactScore: number;
	donationTypes: DonationType[];
	causesSupported: number;
}

export interface CampaignResponse {
	id: string;
	title: string;
	description: string;
	startDate: string;
	endDate: string;
	status: string;
	totalTargetAmount: number;
	totalRaisedAmount: number;
	totalSupporters: number;
	imageUrl: string;
	tags: string[];
	acceptedDonationTypes: DonationType[];
	organizations: string[];
	causes: string[];
	createdAt: string;
	updatedAt: string;
}
