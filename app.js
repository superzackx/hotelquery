require('dotenv').config();
const express = require('express');
const app = express();

const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set EJS as the view engine
app.set('view engine', 'ejs');

const axios = require('axios')

const { GoogleGenerativeAI } = require("@google/generative-ai")
const { GoogleAIFileManager } = require("@google/generative-ai/server")

const genAI = new GoogleGenerativeAI(process.env.API_KEY)

let model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    // Set the `responseMimeType` to output JSON
    generationConfig: { responseMimeType: "application/json" }
});

// Routes
app.get('/', async (req, res) => {
    res.render('index');
});

// app.post('/search' , async (req, res) => {

//   const fileManager = new GoogleAIFileManager(process.env.API_KEY);

//   const uploadResult = await fileManager.uploadFile(`./response.txt`, {
//     mimeType: "text/plain",
//     displayName: "HotelCodes",
//   });
  
//   console.log(
//     `Uploaded file ${uploadResult.file.displayName} as: ${uploadResult.file.uri}`,
//   );

//    let query = req.body.q;
//    const axios = require('axios');
//    const options = {
//      method: 'POST',
//      url: 'https://places.googleapis.com/v1/places:searchText',
//      headers: {
//        'Content-Type': 'application/json',
//        'X-Goog-Api-Key': process.env.PLACE_KEY,
//        'X-Goog-FieldMask': 'places.displayName,places.rating,places.formattedAddress,'
//      },
//      data: {
//        textQuery: `${query}`,
//        includedType: 'lodging'
//      }
//    };

//    let hotelCodeArr = [];
//    let formattedArrString;

//   axios(options)
//      .then(async response => {
//         let hotels = []
//         let newHotelArr = response.data.places?.splice(0, 5)
//         newHotelArr.forEach((place) => {
//             hotels.push(place.displayName.text)
//         })
//         let result = await model.generateContent([`You are a travel agent helping a client find hotels. The client's query was: ${query}. The hotels you found are these: ${hotels}. Create a description for each of the hotel for the client specifically adressing why that hotel was picked for the client based on his needs. If the client has specified a type of room, include the exact name of that room of that hotel in the decription. You must also find each hotel's hotel code from the document ${uploadResult.file.uri} as well. Return content in this JSON format strictly: [{displayName: "Exactly same display name", description: "Your description goes here", hotelCode: "The hotel code you found goes here"}]`, {
//           fileData: {
//             fileUri: uploadResult.file.uri,
//             mimeType: uploadResult.file.mimeType,
//           }
//       }
//       ]);
//         let mydata = JSON.parse(result.response.text())
//         mydata.Hotels?.forEach(hotel => {
//             hotelCodeArr.push(hotel.hotelCode)
//         })
//         console.log(hotelCodeArr)
//         formattedArrString = hotelCodeArr.join(',')
//         let newOptions = {
//           method: 'POST',
//           url: 'https://apiwr.tboholidays.com/HotelAPI/Hoteldetails',
//           data: {
//             "Hotelcodes": formattedArrString,
//             "Language": "en"
//           },
//           auth: {
//             username: process.env.TBO_USER,
//             password: process.env.TBO_PASS
//           },
//           headers: {
//             'Content-Type': 'application/json',
//           }
//         }
//         let coolArr = [];
//         axios(newOptions)
//            .then(response => {
//             console.log(response.data)
//             mydata.Hotels?.forEach(async (hotel, index) => {
//               hotel.image = response.data.HotelDetails[index].Images[0]
//               coolArr.push(hotel)
//            })
//            res.render('results', {data: coolArr})
//            })
//         })
// });

