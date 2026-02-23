/**
 * Configuration validation schema using Joi
 */

import Joi from "joi";

export const configSchema = Joi.object({
  telegram: Joi.object({
    token: Joi.string().required(),
    chatId: Joi.string().required(),
    ownerIds: Joi.array().items(Joi.string()).min(1).required(),
    polling: Joi.boolean().default(true),
  }).required(),

  security: Joi.object({
    encryptionKey: Joi.string().length(64).required(), // 32 bytes hex
    rateLimit: Joi.object({
      enabled: Joi.boolean().default(true),
      windowMs: Joi.number().min(1000).max(3600000).default(60000),
      maxRequests: Joi.number().min(1).max(1000).default(30),
      skipFailedRequests: Joi.boolean().default(false),
    }).required(),
    allowedCommands: Joi.array().items(Joi.string()).optional(),
    blockedCommands: Joi.array().items(Joi.string()).optional(),
  }).required(),

  ssh: Joi.object({
    defaultPrivateKeyPath: Joi.string().allow("").default("~/.ssh/id_rsa"),
    defaultPort: Joi.number().min(1).max(65535).default(22),
    connectionTimeout: Joi.number().min(1000).max(120000).default(30000),
    keepaliveInterval: Joi.number().min(1000).max(60000).default(10000),
    maxConnections: Joi.number().min(1).max(20).default(5),
    commandTimeout: Joi.number().min(1000).max(300000).default(60000),
  }).required(),

  logging: Joi.object({
    level: Joi.string().valid("debug", "info", "warn", "error").default("info"),
    format: Joi.string().valid("json", "pretty").default("json"),
    file: Joi.string().optional(),
  }).required(),

  storage: Joi.object({
    serversFile: Joi.string().required(),
    encryptionEnabled: Joi.boolean().default(true),
  }).required(),

  backup: Joi.object({
    enabled: Joi.boolean().default(true),
    intervalMs: Joi.number().min(60000).max(86400000).default(3600000),
    maxCount: Joi.number().min(1).max(100).default(10),
  }).required(),

  monitoring: Joi.object({
    enabled: Joi.boolean().default(true),
    intervalMs: Joi.number().min(10000).max(3600000).default(300000),
  }).required(),
}).required();
