export const influentialSnippetsQuery = `
SELECT
  p.id,
  p.user_id,
  p.likes,
  p.created_at,
  RANK() OVER (
    ORDER BY p.likes DESC, p.created_at DESC
  ) AS influence_rank
FROM posts_sql p
WHERE p.created_at >= NOW() - INTERVAL '7 days'
ORDER BY influence_rank;
`;
