// server/routes/timetable.js
import express from 'express';
import TimetableModel from '../models/timetable.js';

const router = express.Router();

// Get all timetable data
router.get('/', async (req, res) => {
  try {
    const allEntries = await TimetableModel.find();
    const structured = {};
    allEntries.forEach(({ day, time, content }) => {
      if (!structured[day]) structured[day] = {};
      structured[day][time] = content;
    });
    res.json(structured);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save or update a cell
router.post('/', async (req, res) => {
  const { day, time, content } = req.body;
  try {
    await TimetableModel.findOneAndUpdate(
      { day, time },
      { content },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a cell
router.delete('/', async (req, res) => {
  const { day, time } = req.body;
  try {
    await TimetableModel.deleteOne({ day, time });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
