import { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';

type AuthBody = {
  email?: string;
  password?: string;
  refresh_token?: string;
  data?: Record<string, unknown>;
};

type SupabaseAuthResponse = Record<string, unknown> & {
  user?: Record<string, unknown> | null;
  session?: Record<string, unknown> | null;
  access_token?: string;
  refresh_token?: string;
};

const getUserIdFromAuthResult = (result: SupabaseAuthResponse): string | null => {
  const directUser = result.user;
  if (directUser && typeof directUser === 'object' && 'id' in directUser && typeof directUser.id === 'string') {
    return directUser.id;
  }

  const sessionUser = result.session as Record<string, unknown> | null | undefined;
  if (sessionUser && typeof sessionUser === 'object' && 'user' in sessionUser) {
    const nestedUser = sessionUser.user as Record<string, unknown> | null | undefined;
    if (nestedUser && typeof nestedUser === 'object' && 'id' in nestedUser && typeof nestedUser.id === 'string') {
      return nestedUser.id;
    }
  }

  if (typeof result.id === 'string') {
    return result.id; // supabase /signup REST returns standard User object directly sometimes
  }

  return null;
};

const getAccessToken = (req: Request): string | null => {
  const header = req.header('authorization') ?? req.header('Authorization');

  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
};

const readBody = (req: Request): AuthBody => req.body as AuthBody;

const ensureSupabaseAuthConfig = (): void => {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error('Supabase Auth is not configured. Check SUPABASE_URL/SUPABASE_API_URL and SUPABASE_ANON_KEY.');
  }
};

export const callSupabaseAuth = async <T>(path: string, init: any): Promise<T> => {
  ensureSupabaseAuthConfig();

  const response = await fetch(`${env.supabaseUrl}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: env.supabaseAnonKey,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const raw = await response.text();
  const data = raw ? (JSON.parse(raw) as T) : ({} as T);

  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'msg' in data
        ? String((data as { msg?: unknown }).msg)
        : `Supabase Auth request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
};

const requireEmailAndPassword = (body: AuthBody): { email: string; password: string } => {
  const email = body.email?.trim();
  const password = body.password?.trim();

  if (!email || !password) {
    throw new Error('email and password are required');
  }

  return { email, password };
};

const requireRefreshToken = (body: AuthBody): string => {
  const refreshToken = body.refresh_token?.trim();

  if (!refreshToken) {
    throw new Error('refresh_token is required');
  }

  return refreshToken;
};

export const authController = {
  async signUp(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = requireEmailAndPassword(readBody(req));
      const data = readBody(req).data ?? {};

      const result = await callSupabaseAuth<SupabaseAuthResponse>('/signup', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          options: {
            data,
          },
        }),
      });

      // Attempt to create an initial profile linked to the new user
      let createdProfile: Record<string, unknown> | null = null;
      try {
        const userId = getUserIdFromAuthResult(result);
        if (userId) {
          // Lazy import to avoid circular dependency at module load
          const { createProfile } = await import('../profile/profile.controller');
          const usernameFromEmail = String(email).split('@')[0];

          const usernameVal: string | null =
            typeof data.username === 'string' && data.username.trim().length > 0
              ? String(data.username).trim()
              : String(usernameFromEmail);

          const displayNameVal: string | null =
            typeof data.display_name === 'string' && data.display_name.trim().length > 0
              ? String(data.display_name).trim()
              : String(usernameFromEmail);

          const departmentId: number | null = typeof data.department_id === 'number' ? (data.department_id as number) : null;

          createdProfile = await createProfile({
            user_id: userId,
            username: usernameVal,
            display_name: displayNameVal,
            department_id: departmentId,
          });
        }
      } catch (err) {
        // Log and continue — profile creation failure shouldn't prevent auth response
        console.error('Profile creation failed during sign-up:', err);
      }

      res.status(201).json({
        message: 'User registered successfully',
        user: result.user ?? null,
        session: result.session ?? null,
        profile: createdProfile,
      });
    } catch (error) {
      next(error);
    }
  },

  async signIn(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = requireEmailAndPassword(readBody(req));

      const result = await callSupabaseAuth<SupabaseAuthResponse>('/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
        }),
      });

      res.status(200).json({
        message: 'Login successful',
        user: result.user ?? null,
        session: result.session ?? null,
        access_token: result.access_token ?? null,
        refresh_token: result.refresh_token ?? null,
      });
    } catch (error) {
      next(error);
    }
  },

  async refreshSession(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = requireRefreshToken(readBody(req));

      const result = await callSupabaseAuth<SupabaseAuthResponse>('/token?grant_type=refresh_token', {
        method: 'POST',
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });

      res.status(200).json({
        message: 'Session refreshed',
        user: result.user ?? null,
        session: result.session ?? null,
        access_token: result.access_token ?? null,
        refresh_token: result.refresh_token ?? null,
      });
    } catch (error) {
      next(error);
    }
  },

  async signOut(req: Request, res: Response, next: NextFunction) {
    try {
      const accessToken = getAccessToken(req);

      if (!accessToken) {
        throw new Error('Authorization bearer token is required');
      }

      await callSupabaseAuth('/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });

      res.status(200).json({
        message: 'Signed out successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const accessToken = getAccessToken(req);

      if (!accessToken) {
        throw new Error('Authorization bearer token is required');
      }

      const user = await callSupabaseAuth<Record<string, unknown>>('/user', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      res.status(200).json({
        user,
      });
    } catch (error) {
      next(error);
    }
  },
};