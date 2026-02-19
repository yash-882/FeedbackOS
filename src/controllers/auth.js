// user 
import { prisma } from '../server.js';
import { CustomError } from '../utils/classes/customError.js';
import bcrypt from 'bcrypt';
import RedisService from '../utils/classes/redisService.js';
import sendEmail from '../utils/functions/sendMail.js';
import { randomInt } from 'crypto'
import { limitOTPActions, validateSignUpFields } from '../utils/functions/auth.js';

// create user
async function validateUserSignUp(req, res, next) {

  const { name, email, password } = req.body;
  const lowerCaseEmail = email.toLowerCase();

  // validate sign up requirements
  await validateSignUpFields(lowerCaseEmail, password)

  const otp = randomInt(112111, 998999); // Generate a 6-digit OTP

  const redisService = new RedisService(lowerCaseEmail, 'SIGN_UP_OTP');

  // Check and limit OTP requests, returns existing data if within limits, otherwise throws an error
  const allowedRequestLimit = Number(process.env.OTP_REQUEST_LIMIT) || 7;
  const data = await limitOTPActions(redisService, 600, true, allowedRequestLimit);

  // Store for sign-up verification with a TTL of 10 minutes
  if (!data) {
    await redisService.setShortLivedData({ 
      name, 
      otp,  
      password, 
      email: lowerCaseEmail, 
      requestCount: 1, 
      attemptCount: 0 ,
      attemptsExhausted: false
    }, 600);
  }

  // Send OTP to user's email
  // await sendEmail(lowerCaseEmail, 'OTP for FeedbackOS', `Your OTP for completing the sign-up process is: ${otp}. Please use this OTP to complete your registration. This OTP will expire in 5 minutes.`);

  res.status(201).json({
    status: 'success',
    message: 'OTP sent to email for verification. Please complete the sign-up process within 5 minutes.'
  });
}

async function completeUserSignUp(req, res, next) {
  const { email, otp } = req.body;
  const lowerCaseEmail = email.toLowerCase();

  const redisService = new RedisService(lowerCaseEmail, 'SIGN_UP_OTP');

  const storedData = await redisService.getData();

  if (!storedData) {
    return next(new CustomError('OTP expired or invalid. Please request a new OTP.', 400));
  }

  if (storedData.otp !== otp) {
    const allowedAttemptLimit = Number(process.env.OTP_ATTEMPT_LIMIT) || 5;

    // Increment OTP attempt count and check limits
    await limitOTPActions(redisService, 600, false, allowedAttemptLimit); // Increment attempt count

    return next(new CustomError('Invalid OTP. Please try again.', 400));
  }

  // If OTP is valid, proceed to create the user
  const { name, email: storedEmail, password } = storedData;
  const hashedPassword = await bcrypt.hash(password, 12); // hashed password

  const newUser = await prisma.user.create({
    data: {
      name,
      email: storedEmail,
      password: hashedPassword,
      role: 'user' // can be changed after sign-up based on requirements (except Admin role)
    }
  });

  // Remove the OTP data from Redis after successful sign-up
  await redisService.deleteData();

  res.status(201).json({
    status: 'success',
    message: 'User created successfully.',
    user: newUser
  });

}

export { validateUserSignUp, completeUserSignUp };