// routes/question-paper-routes.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import QuestionPaperModel from '../models/questionPaper.js';

const router = express.Router();

// Configure multer for file uploads
// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { year, semester } = req.body;
    // Use just the semester number for the directory name
    const dir = path.join('uploads', 'question-papers', year, semester.toString());
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const { subject, examType } = req.body;
    const sanitizedSubject = subject.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedExamType = examType.replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${sanitizedSubject}_${sanitizedExamType}_${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file size limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  }
});

// Get all question papers structured for display
router.get('/', async (req, res) => {
  try {
    const papers = await QuestionPaperModel.find().sort({ year: -1, semester: 1, subject: 1 });
    
    // Format data into the expected structure:
    // { year: { semester: { subject: { examType: paperInfo } } } }
    const formattedData = {};
    
    papers.forEach(paper => {
      const { year, semester, subject, examType, filePath, fileName, _id } = paper;
      
      // Initialize nested structure if it doesn't exist
      if (!formattedData[year]) formattedData[year] = {};
      if (!formattedData[year][semester]) formattedData[year][semester] = {};
      if (!formattedData[year][semester][subject]) formattedData[year][semester][subject] = {};
      
      // Add paper info
      formattedData[year][semester][subject][examType] = {
        id: _id,
        filePath: filePath,
        fileName: fileName
      };
    });
    
    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching question papers:', error);
    res.status(500).json({ message: 'Failed to fetch question papers' });
  }
});

// Upload a new question paper
// Modify this part in the question-paper-routes.js file's upload endpoint
// Update the upload function to store consistent paths
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { year, semester, subject, examType, registerno } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Store a consistent path format - use a relative path that will work with the download endpoint
    const relativePath = path.join(
      'uploads',
      'question-papers',
      year,
      `semester${semester}`,
      req.file.filename
    ).replace(/\\/g, '/');
    
    console.log('Storing file path as:', relativePath);
    
    // Check if a paper with the same criteria already exists
    const existingPaper = await QuestionPaperModel.findOne({
      year,
      semester,
      subject,
      examType
    });
    
    if (existingPaper) {
      // If paper exists, update it
      existingPaper.filePath = relativePath;
      existingPaper.fileName = req.file.originalname;
      existingPaper.uploadedBy = registerno;
      existingPaper.uploadDate = new Date();
      await existingPaper.save();
      
      res.status(200).json({
        message: 'Question paper updated successfully',
        paper: existingPaper
      });
    } else {
      // Create new paper
      const newPaper = new QuestionPaperModel({
        year,
        semester: parseInt(semester),
        subject,
        examType,
        filePath: relativePath,
        fileName: req.file.originalname,
        uploadedBy: registerno
      });
      
      await newPaper.save();
      
      res.status(201).json({
        message: 'Question paper uploaded successfully',
        paper: newPaper
      });
    }
  } catch (error) {
    console.error('Error uploading question paper:', error);
    res.status(500).json({ message: 'Failed to upload question paper' });
  }
});


// Add this route to fix existing paths in the database
router.get('/fix-paths', async (req, res) => {
  try {
    // Find all papers in the database
    const papers = await QuestionPaperModel.find();
    const results = [];
    
    for (const paper of papers) {
      // Original path
      const originalPath = paper.filePath;
      
      // Fix the path by removing leading slash if present
      let fixedPath = originalPath;
      if (fixedPath.startsWith('/')) {
        fixedPath = fixedPath.substring(1);
        
        // Update the paper
        paper.filePath = fixedPath;
        await paper.save();
        
        results.push({
          id: paper._id,
          original: originalPath,
          fixed: fixedPath,
          status: 'fixed'
        });
      } else {
        results.push({
          id: paper._id,
          path: originalPath,
          status: 'unchanged'
        });
      }
    }
    
    res.json({
      message: 'Path fixing complete',
      total: papers.length,
      fixed: results.filter(r => r.status === 'fixed').length,
      unchanged: results.filter(r => r.status === 'unchanged').length,
      results
    });
    
  } catch (error) {
    console.error('Error fixing paths:', error);
    res.status(500).json({ message: 'Failed to fix paths' });
  }
});