app.post('/search', async (req, res) => {
  try {
    const fileManager = new GoogleAIFileManager(process.env.API_KEY);
    const uploadResult = await fileManager.uploadFile(`./response.txt`, {
      mimeType: "text/plain",
      displayName: "HotelCodes",
    });

    console.log(`Uploaded file ${uploadResult.file.displayName} as: ${uploadResult.file.uri}`);

    const query = req.body.q;
    const placesResponse = await axios.post('https://places.googleapis.com/v1/places:searchText', {
      textQuery: query,
      includedType: 'lodging'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.PLACE_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.rating,places.formattedAddress,'
      }
    });

    const hotels = placesResponse.data.places?.slice(0, 5).map(place => place.displayName.text);

    const result = await model.generateContent([`You are a travel agent helping a client find hotels. The client's query was: ${query}. The hotels you found are these: ${hotels}. Create a description for each of the hotel for the client specifically addressing why that hotel was picked for the client based on his needs. If the client has specified a type of room, include the exact name of that room of that hotel in the description. You must also find each hotel's hotel code from the document ${uploadResult.file.uri} as well. Return content in this JSON format strictly: [{displayName: "Exactly same display name", description: "Your description goes here", hotelCode: "The hotel code you found goes here"}]`, {
      fileData: {
        fileUri: uploadResult.file.uri,
        mimeType: uploadResult.file.mimeType,
      }
    }]);

    const mydata = JSON.parse(result.response.text());
    const hotelCodeArr = mydata.Hotels?.map(hotel => hotel.hotelCode) || [];
    const formattedArrString = hotelCodeArr.join(',');

    const hotelDetailsResponse = await axios.post('https://apiwr.tboholidays.com/HotelAPI/Hoteldetails', {
      "Hotelcodes": formattedArrString,
      "Language": "en"
    }, {
      auth: {
        username: process.env.TBO_USER,
        password: process.env.TBO_PASS
      },
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const hotelRatesResponse = await axios.post('https://apiwr.tboholidays.com/HotelAPI/search', {
      "CheckIn": "2024-12-12",
      "CheckOut": "2024-12-13",
      "HotelCodes": formattedArrString,
      "GuestNationality": "AE",
      "PaxRooms": [
          {
              "Adults": 2,
              "Children": 0,
              "ChildrenAges": []
          }
      ],
      "IsDetailedResponse": true
  }, {
      auth: {
        username: process.env.TBO_USER,
        password: process.env.TBO_PASS
      },
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // Create a map of hotel codes to their details
    const hotelDetailsMap = new Map(hotelDetailsResponse.data.HotelDetails.map(hotel => [hotel.HotelCode, hotel]));

    // Combine hotel data with details
    const coolArr = mydata.Hotels?.map(hotel => {
      const details = hotelDetailsMap.get(hotel.hotelCode);
      return {
        ...hotel,
        image: details?.Images[0] || null
      };
    });
    
    let hotelRooms = hotelRatesResponse.data.HotelResult;
    // Iterate through the hotels array
    coolArr.forEach(hotel => {
      let lowestFare = Infinity;
    
      // Find the corresponding hotel in the hotelRooms array
      const hotelData = hotelRooms.find(room => room.HotelCode === hotel.hotelCode);
    
      if (hotelData) {
        // Find the lowest TotalFare for all rooms in this hotel
        hotelData.Rooms.forEach(room => {
          if (room.TotalFare < lowestFare) {
            lowestFare = room.TotalFare;
          }
        });
      }
    
      // Add the lowest TotalFare to the hotel object
      hotel.TotalFare = lowestFare === Infinity ? null : lowestFare;
    });
    
    console.log(coolArr);
    res.render('results', { data: coolArr });

  } catch (error) {
    console.error('Error in search endpoint:', error);
    res.status(500).send('An error occurred while processing your request');
  }
});

//let newNewOptions = {
    //             method: 'POST',
    //             url: 'https://apiwr.tboholidays.com/HotelAPI/search',
    //             data: {
    //               "CheckIn": "2024-09-12",
    //               "CheckOut": "2024-09-13",
    //               "HotelCodes": formattedArrString,
    //               "GuestNationality": "AE",
    //               "PaxRooms": [
    //                   {
    //                       "Adults": 2,
    //                       "Children": 0,
    //                       "ChildrenAges": []
    //                   }
    //               ],
    //               "IsDetailedResponse": true
    //           },
    //           auth: {
    //             username: process.env.TBO_USER,
    //             password: process.env.TBO_PASS
    //           },
    //           headers: {
    //             'Content-Type': 'application/json',
    //           }
    //           }
    //           axios(newNewOptions)
    //            .then(async response => {
    //                 response.data.HotelResult?.forEach((hotel, index) => {
    //                   coolArr[index].rate = hotel.Rooms[0].TotalFare
    //                   finalArr.push(coolArr[index])
    //                   res.json(finalArr)
    //                 })
    //             })
    //  .catch(error => {
    //    console.error(error);
    //  });
// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
