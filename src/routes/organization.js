import express from 'express';
const router = express.Router();

// controllers
import { createOrganization, getOrganizationJoinCode, joinOrganizationWithCode } from '../controllers/organization.js';
import { authorizeUser, roleBasedAccess } from '../middlewares/auths.js';
import { checkRequiredFields } from '../middlewares/checkRequiredFields.js';

// authorize user for all organization routes
router.use(authorizeUser)

// routes
router.post('/create', checkRequiredFields(['name']), createOrganization);
router.get('/join-code' ,roleBasedAccess('organization_admin'), getOrganizationJoinCode);
router.post('/join', checkRequiredFields(['joinCode']), joinOrganizationWithCode);


export default router;