const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/authMiddleware');
const LearningMaterial = require('../models/LearningMaterial');
const pdf = require('pdf-parse'); // Import the pdf-parse library
const Tesseract = require('tesseract.js');
const { convert } = require('pdf-poppler');

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    // Create the directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// --- NEW: FILE VALIDATION ---
// Define a filter to allow only specific file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'text/plain'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true); // Accept file
  } else {
    cb(new Error('Invalid file type. Only PDF and TXT files are allowed.'), false); // Reject file
  }
};

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB size limit
  fileFilter
});
// --- END OF FILE VALIDATION ---


// Route to upload a new learning material
router.post('/upload', auth, (req, res) => {
    const uploader = upload.single('material');

    uploader(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading.
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
            }
            return res.status(400).json({ error: err.message });
        } else if (err) {
            // An unknown error occurred (like our custom file type error).
            return res.status(400).json({ error: err.message });
        }
        
        // Everything went fine, proceed to process the file.
        processUpload(req, res);
    });
});

async function processUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { originalname, path: filePath, mimetype, filename } = req.file;
    let extractedText = '';

    // --- TEXT EXTRACTION LOGIC ---
    if (mimetype === 'application/pdf') {
      try {
        // First try normal text extraction
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        extractedText = data.text;
        
        console.log(`📄 PDF Info: ${originalname}`);
        console.log(`  - Pages: ${data.numpages}`);
        console.log(`  - Text length: ${extractedText.length} chars`);
        
        // If very little text extracted, try OCR
        if (extractedText.length < 100) {
          console.log('⚠️ PDF has minimal text, attempting OCR...');
          
          // Convert PDF to images
          const tempDir = path.join(__dirname, '../uploads/temp');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          const opts = {
            format: 'png',
            out_dir: tempDir,
            out_prefix: path.basename(filename, '.pdf'),
            page: 1 // Just first page for now
          };
          
          await convert(filePath, opts);
          
          // Run OCR on first page
          const imagePath = path.join(tempDir, `${path.basename(filename, '.pdf')}-1.png`);
          if (fs.existsSync(imagePath)) {
            const { data: ocrData } = await Tesseract.recognize(imagePath, 'eng', {
              logger: m => console.log(m) // Shows progress
            });
            extractedText = ocrData.text;
            
            console.log('✅ OCR extracted:', extractedText.length, 'characters');
            
            // Clean up temp image
            fs.unlinkSync(imagePath);
          }
        }
      } catch (error) {
        console.error('PDF/OCR error:', error);
        extractedText = ''; // Fallback to empty string
      }
    } else if (mimetype === 'text/plain') {
      extractedText = fs.readFileSync(filePath, 'utf8');
    }
    // --- END OF TEXT EXTRACTION ---

    const newMaterial = new LearningMaterial({
      originalName: originalname,
      path: `/uploads/${filename}`,
      mimeType: mimetype,
      content: extractedText,
      userId: req.user._id
    });

    await newMaterial.save();
    res.status(201).json(newMaterial);
  } catch (error) {
    console.error('Server error during file processing:', error);
    res.status(500).json({ error: 'Server error during file processing.' });
  }
}


// Route to get all learning materials for the logged-in user
router.get('/', auth, async (req, res) => {
  try {
    // We exclude the large 'content' field to keep this list lightweight
    const materials = await LearningMaterial.find({ userId: req.user._id })
      .select('-content')
      .sort({ createdAt: -1 });
    res.json(materials);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching materials.' });
  }
});

// Route to get a SINGLE learning material, including its content
router.get('/:id', auth, async (req, res) => {
  try {
    const material = await LearningMaterial.findById(req.params.id);

    if (!material) {
      return res.status(404).json({ error: 'Material not found.' });
    }

    // Ensure the user owns this material
    if (material.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'User not authorized to view this material.' });
    }

    // This response will include the 'content' field by default
    res.json(material);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching material.' });
  }
});


// Route to delete a learning material
router.delete('/:id', auth, async (req, res) => {
  try {
    const material = await LearningMaterial.findById(req.params.id);

    if (!material) {
      return res.status(404).json({ error: 'Material not found.' });
    }

    // Ensure the user owns this material
    if (material.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'User not authorized to delete this material.' });
    }

    // Delete the file from the filesystem
    const fullFilePath = path.join(__dirname, '..', 'uploads', path.basename(material.path));
    if (fs.existsSync(fullFilePath)) {
        fs.unlinkSync(fullFilePath);
    }
    
    await LearningMaterial.findByIdAndDelete(req.params.id);

    res.json({ message: 'Material deleted successfully.' });
  } catch (error) {
    console.error('Server error deleting material:', error);
    res.status(500).json({ error: 'Server error deleting material.' });
  }
});

module.exports = router;

