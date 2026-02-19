// user
import express from 'express';
const router = express.Router();

// controllers
import { validateUserSignUp, completeUserSignUp, login, logout } from '../controllers/auth.js';
import { checkRequiredFields } from '../middlewares/checkRequiredFields.js';
import { authorizeUser } from '../middlewares/auths.js';

 // authorize user for all auth routes, also blocks access to these routes for already authenticated users
router.use(authorizeUser)

// routes
router.post('/validate-signup', 
    checkRequiredFields(['name', 'email', 'password']), validateUserSignUp);

router.post('/complete-signup', 
    checkRequiredFields(['email', 'otp']), completeUserSignUp);

router.post('/login',
    checkRequiredFields(['email', 'password']), login);

router.post('/logout', logout);

export default router;  