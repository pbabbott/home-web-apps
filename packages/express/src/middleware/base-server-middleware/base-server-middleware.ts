import { Express } from 'express';
import morgan from 'morgan';
import cors from 'cors';
import { json, urlencoded } from 'body-parser';

export const configureBaseServerMiddleware = (app: Express) => {
  app
    .disable('x-powered-by')
    .use(morgan('dev'))
    .use(urlencoded({ extended: true }))
    .use(json())
    .use(cors());
};
