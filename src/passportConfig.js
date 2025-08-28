const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Strategy: FacebookStrategy } = require('passport-facebook');
const { PrismaClient } = require('@prisma/client'); // Updated import
const prisma = new PrismaClient(); // Instantiate Prisma client here
const { registerOrLoginSocialUser } = require('./services/authService');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('Google profile:', profile);
        const user = await registerOrLoginSocialUser({
          name: profile.displayName,
          email: profile.emails && profile.emails[0] ? profile.emails[0].value : null,
          provider: 'google',
          providerId: profile.id,
        });
        done(null, user.user);
      } catch (error) {
        console.error('Google auth error:', error);
        done(error, null);
      }
    }
  )
);

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/api/auth/facebook/callback`,
      profileFields: ['id', 'displayName', 'emails'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('Facebook profile:', profile);
        const user = await registerOrLoginSocialUser({
          name: profile.displayName,
          email: profile.emails && profile.emails[0] ? profile.emails[0].value : null,
          provider: 'facebook',
          providerId: profile.id,
        });
        done(null, user.user);
      } catch (error) {
        console.error('Facebook auth error:', error);
        done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  console.log('Serializing user:', user.id);
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    console.log('Deserializing user with ID:', id);
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });
    if (!user) {
      return done(new Error('User not found'), null);
    }
    done(null, user);
  } catch (error) {
    console.error('Deserialize error:', error);
    done(error, null);
  }
});

module.exports = passport;