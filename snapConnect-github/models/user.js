const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    profilePicture: String,
    bio: String,
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Add the posts field as an array of ObjectId references to Post
    posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }]
});

const User = mongoose.model('User', userSchema);

module.exports = User;
