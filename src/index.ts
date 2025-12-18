import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './router';

const app = express();
app.use(express.json());

app.use('/trpc', createExpressMiddleware({
  router: appRouter,
  createContext: () => ({}),
  onError: ({ error, path }) => {
    console.error(`tRPC error on path ${path}:`, error);
  },
}));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`tRPC server listening on port ${port}`);
  console.log(`Access at http://localhost:${port}/trpc`);
});

