/**
 * Routes for Categories and Tags
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getMongoDb } from '../../config/mongodb';
import { supabase, supabaseAdmin } from '../../config/supabase';

export const categoriesRouter = Router();

console.log('[Routes] Categories routes loading...');

interface TagCount {
  name: string;
  count: number;
  type: string;
  departmentId?: number;
}

const DEPARTMENTS = [
  { id: 1, name: 'Backend', isActive: true },
  { id: 2, name: 'Frontend', isActive: true },
  { id: 3, name: 'DevOps', isActive: true },
] as const;

const getDepartmentCommunities = async (client: any) => {
  const { data: profiles } = await client
    .from('profiles')
    .select('department_id');

  const counts = new Map<number, number>();

  profiles?.forEach((profile: { department_id?: number | null }) => {
    const departmentId = typeof profile.department_id === 'number' ? profile.department_id : null;
    if (departmentId === null) {
      return;
    }

    counts.set(departmentId, (counts.get(departmentId) || 0) + 1);
  });

  return DEPARTMENTS.filter((department) => department.isActive).map((department) => ({
    name: department.name,
    count: counts.get(department.id) || 0,
    type: 'user',
    departmentId: department.id,
  } satisfies TagCount));
};

/**
 * GET /api/categories
 * Get all categories with counts from posts, documents, snippets
 */
categoriesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = supabaseAdmin ?? supabase;
    const db = getMongoDb();

    if (!client) {
      throw new Error('Supabase client is not available');
    }

    // Get post tags from Supabase
    const { data: posts } = await client
      .from('posts')
      .select('tags, views, reactions')
      .eq('is_public', true);

    // Get document tags from MongoDB
    const documents = await db.collection('documents')
      .find({ is_published: true })
      .project({ category_tags: 1 })
      .toArray();

    // Get snippet tags from MongoDB
    const snippets = await db.collection('snippets')
      .find({ isPublic: true })
      .project({ tags: 1 })
      .toArray();

    // Aggregate tag counts
    const tagMap = new Map<string, TagCount>();

    // Process post tags
    posts?.forEach(post => {
      post.tags?.forEach((tag: string) => {
        const key = `post:${tag}`;
        const existing = tagMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          tagMap.set(key, { name: tag, count: 1, type: 'post' });
        }
      });
    });

    // Process document tags
    documents.forEach(doc => {
      doc.category_tags?.forEach((tag: string) => {
        const key = `document:${tag}`;
        const existing = tagMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          tagMap.set(key, { name: tag, count: 1, type: 'document' });
        }
      });
    });

    // Process snippet tags
    snippets.forEach(snippet => {
      snippet.tags?.forEach((tag: string) => {
        const key = `snippet:${tag}`;
        const existing = tagMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          tagMap.set(key, { name: tag, count: 1, type: 'snippet' });
        }
      });
    });

    const userCommunities = await getDepartmentCommunities(client);

    // Convert to array and sort by count
    const allTags = Array.from(tagMap.values()).sort((a, b) => b.count - a.count);

    // Get trending tags (top 20% by count)
    const trendingThreshold = Math.ceil(allTags.length * 0.2);
    const trending = allTags.slice(0, trendingThreshold).map(t => ({ ...t, trending: true }));

    // Group by type
    const byType = {
      post: allTags.filter(t => t.type === 'post'),
      document: allTags.filter(t => t.type === 'document'),
      snippet: allTags.filter(t => t.type === 'snippet'),
      quickie: [] as TagCount[], // Quickies don't have tags yet
      user: userCommunities,
    };

    res.status(200).json({
      tags: allTags,
      trending,
      posts: byType.post,
      documents: byType.document,
      snippets: byType.snippet,
      quickies: byType.quickie,
      users: byType.user,
      total: allTags.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/categories/search?q=query
 * Search tags by name
 */
categoriesRouter.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = (req.query.q as string)?.toLowerCase();
    if (!query) {
      return res.status(400).json({ message: 'q query parameter is required' });
    }

    // Get all categories first
    const allCategories = await fetchAllCategories();
    
    // Filter by search query
    const filtered = allCategories.filter(tag => 
      tag.name.toLowerCase().includes(query)
    );

    res.status(200).json({ tags: filtered });
  } catch (error) {
    next(error);
  }
});

// Helper function to fetch all categories
async function fetchAllCategories(): Promise<TagCount[]> {
  const client = supabaseAdmin ?? supabase;
  const db = getMongoDb();

  if (!client) {
    throw new Error('Supabase client is not available');
  }

  // Get all tags from different sources
  const { data: posts } = await client
    .from('posts')
    .select('tags')
    .eq('is_public', true);

  const documents = await db.collection('documents')
    .find({ is_published: true })
    .project({ category_tags: 1 })
    .toArray();

  const snippets = await db.collection('snippets')
    .find({ isPublic: true })
    .project({ tags: 1 })
    .toArray();

  const tagMap = new Map<string, TagCount>();

  posts?.forEach(post => {
    post.tags?.forEach((tag: string) => {
      const key = `post:${tag}`;
      const existing = tagMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        tagMap.set(key, { name: tag, count: 1, type: 'post' });
      }
    });
  });

  documents.forEach(doc => {
    doc.category_tags?.forEach((tag: string) => {
      const key = `document:${tag}`;
      const existing = tagMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        tagMap.set(key, { name: tag, count: 1, type: 'document' });
      }
    });
  });

  snippets.forEach(snippet => {
    snippet.tags?.forEach((tag: string) => {
      const key = `snippet:${tag}`;
      const existing = tagMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        tagMap.set(key, { name: tag, count: 1, type: 'snippet' });
      }
    });
  });

  const userCommunities = await getDepartmentCommunities(client);

  return [...Array.from(tagMap.values()), ...userCommunities];
}
