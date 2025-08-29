/**
 * Passport Configuration for GitHub OAuth
 * 
 * Requirements:
 * - Configure GitHub OAuth strategy
 * - Handle user creation/lookup from GitHub profile
 * - Encrypt and store GitHub access tokens
 * - Integrate with existing team system
 */

import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { PrismaClient } from '@prisma/client';
import { cryptoService } from '../../services/crypto.js';

// Create and immediately connect Prisma client
const prisma = new PrismaClient({
  errorFormat: 'pretty',
});

// Connect to database immediately
prisma.$connect().catch((error) => {
  console.error('❌ Passport Prisma connection failed:', error);
});

const GITHUB_CLIENT_ID = process.env['GITHUB_CLIENT_ID'];
const GITHUB_CLIENT_SECRET = process.env['GITHUB_CLIENT_SECRET'];
const GITHUB_CALLBACK_URL = process.env['GITHUB_CALLBACK_URL'];

if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET || !GITHUB_CALLBACK_URL) {
  console.warn('GitHub OAuth environment variables not configured. GitHub authentication will be disabled.');
} else {
  console.log('GitHub OAuth configured:', {
    clientId: GITHUB_CLIENT_ID,
    callbackUrl: GITHUB_CALLBACK_URL,
    secretLength: GITHUB_CLIENT_SECRET?.length
  });
}

export const configurePassport = () => {

  // Serialize user for session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.users.findUnique({
        where: { id },
        include: { teams: true }
      });
      
      if (user) {
        // Transform Prisma user to Passport User interface
        const passportUser: Express.User = {
          userId: user.id,
          teamId: user.teamId
        };
        done(null, passportUser);
      } else {
        done(null, null);
      }
    } catch (error) {
      done(error, null);
    }
  });

  // GitHub OAuth Strategy
  if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET && GITHUB_CALLBACK_URL) {
    const strategy = new GitHubStrategy({
      clientID: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
      callbackURL: GITHUB_CALLBACK_URL,
      scope: ['user:email', 'read:user']
    },
    async (accessToken: string, _refreshToken: string, profile: any, done: any) => {
      console.log('GitHub OAuth callback received:', {
        hasAccessToken: !!accessToken,
        hasProfile: !!profile,
        profileId: profile?.id,
        profileUsername: profile?.username
      });
      try {
        const githubId = profile.id;
        const email = profile.emails?.[0]?.value;
        const username = profile.username;
        const displayName = profile.displayName || username;
        const avatarUrl = profile.photos?.[0]?.value;

        console.log('GitHub profile data:', { githubId, email, username, displayName, avatarUrl });

        if (!email) {
          console.error('No email provided by GitHub profile');
          return done(new Error('No email provided by GitHub'), null);
        }

        // Check if user already exists by GitHub ID
        console.log('Looking up user by GitHub ID:', githubId);
        let user = await prisma.users.findUnique({
          where: { githubId },
          include: { teams: true }
        });

        console.log('User lookup by GitHub ID result:', { found: !!user, userId: user?.id });

        if (user) {
          // Update existing user's access token and profile info
          const encryptedToken = cryptoService.encrypt(accessToken);
          const updatedUser = await prisma.users.update({
            where: { id: user.id },
            data: {
              accessToken: JSON.stringify(encryptedToken),
              avatarUrl,
              githubUsername: username
            },
            include: { teams: true }
          });
          
          // Transform to Passport User interface
          const passportUser: Express.User = {
            userId: updatedUser.id,
            teamId: updatedUser.teamId
          };
          return done(null, passportUser);
        }

        // Check if user exists by email (for linking existing accounts)
        console.log('Looking up user by email:', email);
        user = await prisma.users.findUnique({
          where: { email },
          include: { teams: true }
        });

        console.log('User lookup by email result:', { found: !!user, userId: user?.id });

        if (user) {
          // Link GitHub account to existing user
          const encryptedToken = cryptoService.encrypt(accessToken);
          const updatedUser = await prisma.users.update({
            where: { id: user.id },
            data: {
              githubId,
              githubUsername: username,
              avatarUrl,
              accessToken: JSON.stringify(encryptedToken)
            },
            include: { teams: true }
          });
          
          // Transform to Passport User interface
          const passportUser: Express.User = {
            userId: updatedUser.id,
            teamId: updatedUser.teamId
          };
          return done(null, passportUser);
        }

        // Create new user - but they need to join/create a team
        // We'll store their info temporarily in the session
        console.log('Creating new GitHub user signup data');
        const githubUserData = {
          githubId,
          email,
          username,
          displayName,
          avatarUrl,
          accessToken
        };

        console.log('Returning signup required with GitHub user data');
        // For new users, we need to pass through the request to store in session
        // Return false to indicate authentication failed (user needs to complete signup)
        return done(null, false, { 
          message: 'github_signup_required',
          githubUserData 
        });

      } catch (error) {
        console.error('GitHub OAuth error:', error);
        return done(error, null);
      }
    });
    
    passport.use(strategy);
  }
};

export default passport;