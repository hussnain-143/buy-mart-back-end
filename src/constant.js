export const DB_Name = "buy-mart";  
export const  options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Only use secure cookies in production (HTTPS)
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-origin in production, 'lax' for development
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
}