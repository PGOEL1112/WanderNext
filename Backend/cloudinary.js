const cloudinaryModule = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinaryModule.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinaryModule,
    params: {
        folder: "WanderNext",
        allowed_formats: ["jpeg", "png", "jpg","avif","webp"]
    },
});

module.exports = {
    cloudinary: cloudinaryModule,
    storage
};
