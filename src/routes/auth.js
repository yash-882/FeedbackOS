// user
import express from 'express';
const router = express.Router();

// controllers
import { validateUserSignUp, completeUserSignUp } from '../controllers/auth.js';
import { checkRequiredFields } from '../middlewares/checkRequiredFields.js';

// routes
router.post('/validate-signup', 
    checkRequiredFields(['name', 'email', 'password']), validateUserSignUp);

router.post('/complete-signup', 
    checkRequiredFields(['email', 'otp']), completeUserSignUp);

export default router;  