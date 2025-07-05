import express from"express"
import bodyParser from "body-parser"
import env from "dotenv"
import axios from "axios"
import session, { Session } from "express-session"
import passport from "passport"
import bcrypt from "bcrypt"
import {Strategy as LocalStrategy} from "passport-local"
import GoogleStrategy from "passport-google-oauth20"
import pg from "pg"

env.config()
const db=new pg.Client({
    user:process.env.db_user,
    password:process.env.db_password,
    host:process.env.db_host,
    port:process.env.db_port,
    database:process.env.db_database
})
db.connect()
const PORT=process.env.PORT || 4000
const saltRounds=parseInt(process.env.SALTROUNDS)
const app=express()
app.use(bodyParser.urlencoded({extended:true}))
app.use(express.static('public'))

app.use(session({
    secret:process.env.Session_secret,
    saveUninitialized:false,
    resave:false,
    cookie:{
        maxAge:1000*60*2
    }
}))

app.use(passport.initialize())
app.use(passport.session())

async function EnsureAuthentication(req,res,next){
    if(req.isAuthenticated()) return next();
    return res.redirect('/login')
}
// app.get("/",(req,res)=>{
//     res.render("register.ejs")
// })

async function getDateFormat(date) {
  const date1 = new Date(date);
  const options = { month: 'long', day: 'numeric', year: 'numeric' };
  const formatted = date1.toLocaleDateString('en-US', options);
  return formatted.replace(",", "");
}


app.get("/",EnsureAuthentication,(req,res)=>{
        res.redirect('/secrets')
})
app.get("/secrets",EnsureAuthentication,async(req,res)=>{
        console.log(req.user)
        try {
    const result = await db.query("SELECT * FROM books");
    res.render("index.ejs", { books: result.rows });
  } catch (err) {
    console.error("Error fetching all books:", err);
    res.status(500).send("Server Error");
  }
 
})

// app.get("/", async (req, res) => {
//   try {
//     const result = await db.query("SELECT * FROM books");
//     res.render("index.ejs", { books: result.rows });
//   } catch (err) {
//     console.error("Error fetching all books:", err);
//     res.status(500).send("Server Error");
//   }
// });

app.get("/book/:id", EnsureAuthentication,async (req, res) => {
  try {
    var ids = req.params.id;
    ids=ids.split('-')
    const id=parseInt(ids[0])
    const userid= parseInt(ids[1]) || 0
    const sessionuserid=req.user.id
    const result = await db.query("SELECT * FROM books WHERE id=$1", [id]);
    if (result.rows.length === 0) return res.status(404).send("Book not found");
    const date = await getDateFormat(result.rows[0].read_date);
    if(userid===sessionuserid){
      res.render("book.ejs", { book: result.rows[0], date,edit:true});
    }else{
         res.render("book.ejs", { book: result.rows[0], date });
    }
 
  } catch (err) {
    console.error("Error fetching book by ID:", err);
    res.status(500).send("Server Error");
  }
});

app.get("/edit/:id",EnsureAuthentication,async(req,res)=>{
  try{
      const id=req.params.id;
       const result = await db.query("SELECT * FROM books WHERE id=$1", [id]);
       if (result.rows.length === 0) return res.status(404).send("Book not found");
      res.render("edit.ejs",{book:result.rows[0]})
       //currently it takes to the new page but we gonna update this soon
    } catch (err) {
    console.error("Error fetching book by ID:", err);
    res.status(500).send("Server Error");
  }
})

app.get("/delete/:id",EnsureAuthentication,async(req,res)=>{
  const id=req.params.id;
  try{
    const result=await db.query("DELETE FROM books WHERE id=$1 RETURNING *;",[id]);
    
    if (result.rows.length === 0) {
      console.log("No book found with that ID");
    } else {
      console.log("Deleted book:", result.rows[0]);
    }
    res.redirect("/profile")
  }catch(err){
    console.error("Error fetching book by ID:", err);
    res.status(500).send("Server Error");
  }
})

app.post("/search",EnsureAuthentication, async (req, res) => {
  try {
    const searchbar = req.body.search;
    const result = await db.query("SELECT * FROM books WHERE title ILIKE $1", [`%${searchbar}%`]);
    res.render("search.ejs", { books: result.rows, searchbar });
  } catch (err) {
    console.error("Error searching books:", err);
    res.status(500).send("Server Error");
  }
});

app.get("/profile",EnsureAuthentication,async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query("SELECT * FROM books WHERE user_id=$1", [userId]);
    res.render("profile.ejs", { books: result.rows ,user:req.user});
  } catch (err) {
    console.error("Error loading profile:", err);
    res.status(500).send("Server Error");
  }
});

app.get("/new",EnsureAuthentication, (req, res) => {
  res.render("newPost.ejs");
});

app.get("/sortByrating",EnsureAuthentication, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM books ORDER BY rating DESC");
    res.render("index.ejs", { books: result.rows, route: 'rating' });
  } catch (err) {
    console.error("Error sorting by rating:", err);
    res.status(500).send("Server Error");
  }
});

app.get("/sortByrecency",EnsureAuthentication, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM books ORDER BY read_date DESC");
    res.render("index.ejs", { books: result.rows, route: 'recency' });
  } catch (err) {
    console.error("Error sorting by recency:", err);
    res.status(500).send("Server Error");
  }
});

app.get("/sortBytypo",EnsureAuthentication, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM books ORDER BY title ASC");
    res.render("index.ejs", { books: result.rows, route: 'typo' });
  } catch (err) {
    console.error("Error sorting by title:", err);
    res.status(500).send("Server Error");
  }
});


