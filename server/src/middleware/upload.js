// File-upload middleware for spreadsheet imports.
//
// Uses multer with in-memory storage (files are small and parsed immediately,
// so they never touch disk). We restrict size and file type for safety.
import multer from 'multer';
import ApiError from '../utils/ApiError.js';

const ALLOWED_EXTENSIONS = /\.(xlsx|xls|csv)$/i;
const ALLOWED_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv',
  'application/csv',
  'text/plain', // some browsers send this for .csv
  'application/octet-stream', // fallback some browsers use
]);

const storage = multer.memoryStorage();

const multerUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB cap
    files: 1,
  },
  fileFilter(_req, file, cb) {
    const extOk = ALLOWED_EXTENSIONS.test(file.originalname);
    const mimeOk = ALLOWED_MIME.has(file.mimetype);
    if (extOk && mimeOk) return cb(null, true);
    cb(ApiError.badRequest('Only .xlsx, .xls or .csv files are allowed.'));
  },
});

/**
 * Wrap multer's single-file handler so its errors (e.g. file too large)
 * become clean ApiErrors handled by our central error handler.
 */
export function uploadSpreadsheet(req, res, next) {
  multerUpload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(ApiError.badRequest('File is too large (max 5 MB).'));
      }
      return next(err instanceof ApiError ? err : ApiError.badRequest(err.message));
    }
    if (!req.file) {
      return next(ApiError.badRequest('No file uploaded. Attach a spreadsheet as "file".'));
    }
    next();
  });
}
