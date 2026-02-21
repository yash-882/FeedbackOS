// organization controller to handle organization related operations such as creating an organization, generating join codes, etc.

import { prisma } from '../server.js';
import { CustomError } from '../utils/classes/customError.js';
import { randomBytes } from 'crypto';
import RedisService from '../utils/classes/redisService.js';

// create organization
const createOrganization = async (req, res, next) => {
    const { name, email = null, zendesk_subdomain = null, slack_workspace_id = null } = req.body || {};

    if (req.user.organization_id)
        return next(new CustomError("You already have an organization!", 400))

    let organization
    await prisma.$transaction(async (tx) => {

       // create organization
        organization = await tx.organization.create({
            data: {
                name,
                email,
                zendesk_subdomain,
                slack_workspace_id,
            }
        })

        // update user with organization id  (now user is admin of their newly created organization)
        await tx.user.update({
            where: {
                id: req.user.id
            },
            data: {
                organization_id: organization.id,
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
const getOrganizationJoinCode = async (req, res, next) => {

    const organization_id = req.user.organization_id;

    if (!organization_id)
        return next(new CustomError("You don't have an organization yet!", 404))

    // create a join code by generating a random string and appending the organization id to it, then hashing the result to ensure it's unique and not guessable
    const joinCode = randomBytes(4).toString('hex').toUpperCase();

    // save the join code to Redis for an hour
    const redisService = new RedisService(joinCode, 'ORG_JOIN_CODE');
    await redisService.setShortLivedData({
        organizationId: organization_id,
        code: joinCode,
    }, 3600);

    res.status(200).json({
        status: 'success',
        data: { joinCode }
    })
}

export {
    createOrganization,
    getOrganizationJoinCode
}
