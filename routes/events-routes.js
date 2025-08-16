// routes/events-routes.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import EventModel from '../models/events.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up storage for event images
const eventStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, '../uploads/events');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `event-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: eventStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// Get all events - accessible to all users
router.get('/', async (req, res) => {
  try {
    const events = await EventModel.find().sort({ date: -1 });
    res.json(events);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ status: 'Error', message: err.message });
  }
});

// Create a new event - admin only
router.post('/', upload.single('image'), async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ status: 'Error', message: 'Admin privileges required' });
    }
    
    const { title, description, date, location, buttonText, buttonLink } = req.body;
    
    // Create new event object
    const newEvent = new EventModel({
      title,
      description,
      date,
      location,
      buttonText,
      buttonLink,
      createdBy: req.user.registerno
    });
    
    // Add image path if uploaded
    if (req.file) {
      newEvent.image = `${req.file.filename}`;
    }
    
    // Save to database
    await newEvent.save();
    res.status(201).json({ status: 'Success', event: newEvent });
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ status: 'Error', message: err.message });
  }
});

// Get specific event by ID
router.get('/:id', async (req, res) => {
  try {
    const event = await EventModel.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ status: 'Error', message: 'Event not found' });
    }
    res.json(event);
  } catch (err) {
    res.status(500).json({ status: 'Error', message: err.message });
  }
});

// Update event - admin only
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ status: 'Error', message: 'Admin privileges required' });
    }
    
    const { title, description, date, location, buttonText, buttonLink } = req.body;
    
    // Find existing event
    const event = await EventModel.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ status: 'Error', message: 'Event not found' });
    }
    
    // Update fields
    event.title = title;
    event.description = description;
    event.date = date;
    event.location = location;
    event.buttonText = buttonText;
    event.buttonLink = buttonLink;
    event.updatedAt = Date.now();
    
    // Handle image update
    if (req.file) {
      // Delete old image if exists
      if (event.image) {
        try {
          const oldImagePath = path.join(__dirname, '../uploads/events', event.image);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        } catch (err) {
          console.error('Error deleting old image:', err);
          // Continue even if file deletion fails
        }
      }
      
      // Set new image
      event.image = `${req.file.filename}`;
    }
    
    // Save updates
    await event.save();
    res.json({ status: 'Success', event });
  } catch (err) {
    console.error('Error updating event:', err);
    res.status(500).json({ status: 'Error', message: err.message });
  }
});

// Delete event - admin only
router.delete('/:id', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ status: 'Error', message: 'Admin privileges required' });
    }
    
    // Find event
    const event = await EventModel.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ status: 'Error', message: 'Event not found' });
    }
    
    // Delete associated image if exists
    if (event.image) {
      try {
        const imagePath = path.join(__dirname, '../uploads/events', event.image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      } catch (err) {
        console.error('Error deleting image:', err);
        // Continue even if file deletion fails
      }
    }
    
    // Delete from database
    await EventModel.findByIdAndDelete(req.params.id);
    res.json({ status: 'Success', message: 'Event deleted successfully' });
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ status: 'Error', message: err.message });
  }
});

export default router;