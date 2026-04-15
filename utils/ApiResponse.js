class ApiResponse {
  constructor(statusCode, message, data = null) {
    this.statusCode = statusCode;
    this.success = statusCode >= 200 && statusCode < 300;
    this.message = message;
    if (data !== null) this.data = data;
  }

  static success(res, message, data = null, statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static created(res, message, data = null) {
    return ApiResponse.success(res, message, data, 201);
  }

  static error(res, statusCode, message, errorDetails = null) {
    const body = { success: false, message };
    if (errorDetails) body.error = errorDetails;
    return res.status(statusCode).json(body);
  }

  static validationError(res, errors) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  static paginated(res, message, data, pagination) {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination,
    });
  }
}

module.exports = ApiResponse;
