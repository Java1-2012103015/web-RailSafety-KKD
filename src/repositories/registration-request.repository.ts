import type { Prisma, RegistrationRequest, RegistrationRequestStatus } from "@prisma/client";
import { prisma } from "../config/prisma";

export class RegistrationRequestRepository {
  findPendingByEmail(email: string): Promise<RegistrationRequest | null> {
    return prisma.registrationRequest.findFirst({
      where: { email, status: "PENDING" },
    });
  }

  findById(id: number): Promise<RegistrationRequest | null> {
    return prisma.registrationRequest.findUnique({ where: { id } });
  }

  findManyByStatus(status: RegistrationRequestStatus): Promise<RegistrationRequest[]> {
    return prisma.registrationRequest.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
    });
  }

  create(data: Prisma.RegistrationRequestCreateInput): Promise<RegistrationRequest> {
    return prisma.registrationRequest.create({ data });
  }

  update(id: number, data: Prisma.RegistrationRequestUpdateInput): Promise<RegistrationRequest> {
    return prisma.registrationRequest.update({ where: { id }, data });
  }
}
