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
    initdata.data = initdata.data.map((obj) => ({...obj, owner : "691863f021840ac64589a4ec"}))
    await Listing.insertMany(initdata.data);
    console.log("Data Was Initialized Sucessfully ✅ ");
};

initDB().then(() => mongoose.connection.close());;