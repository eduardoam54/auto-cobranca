export interface AiAgentTools {
  findClientByPhone(phone: string, companyId: string): Promise<unknown>;
  listClientOpenCollections(
    clientId: string,
    companyId: string,
  ): Promise<unknown[]>;
  listClientHistory(clientId: string, companyId: string): Promise<unknown[]>;
  createCollectionTask(payload: unknown): Promise<unknown>;
  registerHistoryEvent(payload: unknown): Promise<unknown>;
  sendWhatsappMessage(payload: unknown): Promise<unknown>;
  listAvailableCollectors(companyId: string): Promise<unknown[]>;
  suggestCollectorByRoute(payload: unknown): Promise<unknown>;
}
