import { prisma } from "../../server.js";
import { CustomError } from "../classes/customError.js";
import RedisService from "../classes/redisService.js";

// validate sign up fields for user registration
async function validateSignUpFields(email, password) {
const existingUser = await prisma.user.findUnique({ where: { email : email } });

    const isValidEmail = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);

    if (!isValidEmail) {
        throw new CustomError('Invalid email format', 400);
    }

    if (existingUser) {
      throw new CustomError('Email already in use', 400);
    }

    if (password.length < 8) {
        throw new CustomError('Password must be at least 8 characters long', 400);
    }
}

async function limitOTPActions(redisService, ttl = 300, isRequestAttempt, maxLimit=5,) {

    // Validate RedisService instance and parameters
    if(!redisService || !(redisService instanceof RedisService || !redisService.key)) {
        throw new Error('Invalid RedisService instance provided');
    }

    // Validate isRequestAttempt parameter
    if(typeof isRequestAttempt !== 'boolean') {
        throw new Error('Invalid value for isRequestAttempt. Expected a boolean.');
    }

    let actionType = isRequestAttempt ? 'requestCount' : 'attemptCount'

    // redisService contains the unique key for the OTP request (e.g., sign-up:<email>)
    const data = await redisService.getData();

    if(data) {
        const allowedAttemptLimit = Number(process.env.OTP_ATTEMPT_LIMIT) || 5;

        // throw error if limit exceeded for OTP requests or attempts
        if(data[actionType] >= maxLimit) { 
             throw new CustomError(
                `Too many OTP ${actionType === 'requestCount' ? 'requests' : 'attempts'}. Please try again later.`, 429);
        }

        // if otp attempts are exhausted, block further otp requests until the OTP expires
        else if(actionType === 'requestCount' && data.attemptCount >= allowedAttemptLimit) {
            throw new CustomError(
                `Attempts exhausted for this OTP request. Please try again later.`, 429);
        }

        // increment the respective count (requestCount or attemptCount) and update Redis with new count and TTL
        else {
            await redisService.setShortLivedData({
                    ...data, 
                    [actionType]: (data[actionType] || 0) + 1, 
                }, ttl, true
            ); 
        }
    }
    return data;
}

export { validateSignUpFields, limitOTPActions };