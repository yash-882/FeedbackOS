import redisClient from '../../configs/redisClient.js'

// Redis operations
class RedisService {
    constructor(uniqueID, purpose){
    //to set purpose and uniqueKey 
    // (a unique key is generated with the combination of 'purpose' and 'uniqueID' for Redis)
        this.purposes = {
            RESET_PASSWORD_OTP: 'reset-password',
            SIGN_UP_OTP: 'sign-up',
            EMAIL_CHANGE_OTP: 'change-email',
            RESET_PASSWORD_TOKEN: 'reset-password-token',
            DATA_CACHE: 'cached',
            ORG_JOIN_CODE: 'org-join-code',
            INVITE_CODE_COUNT: 'invite-code-count',
            PAUSE_CODE_GENERATION: 'pause-code-generation',
        }
        this.uniqueID = uniqueID;
        this.purpose = this.purposes[purpose] || purpose || 'unknown'
        this.key = this.getKey();
    }
    
// always prefix the Redis key with a unique action
// this helps Redis to differentiate OTP requests for the same uniqueID across routes (e.g., /sign-up, /change-password)
// example: /sign-up → sign-up:<uniqueID>, /change-password → change-password:<uniqueID>
    getKey(){

    return `${this.purpose}:${this.uniqueID}` 

    }

    // stores data with expiration time in Redis
    async setShortLivedData(data, ttl, isUpdate=false){
    const isObject = data !== null && typeof data === 'object' 

    if(isObject){
        data = JSON.stringify(data)
    }

    // XX (only set if already exists), NX (only set if doesn't exist)
    const condition = isUpdate ? 'XX' : 'NX'
    
    // temporarily (ttl example: 300 -> 5 minutes) store data in Redis
    await redisClient.set(this.key, data, {
        condition, 
        expiration:{ type: 'EX', value: ttl }
    })
}


    // store data in Redis
    async setData(data, isUpdate=false){
        const isObject = data !== null && typeof data === 'object'

    if(isObject){
        data = JSON.stringify(data)
    }

    // XX (only set if already exists), NX (only set if doesn't exist)
    const condition = isUpdate ? 'XX' : 'NX'

    //  store data in Redis
    await redisClient.set(this.key, data, {condition})
    }

    isJSON(data){
        try{
        const parsed = JSON.parse(data)

        // parsed can be null, boolean and number which JSON can parse withour any error
        // return true if parsed is an object
        return typeof parsed === 'object'
       
        } catch(err){
            // not a JSON data
            return false
        }
    } 
    

    // get data by key
    async getData(){
        const data = await redisClient.get(this.key);

        if(this.isJSON(data)){
            return JSON.parse(data)
        }

        return data
    }

    // delete data by key
    async deleteData(){
        await redisClient.del(this.key)
    }

    async decrement(){
        await redisClient.decr(this.key)
    }

    async increment(){
        await redisClient.incr(this.key)
    }

    async addToSet(value, {ttl=0, setTtlIfExists=false}){
        await redisClient.sAdd(this.key, value);

        // set expiration  
        if(ttl)
            await redisClient.expire(this.key, ttl, setTtlIfExists ? 'XX' : 'NX')
    }

    async removeFromSet(value){
        await redisClient.sRem(this.key, value)
    }

    async retrieveSETLength(){

        console.log('length', await redisClient.sCard(this.key));
        
        return await redisClient.sCard(this.key)
    }
}

export default RedisService;