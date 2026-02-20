// user
import express from 'express';
const router = express.Router();
// controllers
import { getProfile, updateProfile } from '../controllers/user.js';
import { authorizeUser } from '../middlewares/auths.js';

// authorize user for all user routes
router.use(authorizeUser)

// routes
router.get('/profile', getProfile);
router.patch('/update-profile', updateProfile);

export default router;