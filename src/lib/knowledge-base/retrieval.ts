import type { KnowledgeEntryType } from "@prisma/client";

/**
 * Tenant-scoped knowledge retrieval request.
 * workspaceId maps to organisationId in this codebase.
 */
export type KnowledgeRetrievalRequest = {
  workspaceId: string;
  organisationId: string;
  projectId?: string;
  brandId?: string;
  campaignId?: string;
  query: string;
  entryTypes?: KnowledgeEntryType[];
  approvedOnly?: boolean;
  limit?: number;
};

export type KnowledgeRetrievalResult = {
  id: string;
  type: KnowledgeEntryType;
  title: string;
  summary: string | null;
  content: string;
  confidence: number | null;
  sourceType: string;
  sourceReference: string | null;
  relevanceScore: number;
};

export type KnowledgeRetrievalResponse = {
  results: KnowledgeRetrievalResult[];
  totalMatched: number;
  searchMode: "deterministic";
};

/**
 * Future semantic/vector search provider interface.
 * Not implemented in this stage — deterministic text search is used instead.
 */
export interface KnowledgeSemanticSearchProvider {
  embed(text: string): Promise<number[]>;
  search(params: {
    organisationId: string;
    brandId?: string;
    queryEmbedding: number[];
    limit: number;
    filters?: {
      entryTypes?: KnowledgeEntryType[];
      approvedOnly?: boolean;
    };
  }): Promise<KnowledgeRetrievalResult[]>;
}

export const KNOWLEDGE_SEMANTIC_SEARCH_NOT_CONFIGURED =
  "Semantic search is not configured. Use deterministic retrieval.";
