export const mutualConnectionsQuery = `
WITH RECURSIVE connection_path AS (
  SELECT
    f."FollowerID" AS source_user_id,
    f."FolloweeID" AS connected_user_id,
    1 AS depth,
    ARRAY[f."FollowerID", f."FolloweeID"] AS path
  FROM "Following" f
  WHERE f."FollowerID" = $1

  UNION ALL

  SELECT
    cp.source_user_id,
    f."FolloweeID" AS connected_user_id,
    cp.depth + 1,
    cp.path || f."FolloweeID"
  FROM connection_path cp
  JOIN "Following" f ON f."FollowerID" = cp.connected_user_id
  WHERE cp.depth < 3
    AND NOT (f."FolloweeID" = ANY(cp.path))
)
SELECT DISTINCT connected_user_id, depth
FROM connection_path
WHERE connected_user_id != $1
ORDER BY depth, connected_user_id;
`;
