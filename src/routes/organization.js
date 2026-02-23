import express from 'express';
const router = express.Router();

// controllers
import { 
    createOrganization, 
    getOrganizationJoinCode, 
    joinOrganizationWithCode, 
    getAllJoinCodes, 
    invalidateJoinCode} from '../controllers/organization.js';
import { authorizeUser, roleBasedAccess } from '../middlewares/auths.js';
import { checkRequiredFields } from '../middlewares/checkRequiredFields.js';

// authorize user for all organization routes
router.use(authorizeUser)

// routes
router.post('/create', checkRequiredFields(['name']), createOrganization);
router.post('/join', checkRequiredFields(['joinCode']), joinOrganizationWithCode);
router.get('/join-code' ,roleBasedAccess('organization_admin'), getOrganizationJoinCode);

// organization-admin only routes

router.use(roleBasedAccess('organization_admin'))


router.get('/all-join-codes', getAllJoinCodes);
router.delete('/invalidate-join-code', checkRequiredFields(['joinCode']), invalidateJoinCode)


export default router;