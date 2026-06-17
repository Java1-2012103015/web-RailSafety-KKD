import type { RegistrationRequest } from "@prisma/client";
import { RegistrationRequestRepository } from "../repositories/registration-request.repository";
import { UserRepository } from "../repositories/user.repository";
import { RoleRepository } from "../repositories/role.repository";
import { HttpError } from "../utils/http-error";
import { hashPassword } from "../utils/password";
import { ROLES } from "../constants/roles";

export class RegistrationRequestService {
  constructor(
    private readonly registrationRequestRepository: RegistrationRequestRepository,
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
  ) {}

  async checkEmailAvailable(email: string): Promise<{ available: boolean; message: string }> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      throw new HttpError(400, "이메일을 입력해 주세요.");
    }

    const existingUser = await this.userRepository.findByEmail(normalized);
    if (existingUser) {
      return { available: false, message: "이미 사용 중인 이메일입니다." };
    }

    const pending = await this.registrationRequestRepository.findPendingByEmail(normalized);
    if (pending) {
      return { available: false, message: "이미 사용등록 신청이 접수된 이메일입니다." };
    }

    return { available: true, message: "사용 가능한 이메일입니다." };
  }

  async submitRequest(input: {
    email?: string;
    password?: string;
    passwordConfirm?: string;
    name?: string;
    affiliation?: string;
  }): Promise<{ id: number; email: string }> {
    const email = input.email?.trim().toLowerCase();
    const password = input.password ?? "";
    const passwordConfirm = input.passwordConfirm ?? "";
    const name = input.name?.trim();
    const affiliation = input.affiliation?.trim();

    if (!email || !password || !name || !affiliation) {
      throw new HttpError(400, "이메일, 소속, 성함, 비밀번호를 모두 입력해 주세요.");
    }
    if (password.length < 6) {
      throw new HttpError(400, "비밀번호는 6자 이상이어야 합니다.");
    }
    if (password !== passwordConfirm) {
      throw new HttpError(400, "비밀번호 확인이 일치하지 않습니다.");
    }

    const availability = await this.checkEmailAvailable(email);
    if (!availability.available) {
      throw new HttpError(409, availability.message);
    }

    const request = await this.registrationRequestRepository.create({
      email,
      password: await hashPassword(password),
      name,
      affiliation,
    });

    return { id: request.id, email: request.email };
  }

  async listPending(): Promise<RegistrationRequest[]> {
    return this.registrationRequestRepository.findManyByStatus("PENDING");
  }

  async approve(id: number, roleId: number): Promise<{ userId: number; email: string }> {
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Invalid request id.");
    }
    if (!Number.isInteger(roleId) || roleId < 1) {
      throw new HttpError(400, "권한(역할)을 선택해 주세요.");
    }

    const request = await this.registrationRequestRepository.findById(id);
    if (!request || request.status !== "PENDING") {
      throw new HttpError(404, "대기 중인 사용등록 신청을 찾을 수 없습니다.");
    }

    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new HttpError(400, "Invalid role ID.");
    }
    if (role.name === ROLES.ADMIN) {
      throw new HttpError(400, "관리자 권한은 사용등록 승인으로 부여할 수 없습니다.");
    }

    const existingUser = await this.userRepository.findByEmail(request.email);
    if (existingUser) {
      throw new HttpError(409, "이미 등록된 사용자입니다.");
    }

    const user = await this.userRepository.create({
      email: request.email,
      password: request.password,
      name: request.name,
      roleId,
      affiliation: request.affiliation,
    });

    await this.registrationRequestRepository.update(id, {
      status: "APPROVED",
      assignedRole: { connect: { id: roleId } },
      reviewedAt: new Date(),
    });

    return { userId: user.id, email: user.email };
  }

  async reject(id: number): Promise<void> {
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Invalid request id.");
    }

    const request = await this.registrationRequestRepository.findById(id);
    if (!request || request.status !== "PENDING") {
      throw new HttpError(404, "대기 중인 사용등록 신청을 찾을 수 없습니다.");
    }

    await this.registrationRequestRepository.update(id, {
      status: "REJECTED",
      reviewedAt: new Date(),
    });
  }
}
