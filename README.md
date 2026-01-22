# Buy Mart - Backend API

A robust e-commerce backend API built with Node.js, Express.js, and MongoDB. This backend powers the Buy Mart e-commerce platform, providing comprehensive APIs for user management, product catalog, shopping cart, orders, and more.

## 🚀 Features

- **User Authentication & Authorization**
  - User signup and login
  - JWT-based authentication with refresh tokens
  - Secure password hashing with bcrypt
  - Profile management

- **Product Management**
  - Product catalog with images
  - Category and brand management
  - Product reviews and ratings
  - Vendor management

- **Shopping Experience**
  - Shopping cart functionality
  - Order management
  - Payment processing
  - Shipping information

- **Additional Features**
  - Activity logging
  - Notifications system
  - Redis caching
  - Cloudinary image upload
  - Rate limiting
  - Error handling middleware

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js 5.2.1
- **Database:** MongoDB (Mongoose 9.0.1)
- **Cache:** Redis (ioredis 5.8.2)
- **Authentication:** JWT (jsonwebtoken 9.0.3)
- **File Upload:** Multer 2.0.2 + Cloudinary 2.8.0
- **Security:** bcrypt 6.0.0, cookie-parser 1.4.7
- **Utilities:** dotenv, cors, slugify, mongoose-paginate-v2

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB database
- Redis server
- Cloudinary account (for image uploads)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd buy-mart-back-end
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory and add the following variables:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # Database
   MONGODB_URI=your_mongodb_connection_string

   # Redis
   REDIS_HOST=localhost
   REDIS_PORT=6379

   # JWT
   JWT_SECRET=your_jwt_secret_key
   JWT_REFRESH_SECRET=your_jwt_refresh_secret_key
   JWT_EXPIRE=7d
   JWT_REFRESH_EXPIRE=30d

   # Cookie
   COOKIE_SECRET=your_cookie_secret_key

   # Cloudinary
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret

   # Frontend URL
   FRONTEND_URL=http://localhost:5173
   ```

4. **Start the development server**
   ```bash
   npm start
   ```

   The server will start on `http://localhost:5000` (or the port specified in your `.env` file).

## 📁 Project Structure

```
buy-mart-back-end/
├── src/
│   ├── app.js                 # Express app configuration
│   ├── index.js               # Application entry point
│   ├── constant.js            # Application constants
│   ├── controller/            # Route controllers
│   │   ├── brand.controller.js
│   │   ├── cart.controller.js
│   │   ├── category.controller.js
│   │   └── user.controller.js
│   ├── db/
│   │   └── connectdb.js       # MongoDB connection
│   ├── middlewares/           # Custom middlewares
│   │   ├── auth.middleware.js
│   │   ├── error.middleware.js
│   │   ├── multer.middleware.js
│   │   └── rateLimit.middleware.js
│   ├── models/                # Mongoose models
│   │   ├── activityLog.model.js
│   │   ├── brand.model.js
│   │   ├── cartCollection.model.js
│   │   ├── category.model.js
│   │   ├── notification.model.js
│   │   ├── order_items.model.js
│   │   ├── orders.model.js
│   │   ├── payment.model.js
│   │   ├── product_images.model.js
│   │   ├── product.model.js
│   │   ├── review.model.js
│   │   ├── shipping.model.js
│   │   ├── user.model.js
│   │   └── vendor.model.js
│   ├── routes/                # API routes
│   │   └── user.routes.js
│   └── utils/                 # Utility functions
│       ├── apiError.js
│       ├── apiResponse.js
│       ├── asyncHandler.js
│       ├── redis.util.js
│       └── uploadToCloudinary.js
├── public/
│   └── uploads/               # Local file uploads directory
├── redis/
│   └── index.js               # Redis configuration
├── package.json
└── README.md
```

## 🔌 API Endpoints

### User Routes (`/api/v1/user`)

#### Authentication
- `POST /api/v1/user/signup` - Register a new user
  - Supports profile image upload
  - Body: `{ firstName, lastName, userName, email, password, profile (file) }`

- `POST /api/v1/user/login` - User login
  - Body: `{ userName, password }`
  - Returns: Access token and refresh token (in cookies)

- `POST /api/v1/user/logout` - User logout
  - Requires: Authentication (allows expired tokens)
  - Clears authentication cookies

#### Profile Management
- `GET /api/v1/user/me` - Get current user profile
  - Requires: Authentication

- `PUT /api/v1/user/update-profile` - Update user profile
  - Requires: Authentication
  - Supports profile image upload
  - Body: `{ firstName, lastName, userName, email, profile (file) }`

- `PUT /api/v1/user/update-password` - Update user password
  - Requires: Authentication
  - Body: `{ oldPassword, newPassword }`

- `PUT /api/v1/user/update-address` - Update user address
  - Requires: Authentication
  - Body: `{ address fields }`

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication:
- **Access Token:** Short-lived token for API requests
- **Refresh Token:** Long-lived token stored in HTTP-only cookies
- Tokens are automatically included in requests via cookies

Protected routes require the `authMiddleware` which validates the JWT token.

## 🗄️ Database Models

- **User** - User accounts and profiles
- **Product** - Product catalog
- **Category** - Product categories
- **Brand** - Product brands
- **CartCollection** - Shopping cart items
- **Orders** - Order information
- **OrderItems** - Individual order items
- **Payment** - Payment transactions
- **Shipping** - Shipping information
- **Review** - Product reviews and ratings
- **Vendor** - Vendor/seller information
- **ProductImages** - Product image references
- **Notification** - User notifications
- **ActivityLog** - User activity tracking

## 🚦 Middleware

- **authMiddleware** - Validates JWT tokens for protected routes
- **logoutMiddleware** - Handles logout with expired token support
- **errorHandler** - Centralized error handling
- **rateLimit** - API rate limiting
- **multer** - File upload handling

## 🔄 Caching

Redis is used for:
- Session management
- Caching frequently accessed data
- Performance optimization

## 📤 File Uploads

- Local uploads are stored in `public/uploads/`
- Images are uploaded to Cloudinary for production
- Supported via Multer middleware

## 🛡️ Security Features

- Password hashing with bcrypt
- JWT token-based authentication
- HTTP-only cookies for refresh tokens
- CORS configuration
- Rate limiting
- Input validation

## 🧪 Development

The project uses `nodemon` for automatic server restarts during development.

```bash
npm start  # Runs with nodemon
```

## 📝 License

ISC

## 👤 Author

Buy Mart Development Team

---

For more information or support, please contact the development team.
