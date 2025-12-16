import express from "express";
import cookieParser from "cookie-parser";

import {userRoutes} from "./routes/"

import {ConnectDB} from "./db/connectdb.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser(process.env.COOKIE_SECRET)); 

app.use('api/v1/user',userRoutes);

export const RunServer = async () => {
  const Port = process.env.PORT || 5000;

  const connect = await ConnectDB()

  if (!connect) return;

  app.listen(Port, () => {
    console.log(`App is running on URL: http://localhost:${Port}`);
  });
};
