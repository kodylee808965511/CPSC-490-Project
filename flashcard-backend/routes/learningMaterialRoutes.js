const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/authMiddleware');
const LearningMaterial = require('../models/LearningMaterial');

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

const upload = multer({ storage });

// Route to upload a new learning material
router.post('/upload', auth, upload.single('material'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { originalname, path: filePath, mimetype } = req.file;

    const newMaterial = new LearningMaterial({
      originalName: originalname,
      path: `/uploads/${req.file.filename}`, // Store the web-accessible path
      mimeType: mimetype,
      userId: req.user._id
    });

    await newMaterial.save();
    res.status(201).json(newMaterial);
  } catch (error) {
    res.status(500).json({ error: 'Server error during file upload.' });
  }
});

// Route to get all learning materials for the logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const materials = await LearningMaterial.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(materials);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching materials.' });
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
    const filePath = path.join(__dirname, '..', material.path);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    
    await LearningMaterial.findByIdAndDelete(req.params.id);

    res.json({ message: 'Material deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting material.' });
  }
});

module.exports = router;
