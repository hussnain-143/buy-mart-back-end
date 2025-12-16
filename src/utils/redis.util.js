import { redisClient } from "../redis";

/**
 * Set value in Redis with TTL
 * @param {string} key
 * @param {any} value
 * @param {number} ttl - seconds
 */
export const setCache = async (key, value, ttl = 3600) => {
  try {
    await redisClient.set(
      key,
      JSON.stringify(value),
      "EX",
      ttl
    );
  } catch (error) {
    console.error("Redis SET error:", error);
  }
};

/**
 * Get value from Redis
 * @param {string} key
 * @returns {any | null}
 */
export const getCache = async (key) => {
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Redis GET error:", error);
    return null;
  }
};

/**
 * Delete Redis key
 * @param {string} key
 */
export const deleteCache = async (key) => {
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error("Redis DEL error:", error);
  }
};

/**
 * Check if key exists
 * @param {string} key
 */
export const hasCache = async (key) => {
  try {
    return await redisClient.exists(key);
  } catch (error) {
    console.error("Redis EXISTS error:", error);
    return false;
  }
};
