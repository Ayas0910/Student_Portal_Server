// routes/resources.js
import express from "express";
import { ResourceModel, SubjectModel } from "../models/resources.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create semester directory if it doesn't exist
    const dir = `./uploads/resources/sem${req.body.semester}`;
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Create unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    // Accept only specific file types
    const filetypes = /pdf|doc|docx|ppt|pptx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, PPT, PPTX files are allowed!'));
    }
  }
});

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ status: "Error", message: "Access denied. Admin privileges required." });
  }
};

// Get all subjects for a semester
router.get("/subjects/:semester", async (req, res) => {
  try {
    const subjects = await SubjectModel.find({ semester: req.params.semester })
      .sort({ name: 1 })
      .select('name');
    
    res.json({ status: "Success", subjects: subjects.map(s => s.name) });
  } catch (err) {
    res.status(500).json({ status: "Error", message: err.message });
  }
});

// Add a subject (admin only)
router.post("/subjects", checkAdmin, async (req, res) => {
  try {
    const { semester, name } = req.body;
    
    if (!semester || !name) {
      return res.status(400).json({ status: "Error", message: "Semester and subject name are required" });
    }
    
    // Check if subject already exists
    const existingSubject = await SubjectModel.findOne({ semester, name });
    if (existingSubject) {
      return res.status(400).json({ status: "Error", message: "Subject already exists for this semester" });
    }
    
    // Create new subject
    const subject = await SubjectModel.create({ semester, name });
    
    res.status(201).json({ status: "Success", subject });
  } catch (err) {
    res.status(500).json({ status: "Error", message: err.message });
  }
});

// Delete a subject (admin only)
router.delete("/subjects/:semester/:name", checkAdmin, async (req, res) => {
  try {
    const { semester, name } = req.params;
    
    // Delete subject
    await SubjectModel.deleteOne({ semester, name });
    
    // Delete all associated resources
    await ResourceModel.deleteMany({ semester, subject: name });
    
    res.json({ status: "Success", message: "Subject deleted successfully" });
  } catch (err) {
    res.status(500).json({ status: "Error", message: err.message });
  }
});

// Get resources by semester and type
router.get("/:semester/:type", async (req, res) => {
  try {
    const { semester, type } = req.params;
    
    // Validate resource type
    if (!['videoMaterials', 'notes', 'books'].includes(type)) {
      return res.status(400).json({ status: "Error", message: "Invalid resource type" });
    }
    
    let resources;
    if (type === 'videoMaterials') {
      // Group video materials by subject and return all channels
      resources = await ResourceModel.aggregate([
        { $match: { semester, resourceType: type } },
        { $group: {
            _id: "$subject",
            channels: { $push: { channel: "$channel", topics: "$topics" } }
          }
        },
        { $project: { _id: 0, subject: "$_id", channels: 1 } }
      ]);
      
      // Convert to expected format
      const result = {};
      resources.forEach(item => {
        result[item.subject] = item.channels;
      });
      
      res.json({ status: "Success", resources: result });
    } else {
      // For notes and books, return file URLs grouped by subject
      resources = await ResourceModel.find(
        { semester, resourceType: type },
        'subject fileUrl fileName'
      );
      
      // Convert to expected format
      const result = {};
      resources.forEach(item => {
        result[item.subject] = {
          url: item.fileUrl,
          name: item.fileName
        };
      });
      
      res.json({ status: "Success", resources: result });
    }
  } catch (err) {
    res.status(500).json({ status: "Error", message: err.message });
  }
});

// Get all resources for a semester
router.get("/:semester", async (req, res) => {
  try {
    const { semester } = req.params;
    
    // Get all subjects for this semester
    const subjects = await SubjectModel.find({ semester })
      .sort({ name: 1 })
      .select('name');
    
    // Get all resources for this semester
    const resources = await ResourceModel.find({ semester });
    
    // Organize resources by type and subject
    const result = {
      subjects: subjects.map(s => s.name),
      videoMaterials: {},
      notes: {},
      books: {}
    };
    
    // Process video materials
    const videoMaterials = resources.filter(r => r.resourceType === 'videoMaterials');
    subjects.forEach(subject => {
      const subjectName = subject.name;
      const subjectVideos = videoMaterials.filter(r => r.subject === subjectName);
      
      if (subjectVideos.length > 0) {
        result.videoMaterials[subjectName] = subjectVideos.map(v => ({
          channel: v.channel,
          topics: v.topics
        }));
      }
    });
    
    // Process notes and books
    ['notes', 'books'].forEach(type => {
      const typeResources = resources.filter(r => r.resourceType === type);
      subjects.forEach(subject => {
        const subjectName = subject.name;
        const resource = typeResources.find(r => r.subject === subjectName);
        
        if (resource) {
          result[type][subjectName] = resource.fileUrl;
        }
      });
    });
    
    res.json({
      status: "Success",
      resources: result
    });
  } catch (err) {
    res.status(500).json({ status: "Error", message: err.message });
  }
});

