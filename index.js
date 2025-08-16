// index.js (ES Module version)
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import multer from "multer";
import questionPaperRouter from './routes/question-paper-routes.js';
import ForumPost from "./models/discussion.js";
import StudentModel from "./models/students.js";
import TimetableModel from "./models/timetable.js";
import eventsRouter from './routes/events-routes.js';
import EventModel from './models/events.js';
import cgpaRoutes from './routes/cgpaRoutes.js';
import bodyParser from 'body-parser';
import eventsRoutes from './routes/events-routes.js';







// Add this import at the top with your other imports
import discussionForumRouter from './routes/discussion-forum-routes.js';

// Add this to your model imports








// Import models
import QuestionPaperModel from "./models/questionPaper.js";
import { ResourceModel, SubjectModel } from "./models/resources.js";
import timetableRoutes from './routes/timetable.js';


// Import routes
import resourcesRouter from "./routes/resources.js";


// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use('/api/timetable', timetableRoutes);
// Middleware setup
app.use(express.json());
app.use(cors());

// In index.js, modify this:


// To include a special case for forum routes:
const authenticateUserForForum = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // For forum GET routes, allow unauthenticated access
    if (req.method === 'GET' && !authHeader) {
      req.user = { 
        registerno: "", 
        name: "Guest User", 
        role: "guest" 
      };
      return next();
    }
    
    // For everything else, require authentication
    if (!authHeader) {
      return res.status(401).json({ status: "Error", message: "No authorization header provided" });
    }
    
    // Format: "Bearer registerno:role"
    const [type, credentials] = authHeader.split(' ');
    
    if (type !== 'Bearer' || !credentials) {
      return res.status(401).json({ status: "Error", message: "Invalid authorization header format" });
    }
    
    const [registerno, role] = credentials.split(':');
    
    if (!registerno) {
      return res.status(401).json({ status: "Error", message: "Invalid credentials format" });
    }
    
    const user = await StudentModel.findOne({ registerno });
    
    if (!user) {
      return res.status(401).json({ status: "Error", message: "User not found or unauthorized" });
    }
    
    // Attach user info to request object
    req.user = {
      registerno: user.registerno,
      name: user.name,
      email: user.email,
      role: user.role || 'student'
    };
    
    next();
  } catch (err) {
    console.error("Authentication error:", err);
    return res.status(500).json({ status: "Error", message: "Authentication error" });
  }
};



// Use the forum-specific middleware
app.use("/api/forum", authenticateUserForForum, discussionForumRouter);



// Setup uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create directories with proper structure
    const resourceType = req.body.resourceType;
    const semester = req.body.semester;
    const dir = path.join(uploadsDir, `semester${semester}`, resourceType);
    
    // Ensure directory exists
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Sanitize filename and make it unique
    const subject = req.body.subject.replace(/[^a-zA-Z0-9]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${subject}_${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit to 10MB
  fileFilter: (req, file, cb) => {
    // Allow PDFs for notes and books
    if (req.body.resourceType === 'notes' || req.body.resourceType === 'books') {
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Only PDF files are allowed!'), false);
      }
    } else {
      cb(null, true);
    }
  }
});

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// MongoDB Connection
mongoose.connect("mongodb://localhost:27017/student-login")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// ---------- Student Auth Routes ----------

// Register Route
app.post("/register", async (req, res) => {
  try {
    const { registerno, password, name, email, role } = req.body;

    // Validate required fields
    if (!registerno || !password || !name || !email) {
      return res.status(400).json({ status: "Error", message: "All fields are required" });
    }

    // Check if student already exists
    const existingStudent = await StudentModel.findOne({ registerno });
    if (existingStudent) {
      return res.status(400).json({ status: "Error", message: "Student already exists" });
    }

    // Create new student
    const student = await StudentModel.create({
      registerno,
      password,  // Plain text — consider hashing before production.
      name,
      email,
      role: role || "student"
    });

    return res.status(201).json({ status: "Success", student });

  } catch (error) {
    console.error("Registration Error:", error);

    // Handle MongoDB unique constraint errors
    if (error.code === 11000) {
      return res.status(400).json({
        status: "Error",
        message: "Duplicate entry: registerno or email already exists"
      });
    }

    return res.status(500).json({ status: "Error", message: "Internal Server Error" });
  }
});

