// models/discussion.js
import mongoose from 'mongoose';

const CommentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  author: {
    type: String,
    required: true
  },
  authorId: {
    type: String,
    required: true
  },
  authorImage: {
    type: String,
    default: '/images/default-avatar.png'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  likes: {
    type: Number,
    default: 0
  }
});

const ForumPostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  content: {
    type: String, 
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['academic', 'programming', 'exams', 'projects', 'general']
  },
  author: {
    type: String,
    required: true
  },
  authorId: {
    type: String,
    required: true
  },
  authorImage: {
    type: String,
    default: '/images/default-avatar.png'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  likes: {
    type: Number,
    default: 0
  },
  comments: [CommentSchema]
});

const ForumPost = mongoose.model('ForumPost', ForumPostSchema);

export default ForumPost;