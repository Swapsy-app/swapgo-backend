# SwapKaro Backend

This is the backend for the SwapKaro application, built with Node.js, Express, and MongoDB. It provides a RESTful API for user authentication, product management, and email notifications.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [License](#license)

## Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/yourusername/swapkaro-backend.git
    cd swapkaro-backend
    ```

2. Install dependencies:
    ```sh
    npm install
    ```

3. Create a  file in the root directory and add the following environment variables:
    ```
    PORT=3000
    DB_URL=mongodb://localhost:27017
    E_MAIL_ID=your-email@gmail.com
    EMAIL_PASS=your-email-password
    ```

4. Start the server:
    ```sh
    npm start
    ```

## Usage

The server will start on `http://localhost:3000`. You can use tools like Postman to test the API endpoints.

## API Documentation

The API is documented using Swagger. You can access the API documentation at `http://localhost:3000/api-docs`.

## Project Structure