// Login Route for Students
app.post("/login", async (req, res) => {
  const { registerno, password } = req.body;

  try {
    const student = await StudentModel.findOne({ registerno, role: "student" });
    if (!student) {
      return res.json({ status: "Error", message: "No student found" });
    }

    if (password === student.password) {
      res.json({
        status: "Success",
        user: {
          registerno: student.registerno,
          name: student.name,
          email: student.email,
          role: student.role
        }
      });
    } else {
      res.json({ status: "Error", message: "Password is Incorrect" });
    }
  } catch (err) {
    res.status(500).json({ status: "Error", message: err.message });
  }
});

// Admin Login Route
app.post("/admin-login", async (req, res) => {
  const { registerno, password } = req.body;

  try {
    console.log("Admin login attempt with registerno:", registerno);

    if (!registerno || !password) {
      console.log("Registerno or password is missing");
      return res.status(400).json({ status: "Error", message: "Registerno and password are required" });
    }

    const admin = await StudentModel.findOne({ registerno, role: "admin" });
    if (!admin) {
      console.log("No admin found for registerno:", registerno);
      return res.json({ status: "Error", message: "Admin not found" });
    }

    if (password === admin.password) {
      res.json({
        status: "Success",
        user: {
          registerno: admin.registerno,
          name: admin.name,
          email: admin.email,
          role: admin.role
        }
      });
      console.log(admin.role);
    } else {
      console.log("Incorrect password for registerno:", registerno);
      res.json({ status: "Error", message: "Password is Incorrect" });
    }
  } catch (err) {
    console.error("Error during admin login:", err);
    res.status(500).json({ status: "Error", message: err.message });
  }
});

