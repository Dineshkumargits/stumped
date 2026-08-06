import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../../prisma/prisma.service';
import { AVATAR_COLORS } from '@stumped/shared';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.warn(
        '[AUTH] GOOGLE_CLIENT_ID not set. Google Sign-In will not work.',
      );
    }
    this.googleClient = new OAuth2Client(clientId);
  }

  /**
   * Verify Google ID token and create/retrieve user.
   * Returns the user and a JWT access token.
   */
  async googleSignIn(idToken: string) {
    if (process.env.NODE_ENV !== 'production' && idToken.startsWith('mock-token-')) {
      const nameParts = idToken.replace('mock-token-', '').split('-');
      const mockName = nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      const mockEmail = `${nameParts.join('.')}@example.com`;
      const mockGoogleId = `mock-google-id-${idToken}`;

      let user = await this.prisma.user.findUnique({
        where: { googleId: mockGoogleId },
        include: {
          clubMembers: {
            orderBy: {
              joinedAt: 'asc',
            },
          },
        },
      });

      if (!user) {
        const avatarColor =
          AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

        user = await this.prisma.user.create({
          data: {
            email: mockEmail,
            name: mockName,
            googleId: mockGoogleId,
            avatarColor,
          },
          include: {
            clubMembers: true,
          },
        });
      }

      const accessToken = this.jwtService.sign(
        {
          sub: user.id,
          email: user.email,
        },
        {
          algorithm: 'HS256',
          expiresIn: '7d',
        },
      );

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarColor: user.avatarColor,
        },
        accessToken,
        activeClubId: user.clubMembers?.[0]?.clubId || null,
      };
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      throw new UnauthorizedException(
        'Google Sign-In is not configured on this server.',
      );
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google ID token.');
    }

    if (!payload || !payload.email || !payload.sub) {
      throw new UnauthorizedException('Invalid token payload.');
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { googleId: payload.sub },
      include: {
        clubMembers: {
          orderBy: {
            joinedAt: 'asc',
          },
        },
      },
    });

    if (!user) {
      // Assign a random avatar color
      const avatarColor =
        AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

      user = await this.prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name || payload.email.split('@')[0],
          googleId: payload.sub,
          avatarColor,
        },
        include: {
          clubMembers: true,
        },
      });
    }

    // Generate JWT - MUST set 'exp' claim and validate it
    // MUST reject 'none' algorithm (handled by jsonwebtoken defaults)
    // MUST hardcode algorithm (HS256)
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
      },
      {
        algorithm: 'HS256',
        expiresIn: '7d',
      },
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarColor: user.avatarColor,
      },
      accessToken,
      activeClubId: user.clubMembers?.[0]?.clubId || null,
    };
  }

  /**
   * Validate JWT payload and return user.
   * Used by the JWT strategy.
   */
  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarColor: user.avatarColor,
    };
  }

  /**
   * Get the current authenticated user's profile with their clubs.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        clubMembers: {
          include: {
            club: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarColor: user.avatarColor,
      clubs: user.clubMembers.map((m) => ({
        id: m.club.id,
        name: m.club.name,
        role: m.role,
        inviteCode: m.club.inviteCode,
        joinedAt: m.joinedAt.toISOString(),
      })),
    };
  }
}
