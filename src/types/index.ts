export interface IUser {
  _id?: string;
  email: string;
  firebaseUid: string;
  role: 'donor' | 'organization' | 'admin';
  profileCompleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IDonorProfile {
  userId: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  profileImage?: string;
  bio?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IOrganizationProfile {
  userId: string;
  name: string;
  description: string;
  phoneNumber: string;
  email: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  logo?: string;
  documents?: string[];
  verified: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}
