import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/users/services/users.service';
import { LoginDto } from '../dtos/login.dto';
import { RegisterDto } from '../dtos/register.dto';
import { TokenPayload } from '../interfaces/token-payload.interface';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private userService: UsersService, private jwtService: JwtService, private configService: ConfigService) {}

  // Returning new Tokens Bodies with (user ID, enmail)
  private async getTokens(userId: string, email: string) {
    const tokenPayload: TokenPayload = {
      sub: userId,
      email,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(tokenPayload, {
        secret: this.configService.get('jwt.secret'),
        expiresIn: this.configService.get('jwt.expiresIn'),
      }),
      this.jwtService.signAsync(tokenPayload, {
        secret: this.configService.get('jwt.secret'),
        expiresIn: '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  // Token refreshing here for user
  private async updateRefreshToken(userId: string, refreshToken: string) {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.userService.setRefreshToken(userId, hashedRefreshToken);
  }

  // Register a User using DTO
  async register(registerDto: RegisterDto) {
    const user = await this.userService.create(registerDto);
    const tokens = await this.getTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      ...tokens,
    };
  }

  // Login the user using DTO
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    const tokens = await this.getTokens(user.id, user.email);
    // now set the new refresh Token to user data Object after login
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      ...tokens,
    };
  }

  // If user want to refresh or login frequently then token need to refresh
  async refreshTokens(refreshToken: string) {
    try {
      // verify the refresh token here
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get('jwt.secret'),
      });

      const userId = payload.sub;

      // find user with this Id
      const user = await this.userService.findOne(userId);

      if (!user || !user.refreshToken) {
        throw new ForbiddenException('Access Denied');
      }

      // verify that the provided refresh token matches the stored hash
      const refreshTokenMatches = await bcrypt.compare(refreshToken, user.refreshToken);

      if (!refreshTokenMatches) {
        throw new ForbiddenException('Access denied');
      }

      // Generate new Token here
      const tokens = await this.getTokens(user.id, user.email);
      await this.updateRefreshToken(user.id, tokens.refreshToken);

      return tokens;
    } catch (error) {
      throw new ForbiddenException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.userService.setRefreshToken(userId, null);
    return { message: 'logout successfull' };
  }
}
