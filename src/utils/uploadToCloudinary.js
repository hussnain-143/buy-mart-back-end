import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadToCloudinary = async (localPath) => {
  try {
    if (!localPath) return null;

    const result = await cloudinary.uploader.upload(localPath, {
      resource_type: "auto",
    });

    fs.unlinkSync(localPath); // remove local file after upload
    return result;

  } catch (error) {
    if (localPath && fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
    throw error;
  }
};
