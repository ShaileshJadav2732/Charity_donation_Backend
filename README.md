# Charity Donation Backend

Backend API for the Charity Donation platform built with Express.js, TypeScript, MongoDB, Firebase Auth, Stripe payments, Socket.io, and Cloudinary.

## Tech Stack

- **TypeScript** - Type-safe JavaScript
- **Express.js** - Web application framework
- **MongoDB/Mongoose** - Database and ODM
- **Firebase Admin SDK** - Authentication and authorization
- **Stripe** - Payment processing
- **Socket.io** - Real-time communication
- **Cloudinary** - Media management
- **PDFKit** - PDF generation
- **Resend** - Email service
- **Groq SDK** - AI/ML integration

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/ShaileshJadav2732/Charity_donation_Backend.git
   cd Charity_donation_Backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory with the required environment variables (see `.env.example` for reference).

4. **Run the development server**
   ```bash
   npm run dev
   ```

## Available Scripts

- `npm run dev` - Start development server with ts-node
- `npm run build` - Build the TypeScript project
- `npm run build:clean` - Clean build directory and rebuild
- `npm start` - Start production server (requires build)
- `npm run start:dev` - Alternative development server command
- `npm run start:prod` - Build and start production server
- `npm run render-build` - Build script for Render deployment
- `npm run render-start` - Start script for Render deployment
- `npm run deploy` - Deploy script with diagnostics

## Required Environment Variables

The following environment variables are required to run the application:

- `PORT` - Server port number
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT token generation
- `STRIPE_SECRET_KEY` - Stripe secret API key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret
- `FIREBASE_SERVICE_ACCOUNT_PATH` - Path to Firebase service account JSON file
- `RESEND_API_KEY` - Resend email API key
- `GROQ_API_KEY` - Groq API key
- `FRONTEND_URL` - Frontend application URL

See `.env.example` for sample configuration values.
