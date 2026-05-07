import { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { supabase, supabaseAdmin } from '../../config/supabase';

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

type HttpLikeError = Error & {
  status?: number;
  raw?: string;
};

const withStatus = (message: string, status: number): HttpLikeError => {
  const err = new Error(message) as HttpLikeError;
  err.status = status;
  return err;
};

const isSupabaseCreateUserDbFailure = (error: unknown): boolean => {
  const candidate = error as { message?: unknown; status?: unknown };
  const status = candidate?.status;
  const message = typeof candidate?.message === 'string' ? candidate.message.toLowerCase() : '';

  return status === 500 && (
    message.includes('database error saving new user') ||
    message.includes('database error creating new user') ||
    message.includes('unexpected_failure')
  );
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

  const url = `${env.supabaseUrl}/auth/v1${path}`;
  const fetchOptions = {
    ...init,
    headers: {
      apikey: env.supabaseAnonKey,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  } as any;

  // Debug: log final request info to help diagnose body/content-type issues
  try {
    console.debug('[SupabaseAuth] Request URL:', url);
    console.debug('[SupabaseAuth] Request headers:', JSON.stringify(fetchOptions.headers));
    const bodyPreview = typeof fetchOptions.body === 'string' ? fetchOptions.body.slice(0, 300) : typeof fetchOptions.body;
    console.debug('[SupabaseAuth] Request body preview:', bodyPreview);
  } catch (e) {
    // ignore logging errors
  }

  const response = await fetch(url, fetchOptions);

  const raw = await response.text();
  let data: any = {};
  if (raw) {
    try {
      data = JSON.parse(raw) as T;
    } catch (parseErr) {
      // If response isn't valid JSON, preserve raw text for diagnostics
      data = { __raw: raw };
    }
  }

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && ('msg' in data || 'message' in data))
        ? String((data as any).msg ?? (data as any).message)
        : raw || `Supabase Auth request failed (${response.status})`;

    // Include status and raw body in the thrown error for easier debugging
    const err = new Error(String(message));
    (err as any).status = response.status;
    (err as any).raw = raw;
    throw err;
  }

  return data as T;
};

const requireEmailAndPassword = (body: AuthBody): { email: string; password: string } => {
  const email = body.email?.trim();
  const password = body.password?.trim();

  if (!email || !password) {
    throw withStatus('email and password are required', 400);
  }

  return { email, password };
};

const requireRefreshToken = (body: AuthBody): string => {
  const refreshToken = body.refresh_token?.trim();

  if (!refreshToken) {
    throw withStatus('refresh_token is required', 400);
  }

  return refreshToken;
};

export const authController = {
  async signUp(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = requireEmailAndPassword(readBody(req));
      const data = readBody(req).data ?? {};

      let result: SupabaseAuthResponse | null = null;
      try {
        result = await callSupabaseAuth<SupabaseAuthResponse>('/signup', {
          method: 'POST',
          body: JSON.stringify({
            email,
            password,
            options: {
              data,
            },
          }),
        });
      } catch (err: any) {
        console.warn('[Auth] Supabase signup REST failed, attempting admin fallback:', err?.message ?? err);

        // Fallback: if service role key is available, create user via admin API
        if (supabaseAdmin) {
          try {
            const { data: adminData, error: adminErr } = await supabaseAdmin.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
              user_metadata: data,
            } as any);

            if (adminErr) {
              throw adminErr;
            }

            result = {
              user: (adminData?.user ?? adminData) as unknown as Record<string, unknown>,
            } as SupabaseAuthResponse;
          } catch (adminCreateErr) {
            // Surface admin create errors
            console.error('[Auth] Admin createUser failed:', adminCreateErr);
            throw adminCreateErr;
          }
        } else {
          throw err;
        }
      }

      // Attempt to create an initial profile linked to the new user
      let createdProfile: Record<string, unknown> | null = null;
      let mongoUser: Record<string, unknown> | null = null;

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

          // Also create user in MongoDB for polyglot persistence
          try {
            const { createMongoUser } = await import('../users/user.controller');
            mongoUser = (await createMongoUser({
              supabase_id: userId,
              email: email,
              username: (usernameVal || usernameFromEmail) as string,
              name: (displayNameVal || usernameFromEmail) as string,
              ...(typeof data.bio === 'string' && { bio: data.bio }),
              ...(typeof data.avatar_url === 'string' && { avatar_url: data.avatar_url }),
            })) as unknown as Record<string, unknown>;
            console.log(`MongoDB user created for ${email}`);
          } catch (mongoErr) {
            // Log but don't fail - auth should still work even if MongoDB is down
            console.error('MongoDB user creation failed:', mongoErr);
          }
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
        mongoUser: mongoUser,
      });
    } catch (error) {
      // Log the actual error for debugging
      console.error('[Auth] Signup error details:', {
        message: (error as any)?.message,
        status: (error as any)?.status,
        raw: (error as any)?.raw,
        fullError: error,
      });

      // Pass through the original error instead of masking it
      const errorMessage = typeof (error as any)?.message === 'string' 
        ? (error as any).message 
        : 'Unknown auth error';
      
      return next(withStatus(errorMessage, (error as any)?.status ?? 500));
    }
  },

  async signIn(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = requireEmailAndPassword(readBody(req));

      console.log(`[Auth] Attempting sign-in for: ${email}`);

      // Use Supabase JS client to perform password sign-in to avoid manual REST handling
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }

      const result = data as unknown as SupabaseAuthResponse;

      // Construct session from either nested session object or direct tokens
      const session = result.session ?? {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      };

      console.log(`[Auth] Sign-in successful for: ${email}`);

      res.status(200).json({
        message: 'Login successful',
        user: result.user ?? null,
        session,
      });
    } catch (error) {
      // Log full Supabase error payload when available for debugging
      try {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[Auth] signIn error details:', {
          message,
          status: (error as any)?.status,
          raw: (error as any)?.raw,
        });
      } catch (e) {
        console.error('[Auth] signIn error:', error);
      }
      next(error);
    }
  },

  async refreshSession(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = requireRefreshToken(readBody(req));

      const refreshBody = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString();
      const result = await callSupabaseAuth<SupabaseAuthResponse>('/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: refreshBody,
      });

      // Construct session from either nested session object or direct tokens
      const session = result.session ?? {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      };

      res.status(200).json({
        message: 'Session refreshed',
        user: result.user ?? null,
        session,
      });
    } catch (error) {
      next(error);
    }
  },

  async signOut(req: Request, res: Response, next: NextFunction) {
    try {
      const accessToken = getAccessToken(req);

      if (!accessToken) {
        throw withStatus('Authorization bearer token is required', 401);
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
        throw withStatus('Authorization bearer token is required', 401);
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