const swaggerJsdoc = require("swagger-jsdoc"),
swaggerUi = require("swagger-ui-express");


const options = {
    definition: {
      openapi: "3.1.0",
      info: {
        title: "SwapKaro Express API with Swagger",
        version: "0.1.0",
        description:
          "This is a simple CRUD API application made with Express and documented with Swagger",
        license: {
          name: "---",
          url: "---",
        },
        contact: {
          name: "SwapKaro",
          url: "https://swapkaro.com",
          email: "swapkaro@email.com",
        },
      },
      servers: [
        {
          url: "http://localhost:3000/",
        },
      ],
    },
    apis: ["./Routes/*.js"],
  };





const specs = swaggerJsdoc(options);


module.exports = {
    specs,
    swaggerUi,
};