const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
const User = require('./models/user');
const Post = require('./models/post');
const Comment = require('./models/comment');
const Like = require('./models/like');
const Follow = require('./models/follow');

const multer = require('multer');

const app = express();

mongoose.connect('mongodb://localhost:27017/social_media');

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const port = 5214;

// Session configuration
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false
}));

// Middleware to make user data available in all views
app.use((req, res, next) => {
    res.locals.currentUser = req.session.userId ? req.session.userId : null;
    next();
});


// Middleware to make user data available in all routes
app.use(async (req, res, next) => {
    if (req.session.userId) {
        try {
            req.user = await User.findById(req.session.userId);
        } catch (error) {
            console.error('Error fetching user from session:', error);
        }
    }
    next();
});



// Middleware to protect routes
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Routes
app.get('/', async (req, res) => {
    const posts = await Post.find().populate('userId').populate({
        path: 'comments',
        populate: { path: 'userId' }
    });

    // Add like counts to each post
    for (let post of posts) {
        post.likes = await Like.find({ postId: post._id });
      }

    res.render('index', { posts });
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, email, password: hashedPassword });
        await user.save();
        req.session.userId = user._id;
        res.redirect('/');
    } catch (error) {
        console.error('Error registering user:', error);
        res.redirect('/register');
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userId = user._id;
            res.redirect('/');
        } else {
            res.redirect('/login');
        }
    } catch (error) {
        console.error('Error logging in:', error);
        res.redirect('/login');
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error logging out:', err);
        }
        res.redirect('/login');
    });
});


// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Handle profile edit
app.post('/profile/edit', isAuthenticated, upload.single('profilePicture'), async (req, res) => {
    try {
        const { bio } = req.body;
        const profilePicture = req.file ? '/uploads/' + req.file.filename : undefined;
        
        const updateData = { bio };
        if (profilePicture) {
            updateData.profilePicture = profilePicture;
        }

        await User.findByIdAndUpdate(req.session.userId, updateData);
        res.redirect('/profile');
    } catch (error) {
        console.error('Error updating profile:', error);
        res.redirect('/profile');
    }
});

// Fetch other users to display in the profile sidebar
app.get('/profile', isAuthenticated, async (req, res) => {
    try {
        
        const user = await User.findById(req.session.userId).populate('followers').populate('following').populate('posts');
        const users = await User.find({ _id: { $ne: req.session.userId } });
        const followedUsers = await Follow.find({ follower: req.session.userId }).select('following');
        const followedUserIds = followedUsers.map(follow => follow.following.toString());

        // Ensure posts is an empty array if not already defined
        user.posts = user.posts || [];

        const isOwnProfile = true;  // This is the user's own profile
        const isFollowing = false;  // Users cannot follow themselves

        res.render('profile', { user, isOwnProfile, isFollowing, users, followedUsers: followedUserIds });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.redirect('/');
    }
});


// Route to display another user's profile
app.get('/users/:userId/profile', isAuthenticated, async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await User.findById(userId).populate('posts');
        const isFollowing = await Follow.exists({ follower: req.session.userId, following: userId });

        // Determine if the logged-in user is viewing their own profile
        const isOwnProfile = req.session.userId === userId;

        // Ensure posts is an empty array if not already defined
        user.posts = user.posts || [];

        res.render('profile', { user, isOwnProfile, isFollowing });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.redirect('/');
    }
});



// Additional routes for creating posts, comments, likes, etc.

// Create a new post
app.post('/posts', isAuthenticated, async (req, res) => {
    const { content } = req.body;
    try {
        const post = new Post({
            content,
            userId: req.session.userId,
            createdAt: new Date(),
        });
        await post.save();
        res.redirect('/');
    } catch (error) {
        console.error('Error creating post:', error);
        res.redirect('/');
    }
});

// Create a new comment on a post
app.post('/posts/:postId/comments', isAuthenticated, async (req, res) => {
    const { postId } = req.params;
    const { text } = req.body;
    try {
        const comment = new Comment({
            text,
            userId: req.session.userId,
            postId,
            createdAt: new Date(),
        });
        await comment.save();
        
        // Update the post with the new comment
        const post = await Post.findById(postId);
        post.comments.push(comment._id);
        await post.save();
        
        res.redirect('/');
    } catch (error) {
        console.error('Error creating comment:', error);
        res.redirect('/');
    }
});



// Like or unlike a post
app.post('/posts/:postId/like', isAuthenticated, async (req, res) => {
    const { postId } = req.params;
    const userId = req.session.userId; // Or however you're managing user sessions

    try {
        const existingLike = await Like.findOne({ userId, postId });

        if (existingLike) {
            // If the like exists, remove it (unlike)
            await Like.deleteOne({ _id: existingLike._id });
        } else {
            // If no like exists, add a new one
            const newLike = new Like({ userId, postId });
            await newLike.save();
        }

        res.redirect('/'); // Redirect to homepage or another appropriate route
    } catch (error) {
        console.error('Error handling like/unlike:', error);
        res.redirect('/'); // Handle errors gracefully
    }
});



app.post('/follow/:userId', isAuthenticated, async (req, res) => {

    try {
        const followerId = req.user._id; // Use session ID
        const followingId = req.params.userId;
        // Check if the follow relationship already exists
        const existingFollow = await Follow.findOne({ follower: followerId, following: followingId });
        if (existingFollow) {
            return res.json({ success: false, message: 'Already following this user.' });
        }

        // Create a new follow relationship
        await Follow.create({ follower: followerId, following: followingId });

        // Add to user's following list
        await User.findByIdAndUpdate(followerId, { $addToSet: { following: followingId } });
        
        // Add to followed user's followers list
        await User.findByIdAndUpdate(followingId, { $addToSet: { followers: followerId } });

        res.json({ success: true });
    } catch (error) {
        console.error('Error following user:', error);
        res.json({ success: false });
    }
});

app.post('/unfollow/:userId', isAuthenticated, async (req, res) => {
    const followerId = req.user._id; // Use session ID
    const followingId = req.params.userId;

    try {
        // Remove the follow relationship
        await Follow.deleteOne({ follower: followerId, following: followingId });

        // Remove from user's following list
        await User.findByIdAndUpdate(followerId, { $pull: { following: followingId } });
        
        // Remove from followed user's followers list
        await User.findByIdAndUpdate(followingId, { $pull: { followers: followerId } });

        res.json({ success: true });
    } catch (error) {
        console.error('Error unfollowing user:', error);
        res.json({ success: false });
    }
});

app.get('/profile/counts', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId).populate('followers following').exec();
        
        if (!user) {
            return res.json({ success: false, message: 'User not found.' });
        }
        
        res.json({
            success: true,
            followersCount: user.followers.length,
            followingCount: user.following.length
        });
    } catch (error) {
        console.error('Error fetching counts:', error);
        res.json({ success: false, message: 'Failed to fetch counts.' });
    }
});




app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
