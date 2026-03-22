import { Controller, Get, Request, Headers } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';
import * as jwt from 'jsonwebtoken';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Temporary auth-check endpoint — confirms JWT validation works
  @Get('auth-check')
  authCheck(@Request() req: any) {
    const user = req.user;
    return { ok: true, userId: user?.id, role: user?.role, email: user?.email };
  }

  @Public()
  @Get('health')
  health() {
    const secret = process.env.SUPABASE_JWT_SECRET;
    return {
      status: 'ok',
      env: process.env.NODE_ENV || 'not set',
      jwtSecretLoaded: !!secret,
      jwtSecretLength: secret?.length ?? 0,
    };
  }

  /**
   * TEMPORARY debug endpoint — remove after fixing auth.
   * Call: GET /api/debug-token with Authorization: Bearer <token>
   */
  @Public()
  @Get('debug-token')
  debugToken(@Headers('authorization') auth?: string) {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!auth) {
      return { error: 'No Authorization header provided' };
    }
    const token = auth.replace('Bearer ', '');
    if (!secret) {
      return { error: 'SUPABASE_JWT_SECRET not set in env' };
    }

    // Decode header without verification
    const decoded = jwt.decode(token, { complete: true }) as any;

    try {
      const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
      return {
        status: 'valid',
        tokenHeader: decoded?.header,
        payload: {
          sub: (payload as any).sub,
          email: (payload as any).email,
          role: (payload as any).role,
          app_metadata_role: (payload as any).app_metadata?.role,
          iss: (payload as any).iss,
          exp: (payload as any).exp,
          iat: (payload as any).iat,
        },
      };
    } catch (err: any) {
      return {
        status: 'invalid',
        error: err.message,
        tokenHeader: decoded?.header,
        tokenIss: decoded?.payload?.iss,
        tokenExp: decoded?.payload?.exp,
        tokenExpDate: decoded?.payload?.exp ? new Date(decoded.payload.exp * 1000).toISOString() : null,
        secretLength: secret.length,
        secretFirst4: secret.substring(0, 4),
      };
    }
  }
}
