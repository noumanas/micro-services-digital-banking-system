import { Injectable } from "@nestjs/common";
import { DeadLetterInput, DeadLetterRepository } from "@digital-banking/events";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DeadLetterPrismaRepository implements DeadLetterRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: DeadLetterInput): Promise<void> {
    await this.prisma.deadLetter.create({
      data: {
        consumerName: input.consumerName,
        topic: input.topic,
        eventId: input.event?.eventId,
        eventType: input.event?.eventType,
        payload: input.event ? (input.event as unknown as object) : undefined,
        rawValue: input.rawValue,
        errorMessage: input.errorMessage,
        retryCount: input.retryCount,
      },
    });
  }
}
