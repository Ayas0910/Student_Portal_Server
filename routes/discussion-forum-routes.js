// routes/discussion-forum-routes.js
import express from 'express';
import mongoose from 'mongoose';
import ForumPost from '../models/discussion.js';

const router = express.Router();

// GET all posts with optional filtering
router.get('/posts', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = {};
    
    // Add category filter if specified
    if (category && category !== 'all') {
      query.category = category;
    }
    
    // Add search query if specified
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get posts with comments, sorted by newest first
    const posts = await ForumPost.find(query)
      .sort({ createdAt: -1 })
      .populate('comments')
      .exec();
      
    res.json(posts);
  } catch (err) {
    console.error('Error fetching posts:', err);
    res.status(500).json({ message: err.message });
  }
});

// Create a new post
router.post('/posts', async (req, res) => {
  try {
    const { title, content, category } = req.body;
    const { registerno, name } = req.user;
    
    const post = new ForumPost({
      title,
      content,
      category,
      author: name || registerno,
      authorId: registerno,
      authorImage: '/images/default-avatar.png', // Default image path
      likes: 0,
      comments: []
    });
    
    const savedPost = await post.save();
    res.status(201).json({ message: 'Post created successfully', post: savedPost });
  } catch (err) {
    console.error('Error creating post:', err);
    res.status(400).json({ message: err.message });
  }
});

// Add a comment to a post
router.post('/posts/:postId/comments', async (req, res) => {
  try {
    const { content } = req.body;
    const { postId } = req.params;
    const { registerno, name } = req.user;
    
    const post = await ForumPost.findById(postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    const comment = {
      _id: new mongoose.Types.ObjectId(),
      content,
      author: name || registerno,
      authorId: registerno,
      authorImage: '/images/default-avatar.png', // Default image path
      createdAt: new Date(),
      likes: 0
    };
    
    post.comments.push(comment);
    await post.save();
    
    res.status(201).json({ message: 'Comment added successfully', comment });
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(400).json({ message: err.message });
  }
});

// Like a post
router.post('/posts/:postId/like', async (req, res) => {
  try {
    const { postId } = req.params;
    
    const post = await ForumPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Increment likes (in a real app, you'd track who has already liked it)
    post.likes += 1;
    await post.save();
    
    res.json({ message: 'Post liked successfully', likes: post.likes });
  } catch (err) {
    console.error('Error liking post:', err);
    res.status(400).json({ message: err.message });
  }
});

// Like a comment
router.post('/posts/:postId/comments/:commentId/like', async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    
    const post = await ForumPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Increment likes (in a real app, you'd track who has already liked it)
    comment.likes += 1;
    await post.save();
    
    res.json({ message: 'Comment liked successfully', likes: comment.likes });
  } catch (err) {
    console.error('Error liking comment:', err);
    res.status(400).json({ message: err.message });
  }
});

export default router;