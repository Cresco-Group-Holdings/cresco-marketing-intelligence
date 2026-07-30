-- Task 4.8: Internal Linking Intelligence

CREATE TYPE "InternalLinkGraphStatus" AS ENUM ('BUILDING', 'READY', 'STALE', 'ARCHIVED');
CREATE TYPE "InternalLinkAnchorType" AS ENUM ('BRANDED', 'PARTIAL_MATCH', 'GENERIC', 'NAVIGATIONAL', 'DESCRIPTIVE', 'IMAGE', 'EMPTY');
CREATE TYPE "InternalLinkIssueType" AS ENUM (
  'ORPHAN_PAGE', 'NEAR_ORPHAN_PAGE', 'BROKEN_INTERNAL_LINK', 'LINK_TO_REDIRECT',
  'LINK_TO_NOINDEX', 'EXCESSIVE_CRAWL_DEPTH', 'ANCHOR_REPETITION', 'DISCONNECTED_CLUSTER',
  'LOW_INTERNAL_SUPPORT', 'OBSOLETE_LINK', 'CANONICAL_CONFLICT'
);
CREATE TYPE "InternalLinkIssueStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');
CREATE TYPE "InternalLinkRecommendationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'IMPLEMENTED', 'VERIFIED', 'DISMISSED');
CREATE TYPE "InternalLinkChangeProposalStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED', 'EXPORTED', 'IMPLEMENTED', 'VERIFIED');

