// Import shared types from central location
import { DonationType, DonationStatus, Address } from "./index";

export interface Organization {
	_id: string;
	name: string;
	address: string;
}

export interface DonationFormData {
	donor: string; // Optional if backend uses auth token
	organization: string;
	cause: string;
	type: DonationType; // Use enum instead of string for type safety
	amount?: number;
	description: string;
	quantity?: number;
	unit?: string;
	scheduledDate?: string;
	scheduledTime?: string;
	isPickup: boolean;
	contactPhone: string;
	contactEmail: string;
	pickupAddress?: Address;
	dropoffAddress?: Address;
}

export interface DonationResponse {
	donation: Donation;
}

export interface DonationQueryParams {
	page?: number;
	limit?: number;
	causeId?: string;
	status?: string;
}

export interface DonorDonationsResponse {
	success: boolean;
	data: Donation[];
	pagination: {
		total: number;
		page: number;
		pages: number;
	};
}

export interface DonationStats {
	monetary: {
		totalDonated: number;
		averageDonation: number;
		donationCount: number;
	};
	items: {
		totalDonations: number;
		byType: Array<{
			type: string;
			count: number;
			totalQuantity: number;
		}>;
	};
	totalCauses: number;
}

export interface Pagination {
	total: number;
	page: number;
	pages: number;
}

export interface DonationResponse {
	donations: Donation[];
	pagination: Pagination;
}

export interface ApiResponse<T> {
	success: boolean;
	data: T;
	message?: string;
	pagination?: Pagination;
}

export interface DonationQueryParams {
	organizationId: string;
	status?: string;
	page?: number;
	limit?: number;
}

export interface UpdateDonationStatusRequest {
	donationId: string;
	status: DonationStatus;
}

export interface UpdateDonationStatusResponse {
	success: boolean;
	data: Donation;
	message?: string;
}

export interface Donor {
	name?: string;
	email?: string;
}

export interface Cause {
	title?: string;
}

export interface PickupAddress {
	street?: string;
	city?: string;
	state?: string;
	zipCode?: string;
	country?: string;
}

export interface organizationDonation {
	_id: string;
	donor?: Donor;
	quantity: number;
	unit: string;
	type?: string;
	cause?: Cause;
	scheduledDate: string; // ISO date string (e.g., "2025-05-20T00:00:00.000Z")
	scheduledTime?: string;
	description?: string;
	status: "PENDING" | "APPROVED" | "RECEIVED" | "CONFIRMED" | "CANCELLED";
	isPickup: boolean;
	pickupAddress?: PickupAddress;
	contactPhone?: string;
	contactEmail?: string;
	amount?: number;
	createdAt: string; // ISO date string (e.g., "2025-05-20T00:00:00.000Z")
}

export interface Donation {
	_id: string;
	donor: {
		_id: string;
		name: string;
		email: string;
		phone?: string;
	};
	cause: {
		_id: string;
		title: string;
	};
	organization: {
		_id: string;
		name: string;
		email: string;
		phone: string;
	};
	amount?: number;
	type: string;
	status: string;
	quantity?: number;
	createdAt: string;
	description: string;
	receiptImage?: string;
	unit?: string;
}
export interface VoiceCommand {
	type: "MONEY" | "ITEMS";
	amount?: number;
	itemType?: DonationType;
	quantity?: number;
	unit?: string;
	description?: string;
	confidence: number;
	originalText: string;

	// Contact Information
	contactPhone?: string;
	contactEmail?: string;
	donorName?: string;

	// Address Information
	address?: {
		street?: string;
		city?: string;
		state?: string;
		zipCode?: string;
		country?: string;
	};

	// Delivery/Pickup Information
	isPickup?: boolean;
	scheduledDate?: string;
	scheduledTime?: string;
	deliveryInstructions?: string;
}
