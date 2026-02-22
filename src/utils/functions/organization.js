import { CustomError } from "../classes/customError.js";
import RedisService from "../classes/redisService.js";

const validateOrganizationJoin = (user, organizationId) => {

    // admin trying to join their own org
    if (user.roles.includes("organization_admin") && user.organization_id === organizationId) {
        throw new CustomError("You are the admin of this organization!", 400);
    }

    // already a member of this org
    if (user.organization_id === organizationId) {
        throw new CustomError("You are already a member of this organization!", 400);
    }

    // member of a different org
    if (user.organization_id && user.organization_id !== organizationId) {
        throw new CustomError("You are already a member of another organization!", 400);
    }

}

// pushes join code to redis set
const pushJoinCodeToSet = async (joinCode, organizationId) => {
    const joinCodeService = new RedisService(organizationId, 'ALL_JOIN_CODES');

    // keep the set for 24 hours
    await joinCodeService.addToSet(joinCode, {ttl: 86400});
}

// limits join-code generation 
const limitCodeGeneration = async (organizationId) => {
       const allJoinCodesService = new RedisService(organizationId, 'ALL_JOIN_CODES');

       const totalCodes = await allJoinCodesService.retrieveSETLength()

    // limit code-generation
    if(totalCodes >= 20)
        throw new CustomError("Code generation limit reached! Please wait until your daily limit is reset.", 429)
    
}

export {
    validateOrganizationJoin,
    pushJoinCodeToSet,
    limitCodeGeneration
}