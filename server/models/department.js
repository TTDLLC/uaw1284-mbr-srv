const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  code: {
    type: String,
    trim: true,
    default: null
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

departmentSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.models.Department || mongoose.model('Department', departmentSchema);
