const mongoose = require('mongoose');

const NewsArticleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    excerpt: String,
    body: { type: String, required: true },
    published: { type: Boolean, default: false },
    publishedAt: { type: Date, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('NewsArticle', NewsArticleSchema);
