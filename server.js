const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const User = require('./models/user').default;
const Post = require('./models/post');
const  auth  = require('./middleware/auth');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
// const cors = require('cors');


const app = express();



const port = process.env.PORT || 3000;
const mongoUrl = process.env.MONGO_URL || 'mongodb://0.0.0.0:27017/socialapi';

app.use(bodyParser.json());

// // Connect to MongoDB
mongoose.connect(mongoUrl, { useNewUrlParser: true })
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB', error);
    });


app.get("/",(req,res)=>{
    res.send("Hello World");
})



// APIs ENDPOINTS

// User auth 
app.post('/api/auth', async (req, res) => {
    const { email, password } = req.body;
  
    // Find user with given email
    const user = await User.findOne({ email });
  
    // Check if user exists and password is correct
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).send('Invalid email or password');
    }
  
    // Generate JWT token
    const token = jwt.sign({ userId: user.id }, 'secret', { expiresIn: '1h' });
  
    // Return token
    res.send({ token });
  });



  // User follow 
  app.post('/api/follow/:id', auth, async (req, res) => {
    const { id } = req.params;
  
    // Add user to following list
    await User.updateOne({ _id: req.userId }, { $addToSet: { following: id } });
  
    // Add user to followers list
    await User.updateOne({ _id: id }, { $addToSet: { followers: req.userId } });
  
    res.send('User followed successfully');
  });

  
  // User unfollow
  app.post('/api/unfollow/:id', auth, async (req, res) => {
    const { id } = req.params;
  
    // Remove user from following list
    await User.updateOne({ _id: req.userId }, { $pull: { following: id } });
  
    // Remove user from followers list
    await User.updateOne({ _id: id }, { $pull: { followers: req.userId } });
  
    res.send('User unfollowed successfully');
  });

  // get user detail
  app.get('/api/user', auth, async (req, res) => {
    // Get user profile
    const user = await User.findById(req.userId).select('name followers following');
  
    res.send(user);
  });


  // post detail
  app.post('/api/posts', auth, async (req, res) => {
    const { title, description } = req.body;
  
    // Create new post
    const post = new Post({
      title,
      description,
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
    const { id } = req.params;
  
    // Add comment to post
    await Post.updateOne({ _id: id }, { $addToSet: { comments: req.body } });
  
    res.send('Comment added successfully');
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



  // get all posts created by auth user 
  app.get('/api/all_posts', auth, async (req, res) => {
    try {
      const posts = await Post.find({ user: req.user._id }).populate('likes').populate({
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
          desc: post.desc,
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
  




app.listen(port, () => console.log(`Server started on port ${port}`));




