CREATE TABLE books (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    why_should TEXT NOT NULL,
    note TEXT NOT NULL,
    read_date DATE,
    rating INT DEFAULT 1,
    cover_id INT NOT NULL,
    user_id INT DEFAULT 1,
    vote INT DEFAULT 0,
    UNIQUE (title, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);


CREATE TABLE users(
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    passkey varchar(10) NOT NULL,
    name TEXT NOT NULL,
);