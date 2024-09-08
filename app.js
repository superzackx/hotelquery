require('dotenv').config();
const express = require('express');
const app = express();

const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set EJS as the view engine
app.set('view engine', 'ejs');

const { GoogleGenerativeAI } = require("@google/generative-ai")
const genAI = new GoogleGenerativeAI(process.env.API_KEY)

let model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro-latest",
    // Set the `responseMimeType` to output JSON
    generationConfig: { responseMimeType: "application/json" }
});

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.post('/search' , async (req, res) => {
   let query = req.body.q;
   const axios = require('axios');
   const options = {
     method: 'POST',
     url: 'https://places.googleapis.com/v1/places:searchText',
     headers: {
       'Content-Type': 'application/json',
       'X-Goog-Api-Key': process.env.PLACE_KEY,
       'X-Goog-FieldMask': 'places.displayName,places.rating,places.formattedAddress,'
     },
     data: {
       textQuery: `${query}`,
       includedType: 'lodging'
     }
   };
   
   axios(options)
     .then(async response => {
        let hotels = []
        response.data.places?.forEach((place) => {
            hotels.push(place.displayName.text)
        })
        let prompt = `You are a travel agent helping a client find hotels. The client's query was: ${query}. The hotels you found are these: ${hotels}. Create a description for each of the hotel for the client specifically adressing why that hotel was picked for the client based on his needs. If the client has specified a type of room, include the exact name of that room of that hotel in the decription.. Return in this JSON format: [{displayName: "Exactly same display name", description: "Your description goes here"}]`
        let result = await model.generateContent(prompt);
        let mydata = JSON.parse(result.response.text())
        response.data.places = response.data.places.map((place, index) => {
            place.description = mydata[index].description
            return place
        }
        )
        res.render("results", {data: response.data.places, query: query})
     })
     .catch(error => {
       console.error(error);
     });
});
// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});