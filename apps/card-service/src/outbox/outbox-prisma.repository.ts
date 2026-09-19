import { Injectable } from "@nestjs/common";
import { DomainEvent, OutboxRecord, OutboxRepository } from "@digital-banking/events";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OutboxPrismaRepository implements OutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUnpublished(limit: number): Promise<OutboxRecord[]> {
    const rows = await this.prisma.outboxEvent.findMany({
      where: { published: false },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      event: row.payload as unknown as DomainEvent,
    }));
  }

  async markPublished(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { published: true, publishedAt: new Date() },
    });
  }

  async markFailed(id: string, error: Error): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { attempts: { increment: 1 }, lastError: error.message },
    });
  }
}
