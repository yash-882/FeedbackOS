import express from 'express';
const router = express.Router();

// controllers
import { createOrganization, getOrganizationJoinCode } from '../controllers/organization.js';
import { authorizeUser } from '../middlewares/auths.js';
import { checkRequiredFields } from '../middlewares/checkRequiredFields.js';

// authorize user for all organization routes
router.use(authorizeUser)

// routes
router.post('/create', checkRequiredFields(['name']), createOrganization);
router.get('/join-code', getOrganizationJoinCode);

export default router;