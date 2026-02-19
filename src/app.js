// app
import express from 'express';
const app = express();

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    if(['POST', 'PUT', 'PATCH'].includes(req.method) && !req.body) {
        req.body = {}
    }
    next();
})

// routes
import authRoutes from './routes/auth.js';
import globalErrorHandler from './middlewares/globalErrorHandler.js';

app.use('/api/auth', authRoutes);

app.use(globalErrorHandler)

export default app;