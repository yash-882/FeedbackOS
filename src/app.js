// app
import express from 'express';
import cookieParser from 'cookie-parser';
import globalErrorHandler from './middlewares/globalErrorHandler.js';

const app = express();

// body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

app.use((req, res, next) => {
    if(['POST', 'PUT', 'PATCH'].includes(req.method) && !req.body) {
        req.body = {}
    }
    next();
})

// routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

app.use(globalErrorHandler)

export default app;