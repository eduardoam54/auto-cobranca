import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser, JwtPayload } from './types/authenticated-user.type';
import { UserService } from '../users/users.service';
import { PrismaService } from '../infra/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.userService.findActiveUserByEmail(loginDto.email);
    const passwordMatches = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const safeUser: AuthenticatedUser = {
      id: user.id,
      companyId: user.companyId,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const { accessToken, refreshToken } = await this.generateTokenPair(safeUser);

    return { accessToken, refreshToken, user: safeUser };
  }

  async refresh(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalido ou expirado.');
    }

    // Rotaciona: revoga o token atual e emite um novo par
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const safeUser: AuthenticatedUser = {
      id: stored.user.id,
      companyId: stored.user.companyId,
      name: stored.user.name,
      email: stored.user.email,
      role: stored.user.role,
    };

    return this.generateTokenPair(safeUser);
  }

  async logout(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async generateTokenPair(user: AuthenticatedUser) {
    const payload: JwtPayload = {
      sub: user.id,
      companyId: user.companyId,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);

    const expiresInDays = this.parseRefreshExpiryDays();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: user.id,
        companyId: user.companyId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseRefreshExpiryDays(): number {
    const raw = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d');
    const match = /^(\d+)d$/.exec(raw);
    return match ? parseInt(match[1], 10) : 30;
  }
}
