// models/questionPaper.js
import mongoose from "mongoose";

const questionPaperSchema = new mongoose.Schema({
  year: {
    type: String,
    required: true
  },
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  subject: {
    type: String,
    required: true
  },
  examType: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: String,
    required: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  }
});

const QuestionPaperModel = mongoose.model("QuestionPaper", questionPaperSchema);

export default QuestionPaperModel;