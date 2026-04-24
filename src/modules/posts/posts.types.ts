export interface PostDocument {
  user_id: number;
  snippet: string;
  tags: string[];
  likes: number;
  created_at?: Date;
}
