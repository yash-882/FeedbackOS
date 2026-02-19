// global error handler middleware

function sendDevError(err, res) {
    res.status(err.statusCode || 500).json({
        name: err.name,
        status: err.status || 'error',
        message: err.message,
        isOperational: err.isOperational || false,
        stack: err.stack,
    });
}

export default function globalErrorHandler(err, req, res, next) {
    console.error('Global Error Handler:', err);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    if (process.env.NODE_ENV === 'development') 
        return sendDevError(err, res);

     else 
        res.status(statusCode).json({ message: message });
    
}