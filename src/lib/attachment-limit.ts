export class AttachmentLimitError extends Error {
  constructor(message: string, readonly status: 429 | 507) {
    super(message);
  }
}