CREATE TABLE "InternalLinkGraph" (
  "id" TEXT NOT NULL, "organisationId" TEXT NOT NULL, "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL, "seoSiteId" TEXT NOT NULL, "crawlRunId" TEXT,
  "status" "InternalLinkGraphStatus" NOT NULL DEFAULT 'BUILDING',
  "nodeCount" INT NOT NULL DEFAULT 0, "edgeCount" INT NOT NULL DEFAULT 0,
  "metrics" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternalLinkGraph_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InternalLinkNode" (
  "id" TEXT NOT NULL, "organisationId" TEXT NOT NULL, "graphId" TEXT NOT NULL,
  "crawlPageId" TEXT, "url" TEXT NOT NULL, "title" TEXT, "pageType" TEXT,
  "isIndexable" BOOLEAN NOT NULL DEFAULT true, "crawlDepth" INT,
  "incomingCount" INT NOT NULL DEFAULT 0, "outgoingCount" INT NOT NULL DEFAULT 0,
  "isOrphan" BOOLEAN NOT NULL DEFAULT false, "isNearOrphan" BOOLEAN NOT NULL DEFAULT false,
  "clusterId" TEXT, "topicalConnections" INT NOT NULL DEFAULT 0, "metrics" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternalLinkNode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InternalLinkEdge" (
  "id" TEXT NOT NULL, "organisationId" TEXT NOT NULL, "graphId" TEXT NOT NULL,
  "sourceNodeId" TEXT NOT NULL, "targetNodeId" TEXT, "targetUrl" TEXT NOT NULL,
  "anchorText" TEXT, "anchorType" "InternalLinkAnchorType",
  "isFollowed" BOOLEAN NOT NULL DEFAULT true, "statusCode" INT,
  "isBroken" BOOLEAN NOT NULL DEFAULT false, "isRedirect" BOOLEAN NOT NULL DEFAULT false,
  "isNoindexTarget" BOOLEAN NOT NULL DEFAULT false, "isObsolete" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalLinkEdge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InternalLinkSnapshot" (
  "id" TEXT NOT NULL, "organisationId" TEXT NOT NULL, "graphId" TEXT NOT NULL,
  "versionNumber" INT NOT NULL, "nodeCount" INT NOT NULL, "edgeCount" INT NOT NULL,
  "metrics" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalLinkSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InternalLinkRecommendation" (
  "id" TEXT NOT NULL, "organisationId" TEXT NOT NULL, "graphId" TEXT NOT NULL,
  "sourceNodeId" TEXT NOT NULL, "targetNodeId" TEXT NOT NULL,
  "suggestedAnchorConcept" TEXT NOT NULL, "contextualReason" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL, "evidence" JSONB NOT NULL,
  "potentialConflict" TEXT, "status" "InternalLinkRecommendationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternalLinkRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InternalLinkAnchor" (
  "id" TEXT NOT NULL, "organisationId" TEXT NOT NULL, "graphId" TEXT NOT NULL,
  "nodeId" TEXT, "anchorText" TEXT NOT NULL, "classification" "InternalLinkAnchorType" NOT NULL,
  "occurrenceCount" INT NOT NULL DEFAULT 1, "isRepetitive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalLinkAnchor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InternalLinkIssue" (
  "id" TEXT NOT NULL, "organisationId" TEXT NOT NULL, "graphId" TEXT NOT NULL,
  "issueType" "InternalLinkIssueType" NOT NULL, "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "title" TEXT NOT NULL, "description" TEXT NOT NULL, "evidence" JSONB NOT NULL,
  "status" "InternalLinkIssueStatus" NOT NULL DEFAULT 'OPEN',
  "sourceNodeId" TEXT, "targetNodeId" TEXT, "edgeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternalLinkIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InternalLinkChangeProposal" (
  "id" TEXT NOT NULL, "organisationId" TEXT NOT NULL, "graphId" TEXT NOT NULL,
  "recommendationId" TEXT, "status" "InternalLinkChangeProposalStatus" NOT NULL DEFAULT 'DRAFT',
  "editedAnchorConcept" TEXT, "assignedToUserId" TEXT, "exportPayload" JSONB,
  "implementedAt" TIMESTAMP(3), "verifiedAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternalLinkChangeProposal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InternalLinkNode_graphId_url_key" ON "InternalLinkNode"("graphId", "url");
CREATE UNIQUE INDEX "InternalLinkSnapshot_graphId_versionNumber_key" ON "InternalLinkSnapshot"("graphId", "versionNumber");
CREATE INDEX "InternalLinkGraph_organisationId_brandId_status_idx" ON "InternalLinkGraph"("organisationId", "brandId", "status");
CREATE INDEX "InternalLinkGraph_seoSiteId_idx" ON "InternalLinkGraph"("seoSiteId");
CREATE INDEX "InternalLinkNode_graphId_isOrphan_idx" ON "InternalLinkNode"("graphId", "isOrphan");
CREATE INDEX "InternalLinkNode_graphId_crawlDepth_idx" ON "InternalLinkNode"("graphId", "crawlDepth");
CREATE INDEX "InternalLinkEdge_graphId_sourceNodeId_idx" ON "InternalLinkEdge"("graphId", "sourceNodeId");
CREATE INDEX "InternalLinkRecommendation_graphId_status_idx" ON "InternalLinkRecommendation"("graphId", "status");
CREATE INDEX "InternalLinkIssue_graphId_issueType_status_idx" ON "InternalLinkIssue"("graphId", "issueType", "status");
CREATE INDEX "InternalLinkChangeProposal_graphId_status_idx" ON "InternalLinkChangeProposal"("graphId", "status");

ALTER TABLE "InternalLinkGraph" ADD CONSTRAINT "InternalLinkGraph_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLinkGraph" ADD CONSTRAINT "InternalLinkGraph_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLinkGraph" ADD CONSTRAINT "InternalLinkGraph_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLinkGraph" ADD CONSTRAINT "InternalLinkGraph_seoSiteId_fkey" FOREIGN KEY ("seoSiteId") REFERENCES "SeoSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLinkGraph" ADD CONSTRAINT "InternalLinkGraph_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "SeoCrawlRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InternalLinkNode" ADD CONSTRAINT "InternalLinkNode_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLinkNode" ADD CONSTRAINT "InternalLinkNode_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "InternalLinkGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLinkNode" ADD CONSTRAINT "InternalLinkNode_crawlPageId_fkey" FOREIGN KEY ("crawlPageId") REFERENCES "SeoCrawlPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InternalLinkNode" ADD CONSTRAINT "InternalLinkNode_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "SeoTopicCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InternalLinkEdge" ADD CONSTRAINT "InternalLinkEdge_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLinkEdge" ADD CONSTRAINT "InternalLinkEdge_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "InternalLinkGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLinkEdge" ADD CONSTRAINT "InternalLinkEdge_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "InternalLinkNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLinkEdge" ADD CONSTRAINT "InternalLinkEdge_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "InternalLinkNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InternalLinkSnapshot" ADD CONSTRAINT "InternalLinkSnapshot_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLinkSnapshot" ADD CONSTRAINT "InternalLinkSnapshot_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "InternalLinkGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InternalLinkRecommendation" ADD CONSTRAINT "InternalLinkRecommendation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLinkRecommendation" ADD CONSTRAINT "InternalLinkRecommendation_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "InternalLinkGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLinkRecommendation" ADD CONSTRAINT "InternalLinkRecommendation_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "InternalLinkNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLinkRecommendation" ADD CONSTRAINT "InternalLinkRecommendation_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "InternalLinkNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InternalLinkAnchor" ADD CONSTRAINT "InternalLinkAnchor_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLinkAnchor" ADD CONSTRAINT "InternalLinkAnchor_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "InternalLinkGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLinkAnchor" ADD CONSTRAINT "InternalLinkAnchor_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "InternalLinkNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InternalLinkIssue" ADD CONSTRAINT "InternalLinkIssue_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLinkIssue" ADD CONSTRAINT "InternalLinkIssue_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "InternalLinkGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLinkIssue" ADD CONSTRAINT "InternalLinkIssue_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "InternalLinkNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InternalLinkIssue" ADD CONSTRAINT "InternalLinkIssue_edgeId_fkey" FOREIGN KEY ("edgeId") REFERENCES "InternalLinkEdge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InternalLinkChangeProposal" ADD CONSTRAINT "InternalLinkChangeProposal_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLinkChangeProposal" ADD CONSTRAINT "InternalLinkChangeProposal_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "InternalLinkGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLinkChangeProposal" ADD CONSTRAINT "InternalLinkChangeProposal_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "InternalLinkRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InternalLinkChangeProposal" ADD CONSTRAINT "InternalLinkChangeProposal_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InternalLinkChangeProposal" ADD CONSTRAINT "InternalLinkChangeProposal_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
