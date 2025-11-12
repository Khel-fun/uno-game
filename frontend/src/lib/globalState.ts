import { Card } from './types';

let globalCardHashMap: Map<string, Card> = new Map();

export function updateGlobalCardHashMap(newCardHashMap: Record<string, Card>) {
  globalCardHashMap = new Map(Object.entries(newCardHashMap));
  console.log('Updated global cardHashMap:', globalCardHashMap);
}

export function getGlobalCardHashMap(): Map<string, Card> {
  return globalCardHashMap;
}

export function getCardFromGlobalHashMap(cardHash: string): Card | undefined {
  return globalCardHashMap.get(cardHash);
}