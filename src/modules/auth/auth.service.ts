import bcrypt from "bcrypt";
import { signToken } from "../../shared/middleware/auth";
import { UnauthorizedError } from "../../shared/lib/errors";
import { authRepository } from "./auth.repository";
import type { LoginInput } from "./auth.schema";

export const authService = {
  async login(input: LoginInput) {
    const user = await authRepository.findUserByEmail(input.email);
    if (!user || !(await bcrypt.compare(input.password, user.password))) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const token = signToken(user);
    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        authorId: user.authorId,
        name: user.name,
      },
    };
  },
};
