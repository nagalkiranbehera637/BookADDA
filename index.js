import express from 'express';
import axios from 'axios';
import bodyParser from 'body-parser';
import pg from 'pg';

const db = new pg.Client({
  user: "postgres",
  password: "kiran@637",
  port: 5432,
  database: "Mybooks",
  host: "localhost"
});
db.connect();

const PORT = process.env.PORT || 3000;
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

async function getDateFormat(date) {
  const date1 = new Date(date);
  const options = { month: 'long', day: 'numeric', year: 'numeric' };
  const formatted = date1.toLocaleDateString('en-US', options);
  return formatted.replace(",", "");
}

app.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM books");
    res.render("index.ejs", { books: result.rows });
  } catch (err) {
    console.error("Error fetching all books:", err);
    res.status(500).send("Server Error");
  }
});

app.get("/book/:id", async (req, res) => {
  try {
    var ids = req.params.id;
    ids=ids.split('-')
    const id=parseInt(ids[0])
    const userid= parseInt(ids[1]) || 0
    const sessionuserid=1
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

app.post("/search", async (req, res) => {
  try {
    const searchbar = req.body.search;
    const result = await db.query("SELECT * FROM books WHERE title ILIKE $1", [`%${searchbar}%`]);
    res.render("search.ejs", { books: result.rows, searchbar });
  } catch (err) {
    console.error("Error searching books:", err);
    res.status(500).send("Server Error");
  }
});

app.get("/profile", async (req, res) => {
  try {
    const userId = 1;
    const result = await db.query("SELECT * FROM books WHERE user_id=$1", [userId]);
    res.render("profile.ejs", { books: result.rows });
  } catch (err) {
    console.error("Error loading profile:", err);
    res.status(500).send("Server Error");
  }
});

app.get("/new", (req, res) => {
  res.render("newPost.ejs");
});

app.get("/sortByrating", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM books ORDER BY rating DESC");
    res.render("index.ejs", { books: result.rows, route: 'rating' });
  } catch (err) {
    console.error("Error sorting by rating:", err);
    res.status(500).send("Server Error");
  }
});

app.get("/sortByrecency", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM books ORDER BY read_date DESC");
    res.render("index.ejs", { books: result.rows, route: 'recency' });
  } catch (err) {
    console.error("Error sorting by recency:", err);
    res.status(500).send("Server Error");
  }
});

app.get("/sortBytypo", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM books ORDER BY title ASC");
    res.render("index.ejs", { books: result.rows, route: 'typo' });
  } catch (err) {
    console.error("Error sorting by title:", err);
    res.status(500).send("Server Error");
  }
});

app.post("/books", async (req, res) => {
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
      req.body.user_id || 1,
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
