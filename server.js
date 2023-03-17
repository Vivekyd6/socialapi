const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const User = require('./models/user');
const Post = require('./models/post');
const auth = require('./auth');
const Comments = require('./models/comment');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
// const cors = require('cors');
// require('dotenv').config();

const app = express();
const key = 'Bp2Jj7wMKEKCyaesF4umQSUsN17NT5ZScjN7hxljGTYge97gDtDvDY6wVDSFGBzpZ80a7wEzAFctM5d75g0ONA=='
// console.log(key);
app.use(
  bodyParser.urlencoded({
    extended: false
  })
);

app.use(bodyParser.json());

const port = process.env.PORT || 3000;
const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/socialapi';


// // Connect to MongoDB
mongoose.connect(mongoUrl, { useNewUrlParser: true })
  .then(() => {
    console.log('Connected to MongoDB successfully.');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB', error);
  });


app.get("/", (req, res) => {
  res.send("Hello World");
})



// APIs ENDPOINTS

// User auth 
app.post('/api/auth', async (req, res) => {
  const { email, password } = req.body;
  console.log({ email }, { password });

  try {
    // Find user with given email
    const user = await User.findOne({ email });
    // console.log(user);

    // Check if user exists and password is correct
    // if (!user || !await bcrypt.compare(password, user.password)) {
    //   return res.status(401).send('Invalid email or password');
    // }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id }, key, { expiresIn: '24h' });
    // console.log(token);

    // Return token
    res.send({ token });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});




// User follow 
app.post('/api/follow/:id', auth, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).send('Invalid id parameter');
  }

  try {
    // Add user to following list
    await User.updateOne({ _id: req.userId }, { $addToSet: { following: id } });

    // Add user to followers list
    await User.updateOne({ _id: id }, { $addToSet: { followers: req.userId } });

    res.send('User followed successfully');
    console.log('User followed successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});



// User unfollow
app.post('/api/unfollow/:id', auth, async (req, res) => {
  const { id } = req.params;

  // Remove user from following list
  await User.updateOne({ _id: req.userId }, { $pull: { following: id } });

  // Remove user from followers list
  await User.updateOne({ _id: id }, { $pull: { followers: req.userId } });

  res.send('User unfollowed successfully');
  console.log('User unfollowed successfully');
});

//get user detail

app.get('/api/user/:id', auth, async (req, res) => {
  const { id } = req.params;

  // Get user profile
  const user = await User.findById(id).select('name followers following');
  console.log(user)
  res.send(user);
});



// post detail
app.post('/api/posts', auth, async (req, res) => {
  const { title, description, author } = req.body;

  // Create new post
  const post = new Post({
    title,
    description,
    author,
    createdBy: req.userId,
    createdAt: new Date(),
  });

  await post.save();

  res.send(post);
});

// delete post 
app.delete('/api/posts/:id', auth, async (req, res) => {
  const { id } = req.params;

  // Delete post
  await Post.findByIdAndDelete(id);

  res.send('Post deleted successfully');
});



// post like
app.post('/api/posts/:id/like', auth, async (req, res) => {
  const { id } = req.params;

  // Add like to post
  await Post.updateOne({ _id: id }, { $addToSet: { likes: req.userId } });

  res.send('Post liked successfully');
});



// post unlike 
app.post('/api/posts/:id/unlike', auth, async (req, res) => {
  const { id } = req.params;

  // Remove like from post
  await Post.updateOne({ _id: id }, { $pull: { likes: req.userId } });

  res.send('Post unliked successfully');
});



// add comment to post
app.post('/api/posts/:id/comment', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate input
    if (!id) {
      return res.status(400).send({ message: 'Post ID is required' });
    }
    if (!req.body.text) {
      return res.status(400).send({ message: 'Comment text is required' });
    }
    const postId = req.params.id;
    // Add comment to post
    const post = await Post.findOneAndUpdate(
      { _id: id },
      { $addToSet: { comments: { text: req.body.text, user: po } } },
      { new: true }
    ).populate('comments.user', 'name email -_id');

    if (!post) {
      return res.status(404).send({ message: 'Post not found' });
    }

    res.send({ message: 'Comment added successfully', post });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Server Error' });
  }
});



// delete comment
app.delete('/api/posts/:id/comment/:commentId', auth, async (req, res) => {
  const { id, commentId } = req.params;

  // Delete comment
  await Post.updateOne({ _id: id }, { $pull: { comments: { _id: commentId } } });

  res.send('Comment deleted successfully');
});


// get a single post with its number of likes and comments
app.get('/api/posts/:id', auth, async (req, res) => {
  const postId = req.params.id;

  try {
    const post = await Post.findById(postId).populate('likes').populate({
      path: 'comments',
      populate: {
        path: 'user',
        model: 'User',
        select: 'name email -_id'
      }
    });
    if (!post) {
      return res.status(404).send({ message: 'Post not found' });
    }

    const numLikes = post.likes.length;
    const numComments = post.comments.length;

    const result = {
      id: post._id,
      title: post.title,
      desc: post.desc,
      created_at: post.created_at,
      likes: numLikes,
      comments: numComments > 0 ? post.comments : []
    };

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Server Error' });
  }
});

//get all posts from the auth user

app.get('/api/all_posts', auth, async (req, res) => {
  console.log("all posts created");
  try {
    const posts = await Post.find({ user: req.user && req.user._id }).populate('likes').populate({
      path: 'comments',
      populate: {
        path: 'user',
        model: 'User',
        select: 'name email -_id'
      }
    }).sort({ created_at: -1 });
    const result = posts.map(post => {
      const numLikes = post.likes.length;
      const numComments = post.comments.length;

      return {
        id: post._id,
        title: post.title,
        description: post.description,
        created_at: post.created_at,
        likes: numLikes,
        comments: numComments > 0 ? post.comments : []
      };
    });

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Server Error' });
  }
});










// get all posts created by auth user 

// app.get('/api/all_posts', auth, async (req, res) => {
//   try {
//     const posts = await Post.find({ user: req.user._id })
//       .populate('likes')
//       .populate({
//         path: 'comments',
//         populate: {
//           path: 'user',
//           model: 'User',
//           select: 'name email -_id'
//         }
//       })
//       .sort({ created_at: -1 });

//     const result = posts.map(post => {
//       const numLikes = post.likes.length;
//       const numComments = post.comments.length;

//       return {
//         id: post._id,
//         title: post.title,
//         description: post.description,
//         created_at: post.created_at,
//         likes: numLikes,
//         comments: numComments > 0 ? post.comments : []
//       };
//     });

//     res.send(result);
//   } catch (error) {
//     console.error(error);
//     res.status(500).send({ message: 'Server Error' });
//   }
// });






app.listen(port, () => console.log(`Server started on port ${port}`));




