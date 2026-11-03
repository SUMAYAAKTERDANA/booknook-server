import express from 'express'
import { MongoClient } from 'mongodb';
const app = express()
const PORT = 8000
import 'dotenv/config'
import cors from 'cors'


app.use(cors())

const client = new MongoClient(process.env.MONGODB_URL);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

connectToMongoDB()



//http://localhost:8000
app.get('/',(req,res) =>{
    res.send({message:`Server is running fine!`})
})

app.listen(PORT, () =>{
console.log(`Server is running at ${PORT}`);


})