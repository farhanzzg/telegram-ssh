/**
 * Error classes index - exports all errors
 */

// Base error
export { BaseError } from "./BaseError.js";

// Validation errors
export {
  InvalidCommandError,
  InvalidPathError,
  InvalidServerConfigError,
  ValidationError,
} from "./ValidationError.js";

// Auth errors
export {
  AuthError,
  InvalidCredentialsError,
  RateLimitedError,
  UnauthorizedError,
} from "./AuthError.js";

// SSH errors
export {
  CommandFailedError,
  ConnectionFailedError,
  ConnectionTimeoutError,
  DisconnectedError,
  SSHError,
} from "./SSHError.js";

// Configuration errors
export {
  ConfigurationError,
  InvalidConfigError,
  MissingConfigError,
} from "./ConfigurationError.js";

// Storage errors
export {
  FileNotFoundError,
  FileReadError,
  FileWriteError,
  StorageError,
} from "./StorageError.js";

// Pool errors
export {
  ConnectionAcquireTimeoutError,
  PoolExhaustedError,
} from "./PoolError.js";