// Add a route to download files directly
// Fix for the download endpoint in question-paper-routes.js
// Enhanced download endpoint in question-paper-routes.js
// Replace the existing download endpoint with this improved version
router.get('/download/:id', async (req, res) => {
  try {
    const paper = await QuestionPaperModel.findById(req.params.id);
    
    if (!paper) {
      return res.status(404).json({ message: 'Question paper not found' });
    }
    
    console.log('Paper found:', paper);
    
    // Remove the leading slash if present
    const sanitizedPath = paper.filePath.startsWith('/') ? paper.filePath.substring(1) : paper.filePath;
    
    // Construct path based on actual directory structure
    const fileName = path.basename(sanitizedPath);
    const correctPath = path.join(
      process.cwd(),
      'uploads',
      'question-papers',
      paper.year.toString(),
      paper.semester.toString(), // Use just the number (1, 2, etc.) instead of "semester1"
      fileName
    );
    
    console.log('Attempting to find file at:', correctPath);
    
    if (fs.existsSync(correctPath)) {
      console.log('File found at:', correctPath);
      return res.download(correctPath, paper.fileName);
    }
    
    // If the file isn't found, check for similarly named files in the folder
    const semesterDir = path.join(
      process.cwd(),
      'uploads',
      'question-papers',
      paper.year.toString(),
      paper.semester.toString()
    );
    
    if (fs.existsSync(semesterDir)) {
      console.log('Searching for similar files in:', semesterDir);
      const files = fs.readdirSync(semesterDir);
      
      // Look for files with similar names (ignoring exact timestamps)
      const subjectPart = paper.subject.replace(/[^a-zA-Z0-9]/g, '_');
      const examTypePart = paper.examType.replace(/[^a-zA-Z0-9]/g, '_');
      
      const similarFile = files.find(file => 
        file.includes(subjectPart) && file.includes(examTypePart)
      );
      
      if (similarFile) {
        const similarFilePath = path.join(semesterDir, similarFile);
        console.log('Similar file found:', similarFilePath);
        return res.download(similarFilePath, paper.fileName);
      }
    }
    
    return res.status(404).json({ 
      message: 'File not found on server',
      paperDetails: {
        year: paper.year,
        semester: paper.semester,
        subject: paper.subject,
        examType: paper.examType
      },
      storedPath: paper.filePath,
      attemptedPath: correctPath
    });
    
  } catch (error) {
    console.error('Error downloading question paper:', error);
    res.status(500).json({ message: 'Failed to download question paper' });
  }
});

// Add this utility endpoint to your question-paper-routes.js file
// This is for troubleshooting purposes

router.get('/diagnose-paths', async (req, res) => {
  try {
    // Find all papers in the database
    const papers = await QuestionPaperModel.find();
    
    // Create an array to store results
    const results = [];
    
    // Check each paper's file path
    for (const paper of papers) {
      const diagnosis = {
        id: paper._id,
        fileName: paper.fileName,
        storedPath: paper.filePath,
        exists: false,
        resolvedPath: '',
        possibleFix: ''
      };
      
      // Try different path resolution strategies
      const pathCandidates = [
        path.resolve(process.cwd(), paper.filePath),
        path.resolve(paper.filePath),
        path.resolve(process.cwd(), 'uploads', paper.filePath.replace(/^uploads[\/\\]?/, '')),
        paper.filePath.startsWith('/') ? path.resolve(process.cwd(), paper.filePath.substring(1)) : null
      ].filter(Boolean);
      
      // Check if any of these paths exist
      for (const candidate of pathCandidates) {
        if (fs.existsSync(candidate)) {
          diagnosis.exists = true;
          diagnosis.resolvedPath = candidate;
          break;
        }
      }
      
      // Suggest a fix based on your file system structure
      if (!diagnosis.exists) {
        // Check if any file with similar name exists in question papers directory
        const questionPapersDir = path.resolve(process.cwd(), 'uploads', 'question-papers');
        let foundPath = '';
        
        // Walk through the question-papers directory to find the file
        if (fs.existsSync(questionPapersDir)) {
          const walkDir = (dir) => {
            const files = fs.readdirSync(dir);
            for (const file of files) {
              const filePath = path.join(dir, file);
              const stat = fs.statSync(filePath);
              if (stat.isDirectory()) {
                walkDir(filePath);
              } else if (file.includes(paper.fileName.split('.')[0]) || 
                         file.includes(paper.subject.replace(/[^a-zA-Z0-9]/g, '_'))) {
                foundPath = filePath;
                break;
              }
            }
          };
          
          try {
            walkDir(questionPapersDir);
          } catch (err) {
            console.log('Error walking directory:', err);
          }
          
          if (foundPath) {
            diagnosis.possibleFix = foundPath.replace(/\\/g, '/').replace(process.cwd().replace(/\\/g, '/'), '');
          }
        }
      }
      
      results.push(diagnosis);
    }
    
    // Respond with the diagnosis results
    res.json({
      totalPapers: papers.length,
      workingPaths: results.filter(r => r.exists).length,
      brokenPaths: results.filter(r => !r.exists).length,
      details: results
    });
    
  } catch (error) {
    console.error('Error diagnosing paths:', error);
    res.status(500).json({ message: 'Failed to diagnose paths' });
  }
});

// Add this endpoint to fix broken paths
router.post('/fix-paths', async (req, res) => {
  try {
    // Get the list of path fixes from the request body
    const { fixes } = req.body;
    
    if (!fixes || !Array.isArray(fixes)) {
      return res.status(400).json({ message: 'Invalid fixes data' });
    }
    
    const results = [];
    
    // Apply each fix
    for (const fix of fixes) {
      const { id, newPath } = fix;
      
      if (!id || !newPath) {
        results.push({
          id,
          success: false,
          message: 'Missing id or newPath'
        });
        continue;
      }
      
      try {
        // Find the paper by ID
        const paper = await QuestionPaperModel.findById(id);
        
        if (!paper) {
          results.push({
            id,
            success: false,
            message: 'Paper not found'
          });
          continue;
        }
        
        // Update the path
        paper.filePath = newPath;
        await paper.save();
        
        results.push({
          id,
          success: true,
          message: 'Path updated successfully'
        });
      } catch (err) {
        results.push({
          id,
          success: false,
          message: err.message
        });
      }
    }
    
    res.json({
      totalFixesAttempted: fixes.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      details: results
    });
    
  } catch (error) {
    console.error('Error fixing paths:', error);
    res.status(500).json({ message: 'Failed to fix paths' });
  }
});

export default router;