import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
    private supabaseAdmin: ReturnType<typeof createClient>;

    constructor(
        private readonly configService: ConfigService,
        private readonly usersService: UsersService,
    ) {
        this.supabaseAdmin = createClient(
            this.configService.get<string>('SUPABASE_URL')!,
            this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
            { auth: { autoRefreshToken: false, persistSession: false } },
        );
    }

    async getProfile(userId: string) {
        return this.usersService.findByIdOrFail(userId);
    }

    async syncProfile(userId: string, data: {
        email: string;
        firstName: string;
        lastName: string;
        role?: string;
        cefrLevel?: string;
    }) {
        let role = data.role;

        // If role not provided, fetch current metadata from Supabase to avoid overwriting with 'student'
        if (!role) {
            const { data: { user }, error } = await this.supabaseAdmin.auth.admin.getUserById(userId);
            if (user?.app_metadata?.role) {
                role = user.app_metadata.role;
            }
        }

        const finalRole = role || 'student';

        // Update app_metadata in Supabase Auth so the JWT contains the role
        await this.supabaseAdmin.auth.admin.updateUserById(userId, {
            app_metadata: { role: finalRole },
        });

        // Upsert profile row in our database
        return this.usersService.upsert({
            id: userId,
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            role: finalRole as any,
            ...(data.cefrLevel ? { cefrLevel: data.cefrLevel as any } : {}),
        });
    }

    async inviteInstructor(email: string, firstName: string, lastName: string, role?: string, branch?: string) {
        const { data, error } = await this.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: {
                first_name: firstName,
                last_name: lastName,
            },
            redirectTo: `${this.configService.get<string>('WEB_URL')}/auth/set-password`,
        });

        if (error) throw new Error(error.message);

        const resolvedRole = role || 'instructor';

        // Set role in app_metadata so JWT carries it
        await this.supabaseAdmin.auth.admin.updateUserById(data.user.id, {
            app_metadata: { role: resolvedRole },
        });

        // Immediately create local profile so instructor appears in admin list
        await this.usersService.upsert({
            id: data.user.id,
            email,
            firstName,
            lastName,
            role: resolvedRole as any,
            visaStatus: branch,
        });

        return { message: 'Instructor invited successfully', userId: data.user.id };
    }

    async enrollStudent(email: string, firstName: string, lastName: string, cefrLevel?: string, visaStatus?: string) {
        const { data, error } = await this.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: {
                first_name: firstName,
                last_name: lastName,
            },
            redirectTo: `${this.configService.get<string>('WEB_URL')}/auth/set-password`,
        });

        if (error) throw new Error(error.message);

        // Set role in app_metadata
        await this.supabaseAdmin.auth.admin.updateUserById(data.user.id, {
            app_metadata: { role: 'student' },
        });

        // Create local profile record
        await this.usersService.upsert({
            id: data.user.id,
            email,
            firstName,
            lastName,
            role: 'student' as any,
            cefrLevel: cefrLevel as any,
            visaStatus,
        });

        return { message: 'Student enrolled and invitation sent', userId: data.user.id };
    }
}
