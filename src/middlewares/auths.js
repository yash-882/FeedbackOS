import { signAccessToken, verifyAccessToken, verifyRefreshToken } from "../utils/functions/jwt.js";
import {CustomError} from "../utils/classes/customError.js";
import { prisma } from "../server.js";

// middleware to authorize user and allow access to protected routes
async function authorizeUser(req, res, next) {

    const { AT: accessToken, RT: refreshToken } = req.cookies;
    const noTokens = !accessToken && !refreshToken;

    const reqForAuth = /^\/(login|complete-signup|validate-signup)$/.test(req.path);

    if (noTokens && reqForAuth) {
      return next();
    }

    // Helper: fetch user directly from DB
    const getAndSetUser = async (id) => {
        const user = await prisma.user.findUnique({ where: { id } });

        if(!user) {
            // Clear cookies if user not found (e.g., account deleted) to prevent infinite loops of failed authentication
            res.clearCookie('AT', { httpOnly: true });
            res.clearCookie('RT', { httpOnly: true });
        
            return next(new CustomError('User not found. Please login again.', 401));
        }
        req.user = user;
    };

    const result = accessToken
      ? verifyAccessToken(accessToken)
      : { notProvided: true };

    // If access token expired or missing
    if (result.expired || result.notProvided) {
      if (!refreshToken) {
        return next(
          new CustomError( "Unauthorized access! Please login.", 401 )
        );
      }

      // Verify refresh token, throws error if invalid/expired
      const decoded = verifyRefreshToken(refreshToken);

      await getAndSetUser(decoded.id);

      const newToken = signAccessToken({
        id: req.user.id,
        roles: req.user.roles,
      });

      // Set new access token in cookie with appropriate expiration
      const AT_AGE = parseInt(process.env.ACCESS_TOKEN_EXPIRES_IN);

      res.cookie("AT", newToken, {
        httpOnly: true,
        expires: new Date(Date.now() + AT_AGE * 60 * 1000),
      });
    } else {
      await getAndSetUser(result.decoded?.id);
    }

    // block access to auth routes for already authenticated users to avoid token regeneration
    if (reqForAuth) {
      return res.status(403).json({
        status: "success",
        message: "You are already logged in!",
      });
    }

    next();
}

// allow requests to protected routes based on roles
// returns an async handler for express
const roleBasedAccess = (role) => {
    return (req, res, next) => {
        const user = req.user; //get user 

        // invalid role
        if (!user.roles.includes(role)) {
            return next(new CustomError('Not allowed to this route!', 403))
        }

        next()
    }
}
export { authorizeUser, roleBasedAccess };
