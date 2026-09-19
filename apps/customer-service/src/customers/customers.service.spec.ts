import { ForbiddenDomainError, Role } from "@digital-banking/shared";
import { AuthenticatedUser } from "@digital-banking/auth";
import { CustomersService } from "./customers.service";

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { userId: "user-1", tenantId: "tenant-1", roles: [Role.CUSTOMER], permissions: [], ...overrides };
}

describe("CustomersService", () => {
  function makePrisma(customer: Record<string, unknown> | null) {
    return {
      customer: {
        findFirst: jest.fn().mockResolvedValue(customer),
      },
    };
  }

  it("lets a customer read their own profile", async () => {
    const prisma = makePrisma({ id: "user-1", tenantId: "tenant-1" });
    const service = new CustomersService(prisma as never);

    await expect(service.findById(makeUser(), "user-1")).resolves.toMatchObject({ id: "user-1" });
  });

  it("blocks a customer from reading another customer's profile", async () => {
    const prisma = makePrisma({ id: "user-2", tenantId: "tenant-1" });
    const service = new CustomersService(prisma as never);

    await expect(service.findById(makeUser(), "user-2")).rejects.toBeInstanceOf(ForbiddenDomainError);
  });

  it("lets staff read any customer's profile in-tenant", async () => {
    const prisma = makePrisma({ id: "user-2", tenantId: "tenant-1" });
    const service = new CustomersService(prisma as never);
    const staff = makeUser({ userId: "staff-1", roles: [Role.OPERATIONS] });

    await expect(service.findById(staff, "user-2")).resolves.toMatchObject({ id: "user-2" });
  });
});
