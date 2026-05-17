export interface CategoryMappingDto {
  id: number;
  baseCategoryId: number;
  suggestCategoryId: number;
}

export interface SyncCategoryMappingDto {
  baseCategoryId: number;
  suggestCategoryIds: number[];
  symmetric?: boolean;
}

export interface CategoryMappingCountDto {
  /** Serialized BigInt from Prisma — cast to number on the client */
  baseCategoryId: string;
  count: number;
}
