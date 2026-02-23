// organization controller to handle organization related operations such as creating an organization, generating join codes, etc.
// Redis is used for managing organization join codes

import { prisma } from '../server.js';
import { CustomError } from '../utils/classes/customError.js';
import { randomBytes } from 'crypto';
import RedisService from '../utils/classes/redisService.js';
import { limitCodeGeneration, pushJoinCodeToSet, validateOrganizationJoin } from '../utils/functions/organization.js';

// create organization
const createOrganization = async (req, res, next) => {
    const { name, email = null, zendesk_subdomain = null, slack_workspace_id = null } = req.body || {};

    if (req.user.organization_id)
        return next(new CustomError("You already have an organization!", 400))

    // prevent duplicates
    if(email === req.user.email)
        return next(new CustomError("Organization email cannot be the same as your personal email!", 400))

    let organization
    await prisma.$transaction(async (tx) => {

       // create organization
        organization = await tx.organization.create({
            data: {
                name,
                email,
                zendesk_subdomain,
                slack_workspace_id,
                admin_id: req.user.id
            }
        })

        // update user with organization id  (now user is admin of their newly created organization)
        await tx.user.update({
            where: {
                id: req.user.id
            },
            data: {
                organization_id: organization.id,
                roles: {
                    push: !req.user.roles.includes('organization_admin') ? 'organization_admin' : undefined, // push admin role if not present
                }                               
            }
        })
    });

    res.status(201).json({
        status: 'success',
        message: 'Organization created successfully!',
        data: { organization }
    })
}

// get join code of organization (only accessible to org. admin)
// org. admin gets join-code and share it with other users to join their organization
// daily limit is applied
const getOrganizationJoinCode = async (req, res, next) => {
    const organizationId = req.user.organization_id;

    if (!organizationId)
        return next(new CustomError("You don't have an organization yet!", 404))

    // limit from generating codes (limit resets in 24 hours), throws err if limit reached
    await limitCodeGeneration(organizationId)

    // create a join code by generating a random string of 8 chars
    const joinCode = randomBytes(4).toString('hex').toUpperCase();

    // save the join code to Redis for an hour
    const joinCodeService = new RedisService(joinCode, 'ORG_JOIN_CODE');

    // store code in redis
    await joinCodeService.setShortLivedData({
        organizationId: organizationId,
        code: joinCode,

    }, 3600);

    // pushes code to Redis Set to keep all codes in a group
    await pushJoinCodeToSet(joinCode, organizationId)

    res.status(200).json({
        status: 'success',
        data: { joinCode }
    })
}

// join organization with code
// a users enter the code to join an organization and becomes a team member

const joinOrganizationWithCode = async (req, res, next) => {
    const { joinCode } = req.body || {};

    const redisService = new RedisService(joinCode, 'ORG_JOIN_CODE');
    const storedData = await redisService.getData();
    
    if (!storedData || storedData.code !== joinCode) {
        return next(new CustomError("Invalid or expired join code!", 400));
    }
    
    const { organizationId } = storedData;

    // throws badrequest error if 
    // user is already a member of an organization or is the admin of the organization they are trying to join
    validateOrganizationJoin(req.user, organizationId)

    // Update user's organization_id in the database
    const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: { organization_id: organizationId, roles: { push: 'team_member' } },
        select: { id: true, name: true, email: true, organization_id: true }
    });

    res.status(200).json({
        status: 'success',
        message: 'Successfully joined the organization!',
        data: { user: updatedUser }
    });
}

// get all generated join-codes
const getAllJoinCodes = async (req, res, next) => {
    const organizationId = req.user.organization_id;
    const joinCodeService = new RedisService(organizationId, 'ALL_JOIN_CODES');

    const joinCodes = await joinCodeService.retrieveSETData();
    res.status(200).json({
        status: 'success',
        data: { joinCodes }
    })
}


// invalidate generated join-codes
const invalidateJoinCode = async (req, res, next) => {
    const { joinCode } = req.body || {};
    const redisService = new RedisService(joinCode, 'ORG_JOIN_CODE');

    const deletedCount = await redisService.deleteData();

    if(deletedCount === 0)
        return next(new CustomError("Join code not found!", 404))
    
    res.status(200).json({
        status: 'success',
        message: 'Join code invalidated successfully!'
    })
}


export {
    createOrganization,
    getOrganizationJoinCode,
    joinOrganizationWithCode,
    getAllJoinCodes,
    invalidateJoinCode
}