app.post("/books/:id",EnsureAuthentication,async(req,res)=>{
  try {
    const id= req.params.id;
    const existing_note=await db.query("SELECT * FROM books WHERE id=$1",[id])

    const title = req.body.title;
    const cover = await axios.get(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}`);
    const cover_id = cover.data.docs[0]?.cover_i ||existing_note.rows[0].cover_id;

    const query = `
  UPDATE books
  SET
    title = $1,
    author = $2,
    why_should = $3,
    note = $4,
    read_date = $5,
    rating = $6,
    cover_id = $7,
    user_id = $8,
    vote = $9
  WHERE id = $10
  RETURNING *;
`;
const values = [
  req.body.title ?? existing_note.rows[0].title,
  req.body.author ?? existing_note.rows[0].author,
  req.body.why_should ?? existing_note.rows[0].why_should,
  req.body.note ?? existing_note.rows[0].note,
  req.body.read_date ?? existing_note.rows[0].read_date,
  req.body.rating ?? existing_note.rows[0].rating,
  cover_id,
  req.body.user_id ?? existing_note.rows[0].user_id,
  req.body.vote ?? existing_note.rows[0].vote,
  id
    ];

    const result = await db.query(query, values);
    const date = await getDateFormat(result.rows[0].read_date);
    res.render("book.ejs", { book: result.rows[0], date });
  } catch (err) {
    console.error("Error updating book notes:", err);
    res.status(500).send("Server Error");
  }
})
app.post("/books",EnsureAuthentication, async (req, res) => {
  try {
    const title = req.body.title;
    const cover = await axios.get(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}`);
    const cover_id = cover.data.docs[0]?.cover_i || 240727;

    const query = `
      INSERT INTO books (
        title, author, why_should, note, read_date, rating, cover_id, user_id, vote
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const values = [
      req.body.title,
      req.body.author,
      req.body.why_should,
      req.body.note,
      req.body.read_date,
      req.body.rating,
      cover_id,
      req.user.id || 1,
      req.body.vote || 0
    ];

    const result = await db.query(query, values);
    const date = await getDateFormat(result.rows[0].read_date);
    res.render("book.ejs", { book: result.rows[0], date });
  } catch (err) {
    console.error("Error adding new book:", err);
    res.status(500).send("Server Error");
  }
});






/////////////////


app.get("/register",(req,res)=>{
    res.render('register.ejs')
})
app.post("/register",async(req,res)=>{
    try{
        const email=req.body.username
        const password=req.body.password
        const name=req.body.name || "mr."
        const user=await db.query("SELECT * FROM users WHERE email=$1;",[email])
        if(user.rows.length>0){
            console.log('user already exists try to sign in ')
           return res.redirect('/')
        }else{
            bcrypt.hash(password,saltRounds,async(err,hash)=>{
                if(err){
                    console.log("something wrong at password hashing ")
                    return res.redirect('/')
                }else{
                    const newuser=await db.query("INSERT INTO users (email,password,name) VALUES ($1,$2,$3) RETURNING *;",[email,hash,name])
                    req.login(newuser.rows[0],(err)=>{
                        if(err) {
                            console.log("register login error",err)
                            return res.redirect('/')
                        }else{
                            return res.redirect('/secrets') //change secrets to home
                        }
                    })
                }
                

            })
        }

    }catch(err){
        console.log("error in register:",err)
        res.redirect('/')
    }
})
app.get('/login',(req,res)=>{
    res.render('login.ejs')
})
//change need secrets to home 
app.post("/login",passport.authenticate('local',{
    successRedirect:'/secrets',
    failureRedirect:'/login'
}))

app.get("/auth/google",passport.authenticate('google',{
    scope:['profile','email']
}))
//change need secrets to home 
app.get("/auth/google/secrets",passport.authenticate('google',{
    successRedirect:'/secrets',
    failureRedirect:'/login'
}))

app.get('/logout',(req,res)=>{
    req.logout((err)=>{
       if(err){ return res.send(err)}
        res.redirect('/')
    })
    
})

passport.use('local',new LocalStrategy(async function verify(username,password,cb){
    try{
        const user=await db.query("SELECT * FROM users WHERE email=$1;",[username])
        if(user.rows.length===0){
            return cb(null,false)
        }else{
            bcrypt.compare(password,user.rows[0].password,async(err,result)=>{
                if(result){
                    return cb(null,user.rows[0])
                }else{
                    return cb(null,false)
                }
            })
        }
    }catch(err){
        return cb(err)
    }
}))

passport.use('google',new GoogleStrategy({
    clientID:process.env.Google_client_id,
    clientSecret:process.env.Google_client_secret,
    callbackURL:process.env.Callbackurl,
                 // userProfileURL:process.env.userprofileurl
},async (accessToken,refreshToken,profile,cb)=>{
    try{
        const user=await db.query("SELECT * FROM users WHERE email=$1;",[profile.emails[0].value])
        if(user.rows.length===0){
            const newuser=await db.query("INSERT INTO users (email,password) VALUES ($1,$2) RETURNING *;",[profile.emails[0].value,"google"])
            if(newuser.rows.length===0){
                return cb(null,false)
            }else{
                return cb(null,newuser.rows[0])
            }
        }else{
            return cb(null,user.rows[0])
        }
    }catch(err){
        return cb(err)
    }
}))



passport.serializeUser((user,cb)=>{
    return cb(null,user.id)
})
passport.deserializeUser(async (id,cb)=>{
    try{
        const result=await db.query("SELECT * FROM users WHERE id =$1;",[id])
        if(result.rows.length===0){
            return cb(null,false)
        }else{
            return cb(null,result.rows[0])
        }
    }catch(err){
        return cb(err)
    }
})

app.listen(PORT,()=>{
    console.log(`server is running on port ${PORT}`)
})