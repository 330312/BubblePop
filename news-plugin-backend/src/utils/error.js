export class AppError extends Error {
  /**
   * @param {number} status HTTP status code
   * @param {string} message error message
   */
  constructor(status, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}
