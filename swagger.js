const swaggerJsdoc = require("swagger-jsdoc"),
swaggerUi = require("swagger-ui-express");


const options = {
    definition: {
        openapi: '3.0.0',
        info: {
          title: 'Swagger Express API',
          version: '1.0.0',
          description: 'A simple Express API with Swagger documentation',
        },
      },
      apis: ['./Routes/*.js'], // Path to your API routes
  };





const specs = swaggerJsdoc(options);


module.exports = {
    specs,
    swaggerUi,
};