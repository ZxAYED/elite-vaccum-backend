import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User, UserRole } from '@prisma/client';
import { Request } from 'express';
import { IS_PUBLIC_KEY, ROLES_KEY } from 'src/common/decorator/rolesDecorator';
import { PrismaService } from 'src/prisma/prisma.service';

type AuthenticatedRequestUser = {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic =
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    type AuthenticatedRequest = Request & { user?: AuthenticatedRequestUser };
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (isPublic) {
      if (authorization) {
        try {
          const rawToken = authorization.startsWith('Bearer ')
            ? authorization.slice(7)
            : authorization;
          const verified = await this.jwtService.verifyAsync(rawToken);
          if (verified && typeof verified === 'object') {
            const payload = verified as Record<string, unknown>;
            const userId = typeof payload.sub === 'string' ? payload.sub : null;
            if (userId) {
              const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: {
                  id: true,
                  email: true,
                  role: true,
                  isActive: true,
                },
              });
              if (user && user.isActive) {
                request.user = {
                  id: user.id,
                  email: user.email,
                  role: user.role,
                  isActive: user.isActive,
                };
              }
            }
          }
        } catch {
          // Ignore invalid token on public routes
        }
      }
      return true;
    }

    if (!authorization) {
      throw new UnauthorizedException('Unauthorized, no token provided');
    }

    const rawToken = authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : authorization;

    let verified: unknown;

    try {
      verified = await this.jwtService.verifyAsync(rawToken);
    } catch {
      throw new UnauthorizedException('Unauthorized, invalid token');
    }

    if (!verified || typeof verified !== 'object') {
      throw new UnauthorizedException('Unauthorized, invalid token payload');
    }

    const payload = verified as Record<string, unknown>;
    const userId = typeof payload.sub === 'string' ? payload.sub : null;

    if (!userId) {
      throw new UnauthorizedException('Unauthorized, invalid token payload');
    }

    let user: Pick<User, 'id' | 'email' | 'role' | 'isActive'> | null;

    try {
      user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError ||
        error instanceof Prisma.PrismaClientInitializationError ||
        error instanceof Prisma.PrismaClientUnknownRequestError ||
        error instanceof Prisma.PrismaClientValidationError
      ) {
        throw new ServiceUnavailableException(
          'Authentication service is temporarily unavailable. Please try again shortly.',
        );
      }
      throw error;
    }

    if (!user) {
      throw new UnauthorizedException('Unauthorized, user not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Unauthorized, account is inactive');
    }

    request.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      requiredRoles &&
      requiredRoles.length > 0 &&
      !requiredRoles.includes(user.role)
    ) {
      throw new ForbiddenException(
        'Access denied, user role does not have permission',
      );
    }

    return true;
  }
}
