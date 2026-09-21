import { defineCollection, z } from 'astro:content';

const projects = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
    description: z.string(),
    status: z.enum(['open-source', 'private', 'prototype']),
    order: z.number(),
    concepts: z.array(z.string()),
    tech: z.array(z.string()),
    github: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

export const collections = { projects };
