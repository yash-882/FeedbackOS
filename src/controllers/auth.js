// user 
import { prisma } from '../server.js';
import { CustomError } from '../utils/classes/customError.js';
import bcrypt from 'bcrypt';
import RedisService from '../utils/classes/redisService.js';
import { randomInt } from 'crypto'
import { bcryptCompare, limitOTPActions, validateSignUpFields } from '../utils/functions/auth.js';
import { signAccessToken, signRefreshToken } from '../utils/functions/jwt.js';
import sendEmail from '../utils/functions/sendMail.js';
import jwt  from 'jsonwebtoken';
import { promisify } from 'util';

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
    }, 600);
  }

  // Send OTP to user's email
  await sendEmail(lowerCaseEmail, 'OTP for FeedbackOS', `Your OTP for completing the sign-up process is: ${otp}. Please use this OTP to complete your registration. This OTP will expire in 5 minutes.`);

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
      roles: ['user'] // can be changed after sign-up based on requirements (except Admin role)
    }
  });

  // Remove the OTP data from Redis after successful sign-up
  await redisService.deleteData();

  newUser.password = undefined; // remove password from the response

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
            roles: user.roles
        }),
        RT: signRefreshToken({
            id: user.id, 
            roles: user.roles
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
        data: {user},
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

const changePassword = async (req, res, next) => {
    const {currentPassword, newPassword, confirmNewPassword} = req.body;

    const user = req.user; // get user from request object

    // if new password is not confirmed correctly
    if(newPassword !== confirmNewPassword) {
        return next(
    new CustomError('Please confirm your new password correctly', 400));
    }
    
    // validate current password, throws custom error if incorrect
    await bcryptCompare({
        plain: currentPassword, 
        hashed: user.password
    }, 'Incorrect current password!');

    // if new password is same as the current password
    const isNewPasswordSame = await bcrypt.compare(newPassword, user.password);
    
    if(isNewPasswordSame) {
        return next(
    new CustomError('Password must be different from the previous one', 400));
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12); // hashed password

    // update user's password in the database
    await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
    })

    user.password = undefined; // remove password from the response

    // change password successfully
    res.status(201).json({
        status: 'success',
        message: 'Password changed successfully.',
        data: {user},
    })
}

// request OTP to change the password
const requestResetPassword = async (req, res, next) => {

    // get email from body
    let {email} = req.body || {}
    email = email.toLowerCase()

    // finds user in DB, throws error if not found 
    const user = await prisma.user.findUnique({ where: { email } });

    if(!user) {
        return next(new CustomError('Email is not registered with us!', 401));
    }

    const otp = randomInt(112111, 998999); // Generate a 6-digit OTP
    
    // a unique key is generated with the combination of 'purpose' and 'email' for Redis
    const redisService = new RedisService(email, 'RESET_PASSWORD_OTP')

    // Check and limit OTP requests, returns existing data if within limits, otherwise throws an error
    const allowedRequestLimit = Number(process.env.OTP_REQUEST_LIMIT) || 7;
    const OTPData = await limitOTPActions(redisService, 600, true, allowedRequestLimit);

    if(!OTPData) {
      redisService.setShortLivedData({
        email,
        otp, // hashed OTP for security
        attemptCount: 0,
        requestCount: 1,
        purpose: 'RESET_PASSWORD_OTP',
      }, 600);
    }

    // sending user an OTP via email
    await sendEmail(email, 'Reset password', `Use this code to reset password: ${otp}`)

    // OTP successfully sent
    res.status(201).json({
        status: 'success',
        message: 'OTP sent to email for verification. Please complete the password reset process within 5 minutes.'
    })
}

// verifies the OTP and change password
const verifyPasswordResetOTP = async (req, res, next) => {
    const { email, otp } = {
        ...req.body,
        email: req.body.email.toLowerCase()
    }

    // if there is already an active password reset session, block the request to prevent multiple sessions and potential security risks
    if(req.cookies.PRT){
        return next(new CustomError(
          'Change password session is already active.', 400));
    }

    // create a RedisService instance for managing OTP data, using a unique key based on email and purpose
    const redisService = new RedisService(email, 'RESET_PASSWORD_OTP')

    const storedData = await redisService.getData();
    if (!storedData) {
        return next(new CustomError('OTP expired or invalid. Please request a new OTP.', 400));
    }

    // if OTP does not match
    if (storedData.otp !== otp) {
        const allowedAttemptLimit = Number(process.env.OTP_ATTEMPT_LIMIT) || 5;

        // Increment OTP attempt count and check limits
        await limitOTPActions(redisService, 600, false, allowedAttemptLimit); // Increment attempt count

        return next(new CustomError('Invalid OTP. Please try again.', 400));
    }

    // if OTP is valid, set a short-lived token in cookies to allow password reset
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '10m' }); // Token valid for 10 minutes
    res.cookie('PRT', token, {
        httpOnly: true,
        expires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    res.status(200).json({
        status: 'success',
      message: 'OTP verified successfully. You can now reset your password at /submit-new-password endpoint. ',
    })
}

// resets password using a valid password reset token
const submitNewPassword = async (req, res, next) => {

    const { email, newPassword, confirmNewPassword } = {
        ...req.body,
        email: req.body.email.toLowerCase()
    }

    // 
    const throwInvalidSessionError = () => 
        next(new CustomError('Session has been expired or invalid!', 401));

    if(!req.cookies.PRT)
        return throwInvalidSessionError();


    // verify JWT from cookies
     await promisify(jwt.verify)(req.cookies.PRT, process.env.JWT_SECRET)


     // a unique key is generated with the combination of 'purpose' and 'email' for Redis
    const redisService = new RedisService(email, 'RESET_PASSWORD_OTP')
    const TOKEN_KEY = redisService.getKey()


    const tokenData = await redisService.getData(TOKEN_KEY);

    //if user has not a valid token 
    if(!tokenData || 
        tokenData.email !== email || 
        tokenData.purpose !== 'RESET_PASSWORD_OTP'){
        return throwInvalidSessionError();
    }

    // if these fields does not match
    if(newPassword !== confirmNewPassword){
        return next(
    new CustomError('Please confirm your password correctly', 400));
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if(!user) {
        return next(new CustomError('Account not found!', 401));
    }

    // if new password is same as the current password
    const isNewPasswordSame = await bcrypt.compare(newPassword, user.password);
    
    if(isNewPasswordSame) {
        return next(
    new CustomError('Password must be different from the previous one', 400));
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12); // hashed password

    // update user's password in the database
    await prisma.user.update({
        where: { email },
        data: { password: hashedPassword }
    })

    // password changed successfully
    res.clearCookie('PRT', { httpOnly: true });

    redisService.deleteData(TOKEN_KEY); // delete the token data from Redis after successful password reset

    res.status(200).json({
        status: 'success',
        message: 'Password reset successfully! You can now log in with your new password.'
    })
}

export { 
  validateUserSignUp, 
  completeUserSignUp, 
  login, 
  logout, 
  requestResetPassword, 
  verifyPasswordResetOTP, 
  submitNewPassword ,
  changePassword
};