// Add a video channel (admin only)
router.post("/video", checkAdmin, async (req, res) => {
  try {
    const { semester, subject, channel, topics } = req.body;
    
    if (!semester || !subject || !channel || !topics) {
      return res.status(400).json({ 
        status: "Error", 
        message: "Semester, subject, channel name, and topics are required" 
      });
    }
    
    // Check if subject exists
    const existingSubject = await SubjectModel.findOne({ semester, name: subject });
    if (!existingSubject) {
      return res.status(404).json({ status: "Error", message: "Subject not found" });
    }
    
    // Check if channel already exists for this subject
    const existingChannel = await ResourceModel.findOne({
      semester,
      resourceType: 'videoMaterials',
      subject,
      channel
    });
    
    if (existingChannel) {
      return res.status(400).json({ status: "Error", message: "Channel already exists for this subject" });
    }
    
    // Create new video resource
    const resource = await ResourceModel.create({
      semester,
      resourceType: 'videoMaterials',
      subject,
      channel,
      topics: Array.isArray(topics) ? topics : topics.split(',').map(t => t.trim())
    });
    
    res.status(201).json({ status: "Success", resource });
  } catch (err) {
    res.status(500).json({ status: "Error", message: err.message });
  }
});

// Delete a video channel (admin only)
router.delete("/video/:semester/:subject/:channel", checkAdmin, async (req, res) => {
  try {
    const { semester, subject, channel } = req.params;
    
    // Delete the channel
    await ResourceModel.deleteOne({
      semester,
      resourceType: 'videoMaterials',
      subject,
      channel
    });
    
    res.json({ status: "Success", message: "Channel deleted successfully" });
  } catch (err) {
    res.status(500).json({ status: "Error", message: err.message });
  }
});

// Add or update a file resource (notes or books) (admin only)
router.post("/file", checkAdmin, upload.single('file'), async (req, res) => {
  try {
    const { semester, subject, resourceType } = req.body;
    
    if (!semester || !subject || !resourceType || !['notes', 'books'].includes(resourceType)) {
      return res.status(400).json({ 
        status: "Error", 
        message: "Semester, subject, and valid resource type are required" 
      });
    }
    
    // Check if subject exists
    const existingSubject = await SubjectModel.findOne({ semester, name: subject });
    if (!existingSubject) {
      return res.status(404).json({ status: "Error", message: "Subject not found" });
    }
    
    let fileUrl, fileName;
    
    if (req.file) {
      // If file is uploaded
      fileUrl = `/uploads/resources/sem${semester}/${req.file.filename}`;
      fileName = req.file.originalname;
    } else if (req.body.fileUrl && req.body.fileName) {
      // If URL is provided
      fileUrl = req.body.fileUrl;
      fileName = req.body.fileName;
    } else {
      return res.status(400).json({ status: "Error", message: "Either file upload or file URL is required" });
    }
    
    // Check if resource already exists for this subject
    const existingResource = await ResourceModel.findOne({
      semester,
      resourceType,
      subject
    });
    
    if (existingResource) {
      // Update existing resource
      existingResource.fileUrl = fileUrl;
      existingResource.fileName = fileName;
      existingResource.updatedAt = Date.now();
      await existingResource.save();
      
      res.json({ status: "Success", resource: existingResource, message: "Resource updated successfully" });
    } else {
      // Create new resource
      const resource = await ResourceModel.create({
        semester,
        resourceType,
        subject,
        fileUrl,
        fileName
      });
      
      res.status(201).json({ status: "Success", resource, message: "Resource added successfully" });
    }
  } catch (err) {
    res.status(500).json({ status: "Error", message: err.message });
  }
});

// Delete a file resource (admin only)
router.delete("/file/:semester/:resourceType/:subject", checkAdmin, async (req, res) => {
  try {
    const { semester, resourceType, subject } = req.params;
    
    if (!['notes', 'books'].includes(resourceType)) {
      return res.status(400).json({ status: "Error", message: "Invalid resource type" });
    }
    
    // Find the resource to get the file path
    const resource = await ResourceModel.findOne({
      semester,
      resourceType,
      subject
    });
    
    if (!resource) {
      return res.status(404).json({ status: "Error", message: "Resource not found" });
    }
    
    // Delete resource from database
    await ResourceModel.deleteOne({
      semester,
      resourceType,
      subject
    });
    
    // Delete physical file if it's stored locally
    if (resource.fileUrl.startsWith('/uploads/')) {
      try {
        const filePath = path.join(process.cwd(), resource.fileUrl);
        fs.unlinkSync(filePath);
      } catch (fileErr) {
        console.error("Error deleting file:", fileErr);
        // Continue even if file deletion fails
      }
    }
    
    res.json({ status: "Success", message: "Resource deleted successfully" });
  } catch (err) {
    res.status(500).json({ status: "Error", message: err.message });
  }
});

export default router;