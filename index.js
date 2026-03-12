const express = require('express');
const { getDatabase, set, ref, update, get, child } = require('firebase/database');
const { initializeApp } = require('firebase/app');
const bodyParser = require('body-parser');
const { getAuth, createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const axios = require('axios');
const { OpenAI } = require('openai');
const { getStorage } = require('firebase/storage');
const multer = require('multer');
require('dotenv').config();

const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public/'));
app.use(express.json());

/* ---------- OpenAI Setup ---------- */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ---------- Firebase Setup ---------- */
const firebaseConfig = require('./firebase_config.js');
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const auth = getAuth(firebaseApp);
const storage = getStorage();

const PORT = process.env.PORT || 3000;

/* ---------- Routes ---------- */

app.get('/', (req, res) => {
  onAuthStateChanged(auth, function(user) {
    if (user) {
      res.redirect(`/dashboard/${user.uid}`);
    } else {
      res.render('index');
    }
  });
});

app.get('/signin', (req,res)=>{
  res.render('signin');
});

app.get('/signup', (req,res)=>{
  res.render('signup');
});

app.get('/signout', (req,res)=>{
  signOut(auth)
  .then(()=>{
    res.redirect('/');
  })
  .catch((error)=>{
    console.log(error.message);
    res.redirect('/');
  });
});

/* ---------- Dashboard ---------- */

app.get('/dashboard/:userID', async (req,res)=>{
  try {
    const dbRef = ref(db);
    const data = await get(child(dbRef, `users/${req.params.userID}`));
    const user_data = data.val();

    onAuthStateChanged(auth,function(user){
      if(user){
        res.render('dashboard',{user_data:user_data, uid:req.params.userID});
      } else {
        res.redirect('/signin');
      }
    });

  } catch(err){
    console.log(err);
    res.redirect('/');
  }
});

/* ---------- Recipe Generation ---------- */

app.post('/generate-recipe', async (req,res)=>{
  try{

    const selectedList = req.body.messege;
    const ingredients = selectedList.ingredients.toString();
    const allergies = selectedList.allergies.toString();
    const cuisines = selectedList.cuisine.toString();

    const promptData = `ingredients: ${ingredients}. allergies: ${allergies}. cuisine: ${cuisines}.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages:[
        {
          role:"user",
          content:`${promptData} create a json with parameters: 'dish_name', 'items', 'procedure'. give 3 dishes. only code no other text`
        }
      ],
      max_tokens:2000
    });

    res.status(200).json({
      success:true,
      data: completion.choices[0].message
    });

  } catch(error){
    res.status(400).json({
      success:false,
      error:"Server error"
    });
  }
});

/* ---------- Signup ---------- */

app.post('/signup',(req,res)=>{

  createUserWithEmailAndPassword(auth, req.body.email, req.body.password)
  .then((userCredential)=>{

    const user = userCredential.user;

    const user_data = {
      uid:user.uid,
      email:req.body.email,
      username:req.body.username,
      gender:req.body.gender,
      age:req.body.age,
      last_login:Date.now(),
      selectedList:{
        selectIngredients:'',
        selectAllergies:'',
        selectCuisines:''
      }
    };

    set(ref(db,'users/'+user.uid),user_data);

    res.redirect(`/dashboard/${user.uid}`);

  }).catch((error)=>{
    console.log(error.message);
    res.redirect('/');
  });

});

/* ---------- Signin ---------- */

app.post('/signin',(req,res)=>{

  signInWithEmailAndPassword(auth,req.body.email,req.body.password)
  .then(async(userCredential)=>{

    const user=userCredential.user;

    await update(ref(db,'users/'+user.uid),{
      last_login:Date.now()
    });

    res.redirect(`/dashboard/${user.uid}`);

  }).catch((error)=>{
    console.log(error.message);
    res.redirect('/');
  });

});

/* ---------- 404 ---------- */

app.get('*',(req,res)=>{
  res.status(404).send("Page Not Found");
});

/* ---------- Server ---------- */

app.listen(PORT,"0.0.0.0",()=>{
  console.log(`Server running on port ${PORT}`);
});