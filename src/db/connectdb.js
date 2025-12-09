import mongoose from "mongoose";

import { DB_Name } from "../constant.js";

export const ConnectDB = async () => {
  const sub_url = process.env.MONGO_URL;
  const DB_URL = `${sub_url}${DB_Name}`;
  try {
    
    const conn =  await mongoose.connect(DB_URL);
    console.log("MongoDB Connected");

    return conn;

  } catch (error) {
    console.log("Error While Connect MongoDB : ", error);
    process.exit(1);
  }
};
