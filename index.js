import 'dotenv/config';
import express from 'express';
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
import cors from 'cors';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URL, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db;

// JWT Verify Middleware
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }
  const token = authHeader.split(' ')[1];
  
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: 'Forbidden access' });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    await client.connect();
    db = client.db("booknookDB");
    console.log("✅ You successfully connected to MongoDB!");

    //BOOKS API

    // 1. GET /books 
    app.get('/books', async (req, res) => {
      const result = await db.collection('books').find().sort({ addedDate: -1 }).toArray();
      res.send(result);
    });

    // 2. GET /books/:id 
    app.get('/books/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await db.collection('books').findOne(query);
        res.send(result);
      } catch (error) {
        res.status(400).send({ message: "Invalid Book ID" });
      }
    });

    // 3. POST /books - 
    app.post('/books', async (req, res) => {
      const book = req.body;
      const newBook = {
        ...book,
        totalCopies: Number(book.totalCopies),
        addedDate: new Date()
      };
      const result = await db.collection('books').insertOne(newBook);
      res.send(result);
    });

     // 4. PATCH /books/:id - 
    app.patch('/books/:id', verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedBook = req.body;
        delete updatedBook._id; 
        
        if (updatedBook.totalCopies) {
          updatedBook.totalCopies = Number(updatedBook.totalCopies);
        }

        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: updatedBook };
        const result = await db.collection('books').updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        res.status(400).send({ message: "Failed to update book" });
      }
    });

    // 5. DELETE /books/:id 
    app.delete('/books/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await db.collection('books').deleteOne(query);
        res.send(result);
      } catch (error) {
        res.status(400).send({ message: "Failed to delete book" });
      }
    });

    //BORROWS API 

    // 6. POST /borrows - 
    app.post('/borrows', async (req, res) => {
      try {
        const borrowData = req.body;
        
        // No Double Borrow
        const existingBorrow = await db.collection('borrows').findOne({
          bookId: borrowData.bookId,
          userEmail: borrowData.userEmail
        });

        if (existingBorrow) {
          return res.status(400).send({ message: "You have already borrowed this book!" });
        }

       
        const book = await db.collection('books').findOne({ _id: new ObjectId(borrowData.bookId) });
        
        if (!book) {
          return res.status(404).send({ message: "Book not found!" });
        }

        if (Number(book.totalCopies) <= 0) {
          return res.status(400).send({ message: "This book is currently not available!" });
        }

        const newBorrow = {
          ...borrowData,
          borrowDate: new Date(),
        };
        
      
        await db.collection('books').updateOne(
          { _id: new ObjectId(borrowData.bookId) },
          { $inc: { totalCopies: -1 } }
        );
        
        const result = await db.collection('borrows').insertOne(newBorrow);
        res.send(result);

      } catch (error) {
        console.error("Borrow Error:", error);
        res.status(500).send({ message: "Internal Server Error", error: error.message });
      }
    });

    // 7. GET /borrows 
    app.get('/borrows', async (req, res) => {
      const email = req.query.email;
      const query = { userEmail: email };
      const result = await db.collection('borrows').find(query).toArray();
      res.send(result);
    });

    // 8. DELETE /borrows/:id 
    app.delete('/borrows/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        
        const borrowRecord = await db.collection('borrows').findOne(query);
        
        if (borrowRecord) {
          await db.collection('books').updateOne(
            { _id: new ObjectId(borrowRecord.bookId) },
            { $inc: { totalCopies: 1 } }
          );
          const result = await db.collection('borrows').deleteOne(query);
          res.send(result);
        } else {
          res.status(404).send({ message: 'Borrow record not found' });
        }
      } catch (error) {
        res.status(400).send({ message: "Invalid Borrow ID" });
      }
    });

   
    app.get('/', (req, res) => {
      res.send({ message: `BookNook Server is running!` });
    });

    app.listen(PORT, () => {
      console.log(`🚀 Server is running at ${PORT}`);
    });

  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
  }
}

run().catch(console.dir);