import { model, Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

// USER SCHEMA
const UserSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },

    profileUrl: {
      type: String,
      trim: true,
    },

    role: {
      type: String,
      enum: ["Admin", "vendor", "user"],
      required: true,
      trim: true,
    },

    address: [
      {
        city: {
          type: String,
          required: true,
          trim: true,
        },
        street: {
          type: String,
          required: true,
          trim: true,
        },
        houseNo: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },

    refreshToken: {
      type: String,
    },
  },
  { timestamps: true }
);

// 🔐 HASH PASSWORD BEFORE SAVE
UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  try {
    this.password = await bcrypt.hash(this.password, 10);
  } catch (error) {
    console.log(error);
  }
});

// 🔍 PASSWORD MATCH CHECK
UserSchema.methods.isPasswordMatch = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// 🎟 GENERATE ACCESS TOKEN
UserSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      userId: this._id,
      userName: this.userName,
      email: this.email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "1d",
    }
  );
};

// 🔄 GENERATE REFRESH TOKEN
UserSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      userId: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "30d",
    }
  );
};

// Optional: create an index for faster queries
UserSchema.index({ userName: 1 });

// EXPORT MODEL
export const UserModel = model("User", UserSchema);
