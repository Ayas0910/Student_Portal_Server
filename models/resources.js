// models/resources.js

import mongoose from "mongoose";

// Resource Schema
const resourceSchema = new mongoose.Schema({
  semester: {
    type: String,  // Changed to string to match how it's used in the routes
    required: true
  },
  resourceType: {  // Changed from 'type' to 'resourceType' to match route handlers
    type: String,
    required: true,
    enum: ['notes', 'books', 'videoMaterials']
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  fileUrl: {  // Changed from 'filePath' to 'fileUrl' to match route handlers
    type: String,
    trim: true
  },
  fileName: {
    type: String,
    trim: true
  },
  // For video materials
  channel: {
    type: String,
    trim: true
  },
  topics: {
    type: [String]
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
resourceSchema.index({ semester: 1, resourceType: 1, subject: 1 });

const ResourceModel = mongoose.model("Resource", resourceSchema);

// Subject Schema
const subjectSchema = new mongoose.Schema({
  semester: {  // Added semester which is used in the routes
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  }
  // Removed 'code' as it doesn't appear to be used in the routes
});

// Index for faster queries
subjectSchema.index({ semester: 1, name: 1 }, { unique: true });

const SubjectModel = mongoose.model("Subject", subjectSchema);

export { ResourceModel, SubjectModel };