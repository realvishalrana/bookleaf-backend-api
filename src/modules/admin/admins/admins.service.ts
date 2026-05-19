import { adminsRepository } from "./admins.repository";

export const adminsService = {
  async list() {
    const admins = await adminsRepository.findAll();
    return { admins };
  },
};
