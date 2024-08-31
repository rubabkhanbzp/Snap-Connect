const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    content: String,
    imageUrl: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Like' }]
});

const Post = mongoose.model('Post', postSchema);

module.exports = Post;
