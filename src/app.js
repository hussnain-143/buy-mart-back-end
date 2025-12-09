import express from "express";


import {ConnectDB} from "./db/connectdb.js";

const app = express();

export const RunServer = async () => {
  const Port = process.env.PORT || 5000;

  const connect = await ConnectDB()

  if (!connect) return;

  app.listen(Port, () => {
    console.log(`App is running on URL: http://localhost:${Port}`);
  });
};
