// routes/cgpaRoutes.js - API routes for CGPA calculator


import express from 'express';
import CGPAProfile from '../models/CGPAProfile.js';


const router = express.Router();


// Save or update CGPA profile
router.post('/saveCGPA', async (req, res) => {
  try {
    const { userId, userName, semesters, cgpa, totalCredits } = req.body;
    
    // Validate required fields
    if (!userId || !userName || !semesters) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Check if profile already exists
    const existingProfile = await CGPAProfile.findOne({ userId });

    if (existingProfile) {
      // Update existing profile
      existingProfile.userName = userName;
      existingProfile.semesters = semesters;
      existingProfile.cgpa = cgpa;
      existingProfile.totalCredits = totalCredits;
      existingProfile.timestamp = new Date();

      await existingProfile.save();
      return res.status(200).json({ 
        success: true, 
        message: 'Profile updated successfully',
        profile: existingProfile
      });
    } else {
      // Create new profile
      const newProfile = new CGPAProfile({
        userId,
        userName,
        semesters,
        cgpa,
        totalCredits
      });

      await newProfile.save();
      return res.status(201).json({ 
        success: true, 
        message: 'Profile created successfully',
        profile: newProfile
      });
    }
  } catch (error) {
    console.error('Error saving CGPA profile:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while saving profile',
      error: error.message 
    });
  }
});

// Get all saved profiles (simplified data for dropdown)
router.get('/getSavedProfiles', async (req, res) => {
  try {
    const profiles = await CGPAProfile.find({}, 'userId userName cgpa timestamp');
    
    const formattedProfiles = profiles.map(profile => ({
      id: profile.userId,
      name: profile.userName,
      cgpa: profile.cgpa,
      timestamp: profile.timestamp
    }));

    return res.status(200).json(formattedProfiles);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching profiles',
      error: error.message 
    });
  }
});

// Get specific profile by userId
router.get('/getProfile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const profile = await CGPAProfile.findOne({ userId });
    
    if (!profile) {
      return res.status(404).json({ 
        success: false, 
        message: 'Profile not found' 
      });
    }

    return res.status(200).json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching profile',
      error: error.message 
    });
  }
});

// Delete a profile
router.delete('/deleteProfile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await CGPAProfile.deleteOne({ userId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Profile not found' 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Profile deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting profile:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while deleting profile',
      error: error.message 
    });
  }
});



export default router;