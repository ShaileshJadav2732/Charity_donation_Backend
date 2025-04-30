export interface IDonor {
  id: string;
  user: string;
  totalDonations: number;
  donationHistory: string[];
  createdAt: Date;
  updatedAt: Date;
}
