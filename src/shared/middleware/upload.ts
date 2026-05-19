import path from "path";
import multer from "multer";

const storage = multer.diskStorage({
  destination: path.join(__dirname, "../../../uploads"),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export const uploadSingle = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed (jpeg, png, gif, webp)"));
    }
  },
}).single("attachment");
