import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UserRole } from '../enums';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private reflector: Reflector) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) return true;

        const request = context.switchToHttp().getRequest();
        const isDev = process.env.NODE_ENV !== 'production';

        // No token at all in dev → inject mock user based on route
        if (!request.headers.authorization && isDev) {
            this.injectMockUser(request, null);
            return true;
        }

        // Token present → try real JWT validation
        try {
            return await (super.canActivate(context) as Promise<boolean>);
        } catch {
            // Token present but invalid — in dev only, decode (without verifying signature)
            // to get the real user identity so data queries use correct IDs
            if (isDev) {
                const token = (request.headers.authorization as string)?.replace('Bearer ', '');
                this.injectMockUser(request, token || null);
                return true;
            }
            return false;
        }
    }

    private injectMockUser(request: any, token: string | null) {
        // Try to decode the real JWT to get the actual user identity (no signature check)
        if (token) {
            try {
                // Decode JWT payload without verifying signature (base64url decode of middle segment)
                const payloadB64 = token.split('.')[1];
                const decoded = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8')) as any;
                if (decoded?.sub) {
                    request.user = {
                        id: decoded.sub,
                        email: decoded.email || '',
                        role: decoded.app_metadata?.role || UserRole.STUDENT,
                        firstName: decoded.user_metadata?.first_name || '',
                        lastName: decoded.user_metadata?.last_name || '',
                        isActive: true,
                    };
                    return;
                }
            } catch { /* fall through to URL-based defaults */ }
        }

        // No token or undecodable — fall back to URL-based mock identity
        const url: string = request.url || '';

        const TEACHER_SEGS = ['teacher', 'instructor', 'attendance'];
        const STUDENT_SEGS = ['student', 'vocabulary', 'dashboard/progress', 'lesson'];
        if (TEACHER_SEGS.some(seg => url.includes(seg))) {
            request.user = { id: '00000000-0000-0000-0000-000000000003', role: UserRole.TEACHER, email: 'teacher@safinstitute.com' };
        } else if (STUDENT_SEGS.some(seg => url.includes(seg))) {
            request.user = { id: '00000000-0000-0000-0000-000000000001', role: UserRole.STUDENT, email: 'student@safinstitute.com', cefrLevel: 'A1' };
        } else {
            request.user = { id: '00000000-0000-0000-0000-000000000002', role: UserRole.ADMIN, email: 'admin@safinstitute.com' };
        }
    }
}
