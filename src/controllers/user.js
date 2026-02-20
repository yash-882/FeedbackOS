import { prisma } from '../server.js';
import { CustomError } from '../utils/classes/customError.js';

export const getProfile = async (req, res, next) => {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, created_at: true } // select only necessary fields
    }); 

    if(!user) {
        return next(
            new CustomError('User not found', 404));
    }
    res.status(200).json({
        status: 'success',
        data: { user }
    })
}

// update profile
export const updateProfile = async (req, res, next) => {
    const userId = req.user.id;
    const { name } = req.body || {};

    if(req.body.password || req.body.email) {
        return next(
            new CustomError('You cannot change password or email directly', 400));
    }

    // only allow updating name for now, if there are any other fields in the request body, return an error
    const allowedForUpdate = ['name'];
    const providedFields = Object.keys(req.body || {});
    const invalidFields = providedFields.filter(field => !allowedForUpdate.includes(field));

    if(invalidFields.length > 0) {
        return next(
            new CustomError(`Only these fields are allowed for update: ${allowedForUpdate.join(', ')}`, 400)
        );
    }

    // update user in the database
    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { name },
        select: { id: true, name: true, email: true } // select only necessary fields
    });

    // update sucessful
    res.status(201).json({
        status: 'success',
        message: 'Profile updated successfully!',
        data: { user: updatedUser }
    })
}

