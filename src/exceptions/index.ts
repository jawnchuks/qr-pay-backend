export class AppException extends Error {
    constructor(public message: string, public statusCode: number = 500) {
        super(message);
        this.name = 'AppException';
    }
}

export class BadRequestException extends AppException {
    constructor(message: string = 'Bad Request') {
        super(message, 400);
    }
}

export class UnauthorizedException extends AppException {
    constructor(message: string = 'Unauthorized') {
        super(message, 401);
    }
}

export class NotFoundException extends AppException {
    constructor(message: string = 'Resource Not Found') {
        super(message, 404);
    }
}

export class ForbiddenException extends AppException {
    constructor(message: string = 'Forbidden') {
        super(message, 403);
    }
}
