# Youtube Clone Backend

Youtube clone using PERN stack (Postgres, Express, React, and Node). 

This is the backend repository, built with Node + Postgres + Sequelize. For the frontend repository [click here](https://github.com/Yongtai-Huang/youtube-clone-frontend)

## Database

Postgres

## Core packages

1. sequelize - ORM for sql dialects
2. jsonwebtoken - authentication
3. bcryptjs - password hashing

## Video uploads
After videos are uploaded, thumbnails are generated and durations are retrieved

## Functionality

1. Signup/Login
2. Upload video
3. Watch videos
4. Search videos
5. Like/Dislike video
6. Subscribe/Unsubscribe from channels
7. Add, update, and delete comment
8. Edit profile

## Before running

Install Postgres, and start it.
Create a database named youtuberclone

## Running

At the root of your project create an .env file with the following contents:

```javascript
JWT_SECRET="NoOneKnows"
JWT_EXPIRE=7d 
DATABASE_URL="postgres://postgres:password@localhost:5432/youtuberclone"
```

(JWT expires after 7 days)
(Replace "password" with your database password)

Then run <code>npm install</code> to install required packages

Run <code>node server or npm start</code> to start the server
