import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import { CloudinaryUploadResult } from '../types/interfaces';

cloudinary.config({
   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
   api_key: process.env.CLOUDINARY_API_KEY,
   api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadToCloudinary = async (
   file: Express.Multer.File,
   folder: string = 'charity-donation'
): Promise<CloudinaryUploadResult> => {
   try {
      // Convert buffer to base64
      const b64 = Buffer.from(file.buffer).toString('base64');
      const dataURI = `data:${file.mimetype};base64,${b64}`;

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(dataURI, {
         folder,
         resource_type: 'auto',
         use_filename: true,
         unique_filename: true,
         overwrite: true
      });

      return {
         secure_url: result.secure_url,
         public_id: result.public_id
      };
   } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new Error('Failed to upload file to Cloudinary');
   }
};

export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
   try {
      await cloudinary.uploader.destroy(publicId);
   } catch (error) {
      console.error('Cloudinary delete error:', error);
      throw new Error('Failed to delete file from Cloudinary');
   }
};

export const updateCloudinaryImage = async (
   file: Express.Multer.File,
   oldPublicId: string,
   folder: string = 'charity-donation'
): Promise<CloudinaryUploadResult> => {
   try {
      // Delete old image
      await deleteFromCloudinary(oldPublicId);

      // Upload new image
      return await uploadToCloudinary(file, folder);
   } catch (error) {
      console.error('Cloudinary update error:', error);
      throw new Error('Failed to update file in Cloudinary');
   }
};

const storage = new CloudinaryStorage({
   cloudinary: cloudinary,
   params: {
      folder: "charity_donation",
      allowed_formats: ["jpg", "jpeg", "png", "gif"],
      transformation: [{ width: 1000, height: 1000, crop: "limit" }],
   },
});

export const upload = multer({ storage: storage }); 