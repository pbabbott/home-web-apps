import express from 'express'
import { config } from "../config";
import { router } from "./router";

export const configureExpressApp = () => {
    const app = express()
  
    app.use(router)
    
    const { port } = config
    
    const server = app.listen(port, () => {
      console.log(`Listening at http://localhost:${port}/api`);
    });
    
    server.on('error', console.error);
}
  
  