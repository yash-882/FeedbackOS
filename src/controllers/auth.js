// user 
import { prisma } from '../server.js';
import { CustomError } from '../utils/classes/customError.js';
import bcrypt from 'bcrypt';
import RedisService from '../utils/classes/redisService.js';
import { randomInt } from 'crypto'
import { bcryptCompare, limitOTPActions, validateSignUpFields } from '../utils/functions/auth.js';
import { signAccessToken, signRefreshToken } from '../utils/functions/jwt.js';
import sendEmail from '../utils/functions/sendMail.js';
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

// login controller
const login = async (req, res, next) => {
    const {email, password} = {
        ...req.body,
        email: req.body.email.toLowerCase()
    };

   // check if user exists in DB with the given email
    const user = await prisma.user.findUnique({ where: { email } });

    if(!user) {
        return next(new CustomError('Email is not registered with us!', 401));
    }

    // validate password, throws custom error if incorrect
    await bcryptCompare({
        plain: password, 
        hashed: user.password
    }, 'Incorrect password!');

    // password was correct, sign tokens
    // tokens properties AT = Access Token, RT = Refresh Token
    const tokens = {
        AT: signAccessToken({
            id: user.id, 
            roles: user.role
        }),
        RT: signRefreshToken({
            id: user.id, 
            roles: user.role
        }),

    // parseInt stops parsing when 'd'(stands for days) is triggered,
    // and returns numbers of days in Number datatype
        AT_AGE: parseInt(process.env.ACCESS_TOKEN_EXPIRES_IN), //in minutes
        RT_AGE: parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN) //in days
    } 

    // store tokens in the browser cookies
    res.cookie('AT', tokens.AT, {
        httpOnly: true,
        expires: new Date(Date.now() + tokens.AT_AGE * 60 * 1000), // minutes 
    });

    res.cookie('RT', tokens.RT, {
        httpOnly: true,
        expires: new Date(Date.now() + tokens.RT_AGE * 24 * 60 * 60 * 1000), // days
    });

    // delete password before responding
    user.password = undefined

    res.status(200).json({
        status: 'success',
        message: 'Logged in successfully!',
        user,
    })

}

const logout = async (req, res, next) => {

    // Clear the authentication cookies to log the user out
    res.clearCookie('AT', { httpOnly: true });
    res.clearCookie('RT', { httpOnly: true });
    res.status(200).json({
        status: 'success',
        message: 'Logged out successfully!'
    })
}

export { validateUserSignUp, completeUserSignUp, login, logout };