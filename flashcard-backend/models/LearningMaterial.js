const mongoose = require('mongoose');

const learningMaterialSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  path: { type: String, required: true },
  mimeType: { type: String, required: true },
  // ADDED: A field to store the extracted text content from the file.
  content: { type: String }, 
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LearningMaterial', learningMaterialSchema);
