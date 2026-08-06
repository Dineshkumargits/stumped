import * as crypto from 'crypto';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MemberRole, INVITE_CODE_CHARS, INVITE_CODE_LENGTH } from '@stumped/shared';

@Injectable()
export class ClubService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a cryptographically random invite code.
   * Uses crypto.randomInt for secure randomness.
   */
  private generateInviteCode(): string {
    let code = '';
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
      const idx = crypto.randomInt(0, INVITE_CODE_CHARS.length);
      code += INVITE_CODE_CHARS[idx];
    }
    return code;
  }

  /**
   * Create a new club. The creator becomes the ADMIN.
   */
  async createClub(userId: string, name: string) {
    // Generate a unique invite code
    let inviteCode: string;
    let attempts = 0;
    do {
      inviteCode = this.generateInviteCode();
      const existing = await this.prisma.club.findUnique({
        where: { inviteCode },
      });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      throw new ConflictException('Unable to generate unique invite code. Please try again.');
    }

    const club = await this.prisma.club.create({
      data: {
        name,
        inviteCode,
        members: {
          create: {
            userId,
            role: MemberRole.ADMIN,
          },
        },
      },
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    return club;
  }

  /**
   * Join a club using an invite code.
   */
  async joinClub(userId: string, inviteCode: string) {
    const club = await this.prisma.club.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
    });

    if (!club) {
      throw new NotFoundException('Invalid invite code.');
    }

    // Check if user is already a member
    const existingMember = await this.prisma.clubMember.findUnique({
      where: {
        userId_clubId: { userId, clubId: club.id },
      },
    });

    if (existingMember) {
      return this.prisma.clubMember.findUnique({
        where: { id: existingMember.id },
        include: {
          club: true,
        },
      });
    }

    const member = await this.prisma.clubMember.create({
      data: {
        userId,
        clubId: club.id,
        role: MemberRole.PLAYER,
      },
      include: {
        club: true,
      },
    });

    return member;
  }

  /**
   * Get clubs the user belongs to.
   */
  async getMyClubs(userId: string) {
    const memberships = await this.prisma.clubMember.findMany({
      where: { userId },
      include: {
        club: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map((m) => ({
      id: m.club.id,
      name: m.club.name,
      inviteCode: m.club.inviteCode,
      role: m.role,
      memberCount: m.club._count.members,
      joinedAt: m.joinedAt.toISOString(),
    }));
  }

  /**
   * PUBLIC (no auth): resolve a club by its invite code for the public
   * scores site. Returns only non-sensitive summary info — no member
   * emails, no invite regeneration, no mutations.
   */
  async getPublicClubByCode(inviteCode: string) {
    const club = await this.prisma.club.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
      include: {
        _count: { select: { players: true, matches: true, members: true } },
      },
    });

    if (!club) {
      throw new NotFoundException('No club found for that code.');
    }

    return {
      id: club.id,
      name: club.name,
      inviteCode: club.inviteCode,
      playerCount: club._count.players,
      matchCount: club._count.matches,
      memberCount: club._count.members,
    };
  }

  /**
   * Get full club details including all members.
   */
  async getClubDetails(userId: string, clubId: string) {
    // Verify user is a member of this club (authorization check)
    await this.verifyMembership(userId, clubId);

    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarColor: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        _count: {
          select: { players: true, matches: true },
        },
      },
    });

    if (!club) {
      throw new NotFoundException('Club not found.');
    }

    return {
      id: club.id,
      name: club.name,
      inviteCode: club.inviteCode,
      memberCount: club.members.length,
      playerCount: club._count.players,
      matchCount: club._count.matches,
      members: club.members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        avatarColor: m.user.avatarColor,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
    };
  }

  /**
   * Update a member's role. Only admins can do this.
   */
  async updateMemberRole(
    adminUserId: string,
    clubId: string,
    targetUserId: string,
    newRole: MemberRole,
  ) {
    // Verify the requesting user is an admin
    await this.verifyAdmin(adminUserId, clubId);

    // Cannot change own role
    if (adminUserId === targetUserId) {
      throw new ForbiddenException('Cannot change your own role.');
    }

    const targetMember = await this.prisma.clubMember.findUnique({
      where: {
        userId_clubId: { userId: targetUserId, clubId },
      },
    });

    if (!targetMember) {
      throw new NotFoundException('Member not found in this club.');
    }

    return this.prisma.clubMember.update({
      where: { id: targetMember.id },
      data: { role: newRole },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarColor: true },
        },
      },
    });
  }

  /**
   * Regenerate the invite code for a club. Only admins can do this.
   */
  async regenerateInviteCode(adminUserId: string, clubId: string) {
    await this.verifyAdmin(adminUserId, clubId);

    const newCode = this.generateInviteCode();

    const club = await this.prisma.club.update({
      where: { id: clubId },
      data: { inviteCode: newCode },
    });

    return club.inviteCode;
  }

  /**
   * Verify user is a member of the club. Throws if not.
   */
  async verifyMembership(userId: string, clubId: string) {
    const member = await this.prisma.clubMember.findUnique({
      where: {
        userId_clubId: { userId, clubId },
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this club.');
    }

    return member;
  }

  /**
   * Verify user is an admin of the club. Throws if not.
   */
  async verifyAdmin(userId: string, clubId: string) {
    const member = await this.verifyMembership(userId, clubId);

    if (member.role !== MemberRole.ADMIN) {
      throw new ForbiddenException('Only admins can perform this action.');
    }

    return member;
  }

  /**
   * Verify user is at least a scorer in the club. Throws if not.
   */
  async verifyScorerOrAdmin(userId: string, clubId: string) {
    const member = await this.verifyMembership(userId, clubId);

    if (member.role === MemberRole.PLAYER) {
      throw new ForbiddenException('Only scorers and admins can perform this action.');
    }

    return member;
  }

  /**
   * Remove (kick) a member from the club. Only admins can do this.
   */
  async removeMember(adminUserId: string, clubId: string, targetUserId: string) {
    // Verify the requesting user is an admin
    await this.verifyAdmin(adminUserId, clubId);

    // Cannot remove yourself
    if (adminUserId === targetUserId) {
      throw new ForbiddenException('Cannot remove yourself from the club.');
    }

    const member = await this.prisma.clubMember.findUnique({
      where: {
        userId_clubId: { userId: targetUserId, clubId },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this club.');
    }

    // Unlink the user from any player in this club
    await this.prisma.player.updateMany({
      where: { clubId, linkedUserId: targetUserId },
      data: { linkedUserId: null },
    });

    return this.prisma.clubMember.delete({
      where: { id: member.id },
    });
  }
}
