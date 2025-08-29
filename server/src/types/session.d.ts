import 'express-session';

declare module 'express-session' {
  interface SessionData {
    githubUserData?: {
      githubId: string;
      email: string;
      username: string;
      displayName: string;
      avatarUrl?: string;
      accessToken: string;
    };
    authToken?: string;
  }
}