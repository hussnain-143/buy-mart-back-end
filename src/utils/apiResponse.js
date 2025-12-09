export class apiResponse {
  constructor(statusCode, message = "success", data = null) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = true;
  }
}
