import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';

@Injectable()
export class AuthService {
  private supabase: SupabaseClient | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private getSupabaseClient(): SupabaseClient {
    if (!this.supabase) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new InternalServerErrorException(
          'Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment variables.',
        );
      }

      this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
    return this.supabase;
  }

  async signup(dto: AuthCredentialsDto) {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email: dto.email.trim().toLowerCase(),
      password: dto.password,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (data.user && data.user.email) {
      await this.prisma.user.upsert({
        where: { id: data.user.id },
        update: { email: data.user.email },
        create: {
          id: data.user.id,
          email: data.user.email,
        },
      });
    }

    return {
      access_token: data.session?.access_token ?? null,
      refresh_token: data.session?.refresh_token ?? null,
      user: data.user
        ? {
            id: data.user.id,
            email: data.user.email,
          }
        : null,
    };
  }

  async login(dto: AuthCredentialsDto) {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: dto.email.trim().toLowerCase(),
      password: dto.password,
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException(
        error?.message || 'Invalid email or password.',
      );
    }

    const email = data.user.email || `${data.user.id}@supabase.user`;

    await this.prisma.user.upsert({
      where: { id: data.user.id },
      update: { email },
      create: {
        id: data.user.id,
        email,
      },
    });

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      token_type: data.session.token_type,
      expires_in: data.session.expires_in,
      user: {
        id: data.user.id,
        email,
      },
    };
  }

  async verifyToken(token: string) {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException(
        error?.message || 'Invalid or expired Supabase token.',
      );
    }

    const email = data.user.email || `${data.user.id}@supabase.user`;

    await this.prisma.user.upsert({
      where: { id: data.user.id },
      update: { email },
      create: {
        id: data.user.id,
        email,
      },
    });

    return {
      id: data.user.id,
      email,
    };
  }
}
