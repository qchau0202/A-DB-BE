import { mutualConnectionsQuery } from './social-graph.queries';

export const socialGraphService = {
  getMutualConnectionQuery: () => mutualConnectionsQuery,
};
