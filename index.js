import 'dotenv/config';
import express from 'express';
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
import cors from 'cors';
import { createRemoteJWKSet, jwtVerify } from 'jose';

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

const JWKS = createRemoteJWKSet(

  new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`)
);

// JWT Verify Middleware 
const verifyJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }
  const token = authHeader.split(' ')[1];
  
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: process.env.BETTER_AUTH_URL,
      audience: process.env.BETTER_AUTH_URL,
    });
    console.log("✅ Decoded User Data:", payload); 
    req.decoded = payload;
    next();
  } catch (err) {
    console.log("❌ JWT Verify Error:", err.message);
    return res.status(403).send({ message: 'Forbidden access' });
  }
};

async function run() {
  try {
    await client.connect();
    db = client.db("booknookDB");
    console.log("✅ You successfully connected to MongoDB!");

    //  BOOKS API 
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

    // 3. POST /books
    app.post('/books', verifyJWT, async (req, res) => {
      console.log("🔥 POST /books hit hoise!");
      const book = req.body;
      const newBook = {
        ...book,
        totalCopies: Number(book.totalCopies),
        addedDate: new Date()
      };
      const result = await db.collection('books').insertOne(newBook);
      res.send(result);
    });

    // 4. PATCH /books/:id
    app.patch('/books/:id', verifyJWT, async (req, res) => {
      try {
        console.log("🔥 PATCH /books hit hoise!");
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
    app.delete('/books/:id', verifyJWT, async (req, res) => {
      try {
        console.log("🔥 DELETE /books hit hoise!");
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await db.collection('books').deleteOne(query);
        res.send(result);
      } catch (error) {
        res.status(400).send({ message: "Failed to delete book" });
      }
    });

    // BORROWS API
    // 6. POST /borrows
    app.post('/borrows', verifyJWT, async (req, res) => {
      console.log("🔥 POST /borrows hit hoise!");
      try {
        const borrowData = req.body;
        
        const existingBorrow = await db.collection('borrows').findOne({
          bookId: borrowData.bookId,
          userEmail: borrowData.userEmail
        });

        if (existingBorrow) {
          return res.status(400).send({ message: "You have already borrowed this book!" });
        }

        const book = await db.collection('books').findOne({ _id: new ObjectId(borrowData.bookId) });
        if (!book || Number(book.totalCopies) <= 0) {
          return res.status(400).send({ message: "This book is currently not available!" });
        }

        const newBorrow = {
          ...borrowData,
          bookId: new ObjectId(borrowData.bookId), 
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

  
    app.get('/borrows', verifyJWT, async (req, res) => {
      console.log("🔥 GET /borrows hit hoise!");
      try {
        const email = req.query.email;
        const tokenEmail = req.decoded?.email || req.decoded?.user?.email;

        if (tokenEmail !== email) {
          return res.status(403).send({ message: 'Forbidden access' });
        }

        const query = { userEmail: email };
        const result = await db.collection('borrows').find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server Error", error: error.message });
      }
    });

   
    app.delete('/borrows/:id', verifyJWT, async (req, res) => {
      try {
        console.log("🔥 DELETE /borrows hit hoise!");
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        
        const borrowRecord = await db.collection('borrows').findOne(query);
        
        if (borrowRecord) {
         
          const bookIdToUpdate = typeof borrowRecord.bookId === 'string' 
            ? new ObjectId(borrowRecord.bookId) 
            : borrowRecord.bookId;

          await db.collection('books').updateOne(
            { _id: bookIdToUpdate },
            { $inc: { totalCopies: 1 } }
          );
          const result = await db.collection('borrows').deleteOne(query);
          res.send(result);
        } else {
          res.status(404).send({ message: 'Borrow record not found' });
        }
      } catch (error) {
        console.error("Delete borrow error:", error);
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