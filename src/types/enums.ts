export enum DonationType {
   MONEY = 'MONEY',
   BLOOD = 'BLOOD',
   CLOTHES = 'CLOTHES',
   FOOD = 'FOOD',
   OTHER = 'OTHER'
}

export enum DonationStatus {
   PENDING = 'PENDING',
   CONFIRMED = 'CONFIRMED',
   COMPLETED = 'COMPLETED',
   CANCELLED = 'CANCELLED'
}

export enum BloodType {
   A_POSITIVE = 'A+',
   A_NEGATIVE = 'A-',
   B_POSITIVE = 'B+',
   B_NEGATIVE = 'B-',
   AB_POSITIVE = 'AB+',
   AB_NEGATIVE = 'AB-',
   O_POSITIVE = 'O+',
   O_NEGATIVE = 'O-'
}

export enum ClothesCondition {
   NEW = 'NEW',
   LIKE_NEW = 'LIKE_NEW',
   GOOD = 'GOOD',
   FAIR = 'FAIR',
   POOR = 'POOR'
}

export enum FoodType {
   PERISHABLE = 'PERISHABLE',
   NON_PERISHABLE = 'NON_PERISHABLE',
   FRESH = 'FRESH',
   PACKAGED = 'PACKAGED'
}

export enum CampaignStatus {
   DRAFT = 'DRAFT',
   ACTIVE = 'ACTIVE',
   PAUSED = 'PAUSED',
   COMPLETED = 'COMPLETED',
   CANCELLED = 'CANCELLED'
}

export enum CampaignType {
   FUNDRAISING = 'FUNDRAISING',
   AWARENESS = 'AWARENESS',
   VOLUNTEER = 'VOLUNTEER',
   EMERGENCY = 'EMERGENCY',
   SEASONAL = 'SEASONAL'
}

export enum UserRole {
   USER = 'USER',
   ORGANIZATION = 'ORGANIZATION',
   ADMIN = 'ADMIN'
}

export enum CauseCategory {
   EDUCATION = 'EDUCATION',
   HEALTH = 'HEALTH',
   ENVIRONMENT = 'ENVIRONMENT',
   ANIMAL_WELFARE = 'ANIMAL_WELFARE',
   HUMANITARIAN = 'HUMANITARIAN',
   DISASTER_RELIEF = 'DISASTER_RELIEF',
   SOCIAL_SERVICES = 'SOCIAL_SERVICES',
   OTHER = 'OTHER'
} 