import mongoose from 'mongoose';


const studentSchema = new mongoose.Schema({
  name: String,
  registerno:{type:String,unique:true},
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: "student" }
});

const StudentModel = mongoose.model("students",studentSchema)

export default StudentModel;
 