// ---------- Timetable Routes ----------
// -- UPDATE: Fixed resource fetching endpoint --
app.get("/resources/:semester", async (req, res) => {
  try {
    const { semester } = req.params;
    
    console.log(`Fetching resources for semester ${semester}`);
    
    // Get all subjects for this semester
    const subjects = await SubjectModel.find({ semester })
      .sort({ name: 1 })
      .select('name');
    
    // Get all resources for this semester
    const resources = await ResourceModel.find({ semester });
    
    console.log(`Found ${subjects.length} subjects and ${resources.length} resources`);
    
    // Organize resources by type and subject
    const result = {
      subjects: subjects.map(s => s.name),
      videoMaterials: {},
      notes: {},
      books: {}
    };
    
    // Initialize with empty values for all subjects
    subjects.forEach(subject => {
      const subjectName = subject.name;
      result.videoMaterials[subjectName] = [];
      result.notes[subjectName] = "";
      result.books[subjectName] = "";
    });
    
    // Process video materials
    resources.filter(r => r.resourceType === 'videoMaterials').forEach(video => {
      if (!result.videoMaterials[video.subject]) {
        result.videoMaterials[video.subject] = [];
      }
      
      result.videoMaterials[video.subject].push({
        channel: video.channel,
        topics: video.topics
      });
    });
    
    // Process notes and books
    ['notes', 'books'].forEach(type => {
      resources.filter(r => r.resourceType === type).forEach(resource => {
        result[type][resource.subject] = resource.fileUrl;
      });
    });
    
    res.json(result);
  } catch (err) {
    console.error("Error fetching resources:", err);
    res.status(500).json({ status: "Error", message: err.message });
  }
});
app.get("/timetable", async (req, res) => {
  try {
    const entries = await TimetableModel.find();
    const timetableData = {};
    entries.forEach(entry => {
      if (!timetableData[entry.day]) timetableData[entry.day] = {};
      timetableData[entry.day][entry.time] = entry.content;
    });
    res.json(timetableData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/timetable", async (req, res) => {
  const { day, time, content } = req.body;
  try {
    await TimetableModel.findOneAndUpdate(
      { day, time },
      { content },
      { upsert: true, new: true }
    );
    res.status(200).json({ message: "Cell saved successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/timetable", async (req, res) => {
  console.log('DELETE request received:', req.body); // Debug log
  
  const { day, time } = req.body;
  
  if (!day || !time) {
    console.log('Validation failed - missing day or time');
    return res.status(400).json({ error: "Day and time are required" });
  }

  try {
    console.log('Attempting to delete:', { day, time }); // Debug log
    const result = await TimetableModel.findOneAndDelete({ day, time });
    
    if (!result) {
      console.log('No document found to delete');
      return res.status(404).json({ error: "Entry not found" });
    }
    
    console.log('Delete successful:', result); // Debug log
    res.status(200).json({ 
      message: "Cell deleted successfully",
      deletedEntry: result
    });
  } catch (err) {
    console.error("Database error:", err); // Debug log
    res.status(500).json({ 
      error: "Server error",
      details: err.message 
    });
  }
});

app.post("/timetable/update-time", async (req, res) => {
  const { oldTime, newTime } = req.body;
  try {
    const entries = await TimetableModel.find({ time: oldTime });
    for (const entry of entries) {
      entry.time = newTime;
      await entry.save();
    }
    res.status(200).json({ message: "Time slot updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ---------- Auth Middleware ----------
// -- UPDATE: Auth Middleware function --
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ status: "Error", message: "No authorization header provided" });
    }
    
    // Format: "Bearer registerno:role"
    const [type, credentials] = authHeader.split(' ');
    
    if (type !== 'Bearer' || !credentials) {
      return res.status(401).json({ status: "Error", message: "Invalid authorization header format" });
    }
    
    const [registerno, role] = credentials.split(':');
    
    if (!registerno || !role) {
      return res.status(401).json({ status: "Error", message: "Invalid credentials format" });
    }
    
    const user = await StudentModel.findOne({ registerno, role });
    
    if (!user) {
      return res.status(401).json({ status: "Error", message: "User not found or unauthorized" });
    }
    
    // Check if admin role is required for restricted routes
    const adminOnlyRoutes = [
      '/api/resources/upload',
      '/api/resources/delete',
      '/api/subjects'
    ];
    
    const currentPath = req.path;
    const requiresAdmin = adminOnlyRoutes.some(route => currentPath.includes(route));
    
    if (requiresAdmin && role !== 'admin') {
      return res.status(403).json({ status: "Error", message: "Admin privileges required" });
    }
    
    // Attach user info to request object
    req.user = {
      registerno: user.registerno,
      name: user.name,
      email: user.email,
      role: user.role
    };
    
    next();
  } catch (err) {
    console.error("Authentication error:", err);
    return res.status(500).json({ status: "Error", message: "Authentication error" });
  }
};

// Custom authentication middleware for events routes
const authenticateUserForEvents = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // For GET routes, allow access without authentication
    if (req.method === 'GET' && !authHeader) {
      console.log('Event route accessed without authentication (GET method)');
      req.user = { 
        registerno: "", 
        name: "Guest User", 
        role: "guest" 
      };
      return next();
    }
    
    // For other methods, check authorization
    if (!authHeader) {
      return res.status(401).json({ status: "Error", message: "No authorization header provided" });
    }
    
    // Format: "Bearer registerno:role"
    const [type, credentials] = authHeader.split(' ');
    
    if (type !== 'Bearer' || !credentials) {
      return res.status(401).json({ status: "Error", message: "Invalid authorization header format" });
    }
    
    const [registerno, role] = credentials.split(':');
    
    if (!registerno) {
      return res.status(401).json({ status: "Error", message: "Invalid credentials format" });
    }
    
    const user = await StudentModel.findOne({ registerno });
    
    if (!user) {
      return res.status(401).json({ status: "Error", message: "User not found or unauthorized" });
    }
    
    // Attach user info to request object
    req.user = {
      registerno: user.registerno,
      name: user.name,
      email: user.email,
      role: user.role || 'student'
    };
    
    next();
  } catch (err) {
    console.error("Authentication error:", err);
    return res.status(500).json({ status: "Error", message: "Authentication error" });
  }
};

// ---------- Mount Resources Router ----------
// Add authentication middleware to resources routes
app.use("/api/resources", authenticateUser, resourcesRouter);

// ---------- Mount Question Paper Router ----------
app.use("/question-papers", questionPaperRouter);

app.use("/api/events", authenticateUserForEvents, eventsRouter);
app.post("/initial-event", async (req, res) => {
  try {
    // Check if there are any events
    const eventCount = await EventModel.countDocuments();
    
    if (eventCount === 0) {
      // Create a sample event if none exist
      const sampleEvent = new EventModel({
        title: "Welcome Orientation",
        description: "Join us for the new semester orientation event. Meet faculty and fellow students!",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        location: "Main Auditorium",
        createdBy: "admin001"
      });
      
      await sampleEvent.save();
      return res.status(201).json({ status: "Success", message: "Sample event created" });
    } else {
      return res.json({ status: "Success", message: "Events already exist" });
    }
  } catch (err) {
    console.error("Error creating sample event:", err);
    res.status(500).json({ status: "Error", message: err.message });
  }
});

// ---------- API Routes for Client-Side Resource Management ----------
// These routes provide the data in the format expected by the React components

// Get all resources for a semester
app.get("/resources/:semester", async (req, res) => {
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
    

    // Then add this line where you mount your other routers (near line 383 where you mount other routers)



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
      } else {
        result.videoMaterials[subjectName] = [];
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
        } else {
          result[type][subjectName] = "";
        }
      });
    });
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: "Error", message: err.message });
  }
});

