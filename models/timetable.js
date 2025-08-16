// 



import mongoose from 'mongoose';



const timetableSchema = new mongoose.Schema({
  day: { type: String, required: true },
  time: { type: String, required: true },
  content: { type: String, default: "" }
});

const TimetableModel = mongoose.model("Timetable", timetableSchema);

export default TimetableModel;