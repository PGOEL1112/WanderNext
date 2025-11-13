const mongoose = require("mongoose");
const initdata = require("./data.js");
const  Listing = require("../models/listing.js");


//MONGODB CONNECTION 
const MONGO_URL = "mongodb://127.0.0.1:27017/WanderNext";
main()
    .then((res) => {
        console.log("✅ MONGODB IS CONNECTED SUCESSFULLY ! ")
    })
    .catch((err) => {
        console.log("SOmething was occured Wrong !!")
    });
 
async function main(){
    await mongoose.connect(MONGO_URL);
};


// Initializing DATABASE 

const initDB = async () => {
    await Listing.deleteMany({});
    await Listing.insertMany(initdata.data);
    console.log("Data Was Initialized Sucessfully ✅ ");
};

initDB().then(() => mongoose.connection.close());;