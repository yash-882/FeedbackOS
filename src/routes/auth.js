// user
import express from 'express';
const router = express.Router();

// controllers
import { 
    validateUserSignUp, 
    completeUserSignUp, 
    login, 
    logout, 
    requestResetPassword, 
    verifyPasswordResetOTP, 
    submitNewPassword, 
    changePassword} from '../controllers/auth.js';

import { checkRequiredFields } from '../middlewares/checkRequiredFields.js';
import { authorizeUser } from '../middlewares/auths.js';

// routes that do not require authentication (reset password routes)
router.post('/reset-password/request-otp',
    checkRequiredFields(['email']), requestResetPassword);

router.post('/reset-password/verify-otp',
    checkRequiredFields(['email', 'otp']), verifyPasswordResetOTP);

router.patch('/reset-password/submit-new-password',
    checkRequiredFields(['email', 'newPassword', 'confirmNewPassword']), submitNewPassword);

 // authorize user for all auth routes, also blocks access to these routes for already authenticated users
router.use(authorizeUser)

// routes
router.post('/validate-signup', 
    checkRequiredFields(['name', 'email', 'password']), validateUserSignUp);

router.post('/complete-signup', 
    checkRequiredFields(['email', 'otp']), completeUserSignUp);

router.patch('/change-password',
    checkRequiredFields(['currentPassword', 'newPassword', 'confirmNewPassword']), changePassword);

router.post('/login',
    checkRequiredFields(['email', 'password']), login);

router.post('/logout', logout);

export default router;  