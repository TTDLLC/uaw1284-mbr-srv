const mongoose = require('mongoose');

const slugify = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

const labelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  nameLower: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  slug: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true
  },
  color: {
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

labelSchema.index({ slug: 1 }, { unique: true });

labelSchema.pre('validate', function setLabelDefaults(next) {
  if (this.name) {
    this.name = this.name.trim();
    this.nameLower = this.name.toLowerCase();
    if (!this.slug) {
      this.slug = slugify(this.name);
    }
  }
  next();
});

module.exports = mongoose.models.Label || mongoose.model('Label', labelSchema);