// Add or update a subject for a semester
// -- UPDATE: Resource upload endpoint --



// Delete a subject from a semester
app.delete("/api/subjects", authenticateUser, async (req, res) => {
  try {
    const { semester, name } = req.body;
    
    // Validate user role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ status: "Error", message: "Admin privileges required" });
    }
    
    // Delete subject
    await SubjectModel.findOneAndDelete({ semester, name });
    
    // Delete all resources for this subject in this semester
    await ResourceModel.deleteMany({ semester, subject: name });
    
    res.json({ status: "Success", message: "Subject and all associated resources deleted" });
  } catch (err) {
    res.status(500).json({ status: "Error", message: err.message });
  }
});

// Direct resource upload endpoint
// Replace the duplicate upload endpoint in index.js with this:

app.post("/api/resources/upload", authenticateUser, upload.single('file'), async (req, res) => {
  try {
    const { semester, subject, resourceType } = req.body;
    
    console.log("Upload request received:", {
      semester, 
      subject, 
      resourceType,
      file: req.file ? `Received (${req.file.originalname})` : 'None',
      user: req.user ? `${req.user.registerno} (${req.user.role})` : 'Not authenticated'
    });
    
    // Validate required fields
    if (!semester || !subject || !resourceType) {
      return res.status(400).json({ status: "Error", message: "Semester, subject, and resource type are required" });
    }
    
    // Validate user role for security
    if (req.user.role !== 'admin') {
      return res.status(403).json({ status: "Error", message: "Admin privileges required" });
    }
    
    // Check if subject exists, create if it doesn't
    let subjectDoc = await SubjectModel.findOne({ semester, name: subject });
    if (!subjectDoc) {
      subjectDoc = await SubjectModel.create({ semester, name: subject });
    }
    
    // Handle different resource types
    if (resourceType === 'videoMaterials') {
      const { channel, topics } = req.body;
      
      if (!channel || !topics) {
        return res.status(400).json({ status: "Error", message: "Channel and topics are required for video materials" });
      }
      
      // Create new video material
      const resource = await ResourceModel.create({
        semester,
        subject,
        resourceType,
        channel,
        topics: topics.split(',').map(t => t.trim())
      });
      
      res.status(201).json({ status: "Success", resource });
    } else {
      // For notes and books, a file is required
      if (!req.file) {
        return res.status(400).json({ status: "Error", message: "File is required" });
      }
      
      // Build file URL
      const fileUrl = `/uploads/semester${semester}/${resourceType}/${req.file.filename}`;
      
      // Check if resource already exists
      let resource = await ResourceModel.findOne({ semester, subject, resourceType });
      
      if (resource) {
        // If resource exists, delete the old file and update
        if (resource.fileUrl) {
          try {
            const oldFilePath = path.join(__dirname, resource.fileUrl);
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath); // Delete old file
            }
          } catch (fileErr) {
            console.error("Error deleting old file:", fileErr);
            // Continue even if file deletion fails
          }
        }
        resource.fileName = req.file.originalname;
        resource.fileUrl = fileUrl;
        resource.updatedAt = Date.now();
        await resource.save();
      } else {
        // Create new resource
        resource = await ResourceModel.create({
          semester,
          subject,
          resourceType,
          fileName: req.file.originalname,
          fileUrl
        });
      }
      
      res.status(201).json({ status: "Success", resource });
    }
  } catch (err) {
    console.error("Error uploading resource:", err);
    res.status(500).json({ status: "Error", message: err.message });
  }
});
// Delete resource endpoint
app.delete("/api/resources/delete", authenticateUser, async (req, res) => {
  try {
    const { semester, subject, resourceType } = req.body;
    
    // Validate user role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ status: "Error", message: "Admin privileges required" });
    }
    
    // Find the resource
    const resource = await ResourceModel.findOne({ semester, subject, resourceType });
    
    if (!resource) {
      return res.status(404).json({ status: "Error", message: "Resource not found" });
    }
    
    // If it's a file resource, delete the file
    if ((resourceType === 'notes' || resourceType === 'books') && resource.fileUrl) {
      const filePath = path.join(__dirname, resource.fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    // Delete the resource from database
    await ResourceModel.deleteOne({ _id: resource._id });
    
    res.json({ status: "Success", message: "Resource deleted successfully" });
  } catch (err) {
    console.error("Error deleting resource:", err);
    res.status(500).json({ status: "Error", message: err.message });
  }
});


// Ensure static files are served correctly
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import and use the question paper routes
app.use('/question-papers', questionPaperRouter);


// Import routes
// const cgpaRoutes = require('./routes/cgpaRoutes');

// Initialize Express app


// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection


// Routes
app.use('/api', cgpaRoutes);

// Basic route for testing
app.get('/', (req, res) => {
  res.send('CGPA Calculator API is running');
});

// admin

// In your index.js (main server file)

// Import the events routes


// Auth middleware for protected routes
const authMiddleware = (req, res, next) => {
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // If no auth header, allow access as a "public" user
      req.user = { role: 'public' };
      return next();
    }
    
    // Extract credentials from auth header - format: "Bearer registerno:role"
    const credentials = authHeader.split(' ')[1];
    const [registerno, role] = credentials.split(':');
    
    if (!registerno) {
      return res.status(401).json({ 
        status: 'Error', 
        message: 'Authentication failed. Invalid format.' 
      });
    }
    
    // Set user info in request object
    req.user = {
      registerno,
      role: role || 'student' // Default to 'student' if no role provided
    };
    
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(401).json({ 
      status: 'Error', 
      message: 'Authentication failed.' 
    });
  }
};

// Apply auth middleware to all API routes


// Set up events routes
app.use('/api/events', eventsRoutes);

// Add the following code to serve uploaded images
app.use('/uploads/events', express.static(path.join(__dirname, 'uploads/events')));

// Optional: Default route for non-existing images
app.get('/images/Upcoming_event.jpg', (req, res) => {
  // Serve default image if exists, otherwise generate placeholder
  const defaultImagePath = path.join(__dirname, 'public/images/Upcoming_event.jpg');
  
  if (fs.existsSync(defaultImagePath)) {
    res.sendFile(defaultImagePath);
  } else {
    // Redirect to a placeholder service or send a default image from your server
    res.redirect('/api/placeholder/1200/630');
  }
});



// ---------- Server Listen ----------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});