import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AuthUser } from './current-user.decorator';
import { AuthService } from './auth.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthUser;
    }>();

    const authHeader = request.headers?.authorization;
    if (!authHeader) {
      if (isPublic) return true;
      throw new UnauthorizedException(
        'Missing Authorization header (Bearer <token>).',
      );
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      if (isPublic) return true;
      throw new UnauthorizedException(
        'Invalid Authorization header format. Expected: Bearer <token>.',
      );
    }

    request.user = await this.authService.verifyToken(token);
    return true;
  }
}
