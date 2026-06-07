import attributeCardsJson from "./attributes/attributeCards.json";

export type AttributeCardData = {
  id: number;
  name: string;
  tags: string[];
  score: number;
  desc: string;
  sourceId?: string;
  originalText?: string;
  source?: string;
};

export const ATTRIBUTE_CARDS = attributeCardsJson as AttributeCardData[];
