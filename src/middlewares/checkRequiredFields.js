import { CustomError } from "../utils/classes/customError.js";

// check required fields middleware for express routes
export function checkRequiredFields(requiredFields) {
    return (req, res, next) => {
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) { 
            return next(new CustomError(`Missing required fields: ${missingFields.join(', ')}`, 400));
        }
        next();
    };
}