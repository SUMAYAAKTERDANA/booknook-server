# BookNook Server API

This is the backend API for the BookNook online library, built with Express.js and MongoDB.

## API Endpoints
- `GET /books` - Get all books
- `GET /books/:id` - Get a specific book
- `POST /books` - Add a new book (Protected)
- `PATCH /books/:id` - Update a book (Protected)
- `DELETE /books/:id` - Delete a book (Protected)
- `POST /borrows` - Borrow a book (Protected)
- `GET /borrows?email=` - Get borrowed books of a user (Protected)
- `DELETE /borrows/:id` - Return a borrowed book (Protected)

## Tech Stack
- Node.js & Express.js
- MongoDB
- JSON Web Tokens (JWT) using `jose` and BetterAuth JWKS