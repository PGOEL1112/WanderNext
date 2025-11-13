const Joi = require('joi');

module.exports.listingSchema = Joi.object({
    listing : Joi.object({
        Title : Joi.string().required(),
        Description : Joi.string().required(),
        Price : Joi.number().required().min(0),
        Location : Joi.string().required(),
        Country : Joi.string().required(),
        Image : Joi.string().required(),
    }).required()
});


module.exports.reviewSchema = Joi.object({
    review : Joi.object({
        rating : Joi.number().required().min(1).max(5),
        comment : Joi.string().required(),
    }).required()
})