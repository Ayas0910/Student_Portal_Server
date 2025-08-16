// models/CGPAProfile.js - Mongoose model for CGPA profiles
import mongoose from 'mongoose';

// Schema for a course
const CourseSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  credits: {
    type: Number,
    required: true
  },
  grade: {
    type: String,
    default: ''
  }
});

// Schema for a semester
const SemesterSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  courses: [CourseSchema],
  expanded: {
    type: Boolean,
    default: true
  }
});

// Main schema for CGPA profile
const CGPAProfileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  userName: {
    type: String,
    required: true
  },
  semesters: [SemesterSchema],
  cgpa: {
    type: Number,
    required: true
  },
  totalCredits: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const CGPAProfile = mongoose.model('CGPAProfile', CGPAProfileSchema);

export default CGPAProfile;